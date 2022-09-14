import express from "express";
import helmet from "helmet";
import { nanoid } from "nanoid";
import { TextDecoder } from "node:util";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";

const decoder = new TextDecoder();

const INVALID_PAYLOAD = 4001;
const BINARY_NOT_SUPPORTED = 4002;

const incomingPayloadSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("ping"),
  }),
  z.object({
    t: z.literal("usage:mem"),
  }),
  z.object({
    t: z.literal("join"),
    room: z.string().min(1),
  }),
]);

const outgoingPayloadSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("pong"),
  }),
  z.object({
    t: z.literal("usage:mem"),
    p: z.number(),
  }),
  z.object({
    t: z.literal("welcome"),
    id: z.string(),
  }),
  z.object({
    t: z.literal("joined"),
    room: z.string(),
  }),
]);

type OutGoingPayload = z.infer<typeof outgoingPayloadSchema>;

function generateId() {
  return `socket:${nanoid(24)}`;
}

function out(data: OutGoingPayload) {
  return JSON.stringify(data);
}

function getEventFromMessage(message: ArrayBuffer | string) {
  try {
    const string = typeof message === "string" ? message : decoder.decode(message);
    const json = JSON.parse(string);
    const event = incomingPayloadSchema.safeParse(json);
    if (!event.success) {
      return false;
    }
    return event.data;
  } catch (error) {
    console.error("[WS] Payload Error", error);
    return false;
  }
}

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

let interval: ReturnType<typeof setInterval>;

const port = Number(process.env["PORT"] ?? 3001);

const app = express();

app.use(helmet());

app.post("/spam", (req, res) => {
  if (!interval) {
    interval = setInterval(() => {
      broadcast("mem", {
        t: "usage:mem",
        p: process.memoryUsage().heapUsed / 1024 / 1024,
      });
    }, 250);
  } else {
    clearInterval(interval);
  }
  res.status(200).type("html").send("Ok.");
});

app.all("*", (req, res) => {
  res.status(200).type("html").send("Hello from the Playground Service.");
});

const server = app.listen(port, () => {
  console.log(`[SERVER Listening on http://localhost:${port}`);
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

setInterval(() => {
  console.log("[USERS]", rooms.get("general")?.size ?? 0);
}, 5_000);
