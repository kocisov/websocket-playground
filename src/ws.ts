import express from "express";
import helmet from "helmet";
import { WebSocket, WebSocketServer } from "ws";
import { BINARY_NOT_SUPPORTED, generateId, getEventFromMessage, INVALID_PAYLOAD, out, OutGoingPayload } from "./common";

const rooms = new Map<string, Set<ExtendedWebSocket>>();

function broadcast(room: string, data: OutGoingPayload) {
  const sockets = rooms.get(room);
  if (!sockets) {
    return;
  }
  sockets.forEach((ws) => {
    ws.send(data);
  });
}

class ExtendedWebSocket extends WebSocket {
  id = generateId();

  join(room: string) {
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room)!.add(this);
  }

  leave(room: string) {
    if (!rooms.has(room)) {
      return;
    }
    if (rooms.get(room)!.size === 0) {
      rooms.delete(room);
      return;
    }
    rooms.get(room)!.delete(this);
  }

  leaveAll() {
    rooms.forEach((set, room) => {
      if (set.size === 0) {
        rooms.delete(room);
        return;
      }
      set.delete(this);
    });
  }

  override send(data: OutGoingPayload) {
    super.send(out(data));
  }
}

const port = Number(process.env["PORT"] ?? 3001);

const app = express();

app.use(helmet());

app.all("*", (req, res) => {
  res.status(200).type("html").send("Hello from the Playground Service.");
});

const server = app.listen(port, () => {
  console.log(`[SERVER (WS)] Listening on http://localhost:${port}`);
});

const ws = new WebSocketServer({
  // host: "0.0.0.0",
  server,
  maxPayload: 16 * 1024 * 1024,
  clientTracking: false,
  WebSocket: ExtendedWebSocket,
});

ws.on("connection", (ws: ExtendedWebSocket) => {
  ws.join("general");

  ws.send({
    t: "welcome",
    id: ws.id,
  });

  ws.on("message", (message, isBinary) => {
    if (isBinary) {
      // Use MessagePack/avsc/etc... if Binary Data is desired
      // we are using raw JSON here for simplicity
      ws.close(BINARY_NOT_SUPPORTED, "Binary data is not supported.");
      return;
    }

    const event = getEventFromMessage(message.toString());

    if (!event) {
      ws.close(INVALID_PAYLOAD, "Invalid payload.");
      return;
    }

    switch (event.t) {
      case "ping":
        ws.send({
          t: "pong",
        });
        break;

      case "join": {
        if (event.room === "mem") {
          ws.join(event.room);
          ws.send({
            t: "joined",
            room: event.room,
          });
        }
        break;
      }

      case "usage:mem":
        ws.send({
          t: "usage:mem",
          p: process.memoryUsage().heapUsed / 1024 / 1024,
        });
        break;
    }
  });

  ws.on("close", () => {
    ws.leaveAll();
  });
});
