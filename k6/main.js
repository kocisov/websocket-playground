import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.1.0/index.js";
import { check } from "k6";
import ws from "k6/ws";

const url = "wss://...";
const sessionDuration = randomIntBetween(4200, 60000);

/** @type {import("k6/options").Options} */
export const options = {
  stages: [
    { duration: "30s", target: 1500 },
    { duration: "60s", target: 3600 },
    { duration: "20s", target: 1800 },
    { duration: "30s", target: 3000 },
    { duration: "20s", target: 3000 },
    { duration: "30s", target: 800 },
    { duration: "20s", target: 0 },
  ],
  discardResponseBodies: true,
};

export default function main() {
  const res = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      socket.setTimeout(() => {
        socket.close();
      }, sessionDuration);
    });
  });

  check(res, {
    "status is 101"(r) {
      return r && r.status === 101;
    },
  });
}
