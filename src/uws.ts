import type { WebSocket } from "uWebSockets.js";
import { App, SHARED_COMPRESSOR } from "uWebSockets.js";
import { BINARY_NOT_SUPPORTED, generateId, getEventFromMessage, INVALID_PAYLOAD, out } from "./common";

const port = Number(process.env["PORT"] ?? 3001);

function open(ws: WebSocket) {
  ws.id = generateId();

  ws.send(
    out({
      t: "welcome",
      id: ws.id,
    })
  );
}

function message(ws: WebSocket, message: ArrayBuffer, isBinary: boolean) {
  if (isBinary) {
    // Use MessagePack/avsc/etc... if Binary Data is desired
    // we are using raw JSON here for simplicity
    ws.end(BINARY_NOT_SUPPORTED, "Binary data is not supported.");
    return;
  }

  const event = getEventFromMessage(message);

  if (!event) {
    ws.end(INVALID_PAYLOAD, "Invalid payload.");
    return;
  }

  switch (event.t) {
    case "ping":
      ws.send(
        out({
          t: "pong",
        })
      );
      break;

    case "join": {
      if (event.room === "mem") {
        ws.subscribe(event.room);
        ws.send(
          out({
            t: "joined",
            room: event.room,
          })
        );
      }
      break;
    }

    case "usage:mem":
      ws.send(
        out({
          t: "usage:mem",
          p: process.memoryUsage().heapUsed / 1024 / 1024,
        })
      );
      break;
  }
}

export const app = App()
  .ws("/", {
    compression: SHARED_COMPRESSOR,
    maxBackpressure: 1024 * 1024,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 48,
    open,
    message,
  })

  .any("/*", (res) => {
    res.writeStatus("200").writeHeader("Content-Type", "text/html").end("Hello from the Service.");
  })

  .listen("0.0.0.0", port, (socket) => {
    if (socket) {
      console.log(`[SERVER (uWS)] Listening on http://localhost:${port}`);
      return;
    }
    process.exit(1);
  });
