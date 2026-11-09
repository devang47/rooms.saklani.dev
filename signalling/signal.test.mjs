// Starts the signalling server locally and checks it speaks the PeerJS protocol.
// Run with: pnpm test:signal
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { after, before, test } from "node:test";

const PORT = 8790;
const BASE = `127.0.0.1:${PORT}`;
const ORIGIN = "https://rooms.example";
let server;

before(async () => {
  server = spawn(
    "npx",
    [
      "-y",
      "wrangler@4",
      "dev",
      "--port",
      String(PORT),
      "--ip",
      "127.0.0.1",
      "--var",
      `ALLOWED_ORIGINS:${ORIGIN},https://*.preview.example`,
    ],
    {
      cwd: new URL(".", import.meta.url),
      stdio: "ignore",
      detached: true,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(`http://${BASE}/`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server did not start");
});

after(() => process.kill(-server.pid));

const connect = (
  id,
  token = "t-" + id,
  { key = "peerjs", origin = ORIGIN } = {},
) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://${BASE}/peerjs?key=${key}&id=${id}&token=${token}&version=1.5.4`,
      { headers: { Origin: origin } },
    );
    const inbox = [];
    const waiters = [];
    ws.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      const waiter = waiters.findIndex((w) => w.match(message));
      if (waiter >= 0) waiters.splice(waiter, 1)[0].resolve(message);
      else inbox.push(message);
    };
    ws.next = (match = () => true, ms = 3000) => {
      const i = inbox.findIndex(match);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((resolve, rejectWait) => {
        waiters.push({ match, resolve });
        setTimeout(() => rejectWait(new Error("no message")), ms);
      });
    };
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("socket error"));
  });

const upgradeStatus = (origin) =>
  new Promise((resolve) => {
    const req = request({
      host: "127.0.0.1",
      port: PORT,
      path: "/peerjs?key=peerjs&id=x&token=y",
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        Origin: origin,
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
      },
    });
    req.on("response", (res) => resolve(res.statusCode));
    req.on("upgrade", (res, socket) => {
      socket.destroy();
      resolve(101);
    });
    req.end();
  });

test("a peer gets OPEN, and heartbeats are answered", async () => {
  const a = await connect("alpha-one");
  assert.equal((await a.next()).type, "OPEN");
  a.send('{"type":"HEARTBEAT"}');
  assert.equal((await a.next()).type, "HEARTBEAT");
  a.close();
});

test("messages reach the target with the real sender, whatever it claims", async () => {
  const a = await connect("bravo-one");
  const b = await connect("bravo-two");
  await a.next((m) => m.type === "OPEN");
  await b.next((m) => m.type === "OPEN");
  a.send(
    JSON.stringify({
      type: "OFFER",
      src: "someone-else",
      dst: "bravo-two",
      payload: { sdp: "x" },
    }),
  );
  const got = await b.next((m) => m.type === "OFFER");
  assert.deepEqual(got, {
    type: "OFFER",
    src: "bravo-one",
    dst: "bravo-two",
    payload: { sdp: "x" },
  });
  a.close();
  b.close();
});

test("an offer to an unknown ID expires straight away", async () => {
  const a = await connect("charlie-one");
  await a.next((m) => m.type === "OPEN");
  const start = Date.now();
  a.send(JSON.stringify({ type: "OFFER", dst: "nobody-here", payload: {} }));
  const got = await a.next((m) => m.type === "EXPIRE");
  assert.equal(got.src, "nobody-here");
  assert.ok(Date.now() - start < 1000);
  a.close();
});

test("an ID in use is refused to others, and replaced by its owner", async () => {
  const a = await connect("delta-one", "secret");
  await a.next((m) => m.type === "OPEN");
  const thief = await connect("delta-one", "other");
  assert.equal((await thief.next()).type, "ID-TAKEN");
  const again = await connect("delta-one", "secret");
  assert.equal((await again.next()).type, "OPEN");
  again.close();
});

test("bad keys and IDs are refused", async () => {
  const badKey = await connect("echo-one", "t", { key: "nope" });
  assert.equal((await badKey.next()).type, "INVALID-KEY");
  const badId = await connect("bad<id>", "t");
  assert.equal((await badId.next()).type, "ERROR");
});

test("only allowed sites can connect", async () => {
  assert.equal(await upgradeStatus("https://evil.example"), 403);
  assert.equal(await upgradeStatus(ORIGIN), 101);
  assert.equal(await upgradeStatus("https://pr-12.preview.example"), 101);
  assert.equal(await upgradeStatus("https://preview.example.evil.com"), 403);
});
