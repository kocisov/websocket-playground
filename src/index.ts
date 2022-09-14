if (process.env.TYPE === "WS") {
  import("./ws");
}

if (process.env.TYPE === "uWS") {
  import("./uws");
}
