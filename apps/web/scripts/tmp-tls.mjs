import tls from "node:tls";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const url = env
  .match(/^DATABASE_URL=(.*)$/m)[1]
  .trim()
  .replace(/^"|"$/g, "");
const host = new URL(url).hostname;

const sock = tls.connect({ host, port: 5432, servername: host }, () => {
  console.log("TLS ok", sock.authorized, sock.getProtocol());
  // Send a startup message with a bogus user to see whether the server answers
  // with an auth/error response (server reachable) or just drops the socket.
  const params = ["user\0nobody\0database\0postgres\0\0"].join("");
  const body = Buffer.alloc(4 + params.length);
  body.writeInt32BE(196608, 0);
  body.write(params, 4, "utf8");
  const len = Buffer.alloc(4);
  len.writeInt32BE(body.length + 4, 0);
  sock.write(Buffer.concat([len, body]));
});
sock.setTimeout(15000);
sock.on("data", (d) =>
  console.log(
    "server says:",
    d.toString("latin1").replace(/\0/g, "|").slice(0, 200),
  ),
);
sock.on("error", (e) => console.log("TLS error:", e.code, e.message));
sock.on("timeout", () => {
  console.log("timeout");
  sock.destroy();
});
sock.on("close", () => {
  console.log("closed");
  process.exit(0);
});
