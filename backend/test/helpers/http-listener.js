"use strict";
// Express apps and net.Server both expose listen(). Avoid this Windows host's
// low ephemeral ports, some of which Fetch rejects before making a request.
async function listenTestServer(app) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const server = app.listen(
      25000 + Math.floor(Math.random() * 30000),
      "127.0.0.1",
    );
    const ready = await new Promise((resolve, reject) => {
      const clear = () => {
        server.removeListener("listening", onReady);
        server.removeListener("error", onError);
      };
      function onReady() {
        clear();
        resolve(true);
      }
      function onError(error) {
        clear();
        if (["EADDRINUSE", "EACCES"].includes(error.code)) resolve(false);
        else reject(error);
      }
      server.once("listening", onReady);
      server.once("error", onError);
    });
    if (ready) return server;
  }
  throw new Error("No available high test port");
}
module.exports = { listenTestServer };
