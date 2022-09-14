import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.1.0/index.js";
import { setTimeout } from "k6/experimental/timers";
import { WebSocket } from "k6/experimental/websockets";

const url = "wss://...";
const sessionDuration = randomIntBetween(4200, 60000);

/** @type {import("k6/options").Options} */
export const options = {
  vus: 1000,
  duration: "30s",
  discardResponseBodies: true,
};

function startWebSocket() {
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    setTimeout(() => {
      socket.close();
    }, sessionDuration);
  });
}

export default function main() {
  for (let i = 0; i < 100; i++) {
    startWebSocket();
  }
}
