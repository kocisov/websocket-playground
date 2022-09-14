import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.1.0/index.js";
import { check } from "k6";
import ws from "k6/ws";

const url = "wss://...";
const sessionDuration = randomIntBetween(4200, 60000);

/** @type {import("k6/options").Options} */
export const options = {
  vus: 1000,
  duration: "30s",
  discardResponseBodies: true,
};

export default function main() {
  const res = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      console.log("connected");

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
