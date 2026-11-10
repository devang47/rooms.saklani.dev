// Load test for the P2P signalling server: pnpm stress:signal
//
// Each room is one host plus guests. Every guest connects, sends an OFFER to
// the host, gets an ANSWER back, then sends network candidates, which is the
// traffic a real join puts through the server. Messages and files never touch
// it, they go browser to browser.
//
// Starts a local `wrangler dev` by default. TARGET=wss://<host> runs against a
// deployed server instead: only do that against your own, it is real traffic.
// Override the scenarios with ROOMS=100 USERS=10.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const env = process.env;
const PORT = 8791;
const TARGET = env.TARGET ?? `ws://127.0.0.1:${PORT}`;
const ORIGIN = env.ORIGIN ?? "https://rooms.saklani.dev";
const CANDIDATES = Number(env.CANDIDATES ?? 5);
const CONCURRENCY = Number(env.CONCURRENCY ?? 200);
const TIMEOUT = 15_000;
const SCENARIOS = env.ROOMS
  ? [{ name: "custom", rooms: +env.ROOMS, users: +(env.USERS ?? 2) }]
  : [
      { name: "many rooms", rooms: 1000, users: 2 },
      { name: "big room", rooms: 1, users: 500 },
      { name: "mixed", rooms: 200, users: 10 },
    ];

const pct = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return +sorted[
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  ].toFixed(1);
};
const summary = (v) => ({
  p50: pct(v, 50),
  p95: pct(v, 95),
  p99: pct(v, 99),
  max: pct(v, 100),
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pool = async (items, n, fn) => {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
};

const open = (id) =>
  new Promise((resolve, reject) => {
    const start = performance.now();
    const ws = new WebSocket(
      `${TARGET}/peerjs?key=peerjs&id=${id}&token=t${id}&version=1.5.4`,
      { headers: { Origin: ORIGIN } },
    );
    const fail = (reason) => {
      clearTimeout(timer);
      ws.close();
      reject(new Error(reason));
    };
    const timer = setTimeout(() => fail("open timeout"), TIMEOUT);
    ws.onmessage = ({ data }) => {
      const { type } = JSON.parse(data);
      if (type !== "OPEN") return fail(type);
      clearTimeout(timer);
      resolve({ ws, ms: performance.now() - start });
    };
    ws.onerror = () => fail("socket error");
  });

const send = (ws, type, dst, payload) =>
  ws.readyState === WebSocket.OPEN &&
  ws.send(JSON.stringify({ type, dst, payload }));

async function run({ name, rooms, users }) {
  const tag = Math.random().toString(36).slice(2, 7);
  const peers = [];
  for (let r = 0; r < rooms; r++)
    for (let u = 0; u < users; u++) peers.push(`${tag}-r${r}-u${u}`);

  const errors = {};
  const error = (reason) => (errors[reason] = (errors[reason] ?? 0) + 1);
  const openMs = [],
    answerMs = [],
    relayMs = [];
  const sockets = new Map();

  // Hosts first, so a guest's offer has someone to reach.
  const hosts = peers.filter((id) => id.endsWith("-u0"));
  const guests = peers.filter((id) => !id.endsWith("-u0"));
  const connectStart = performance.now();
  for (const group of [hosts, guests]) {
    await pool(group, CONCURRENCY, async (id) => {
      try {
        const { ws, ms } = await open(id);
        openMs.push(ms);
        sockets.set(id, ws);
      } catch (e) {
        error(e.message);
      }
    });
  }
  const connectSecs = (performance.now() - connectStart) / 1000;

  // PeerJS heartbeats every 5s; the server drops peers silent for 60s.
  const heartbeat = setInterval(() => {
    for (const ws of sockets.values())
      ws.readyState === WebSocket.OPEN && ws.send('{"type":"HEARTBEAT"}');
  }, 5000);

  for (const [id, ws] of sockets) {
    ws.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      const now = performance.now();
      if (m.type === "OFFER") send(ws, "ANSWER", m.src, { t: m.payload.t });
      else if (m.type === "ANSWER") {
        answerMs.push(now - m.payload.t);
        for (let i = 0; i < CANDIDATES; i++)
          send(ws, "CANDIDATE", m.src, {
            t: performance.now(),
            candidate: "x".repeat(200),
          });
      } else if (m.type === "CANDIDATE") relayMs.push(now - m.payload.t);
      else if (m.type === "EXPIRE") error("EXPIRE (host unreachable)");
    };
    ws.onclose = ({ code }) => code !== 1000 && error(`closed ${code}`);
  }

  // Every guest joins at once: the worst case for the server.
  const joinable = guests.filter(
    (id) => sockets.has(id) && sockets.has(id.replace(/u\d+$/, "u0")),
  );
  const expected = joinable.length * (CANDIDATES + 2);
  const handshakeStart = performance.now();
  for (const id of joinable)
    send(sockets.get(id), "OFFER", id.replace(/u\d+$/, "u0"), {
      t: performance.now(),
      sdp: "x".repeat(2000),
    });

  let received = 0,
    idleSince = performance.now();
  while (true) {
    const now = answerMs.length * 2 + relayMs.length;
    if (now >= expected) break;
    if (now > received) (received = now), (idleSince = performance.now());
    if (performance.now() - idleSince > TIMEOUT) break;
    await sleep(20);
  }
  const handshakeSecs = (performance.now() - handshakeStart) / 1000;
  const relayed = answerMs.length * 2 + relayMs.length;

  clearInterval(heartbeat);
  for (const ws of sockets.values()) ws.close(1000);
  await sleep(500);

  return {
    scenario: name,
    rooms,
    usersPerRoom: users,
    peers: peers.length,
    connected: sockets.size,
    connectSecs: +connectSecs.toFixed(2),
    connectsPerSec: Math.round(sockets.size / connectSecs),
    openMs: summary(openMs),
    offerToAnswerMs: summary(answerMs),
    candidateRelayMs: summary(relayMs),
    messagesRelayed: relayed,
    messagesLost: expected - relayed,
    messagesPerSec: Math.round(relayed / handshakeSecs),
    errors,
  };
}

let server;
if (!env.TARGET) {
  server = spawn(
    "npx",
    ["-y", "wrangler@4", "dev", "--port", String(PORT), "--ip", "127.0.0.1"],
    {
      cwd: new URL("../signalling", import.meta.url),
      stdio: "ignore",
      detached: true,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  const http = TARGET.replace(/^ws/, "http");
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(http)).ok) break;
    } catch {}
    if (i > 300) throw new Error("signalling server did not start");
    await sleep(200);
  }
}

const results = [];
try {
  for (const scenario of SCENARIOS) {
    console.log(
      `\n▶ ${scenario.name}: ${scenario.rooms} rooms × ${scenario.users} users`,
    );
    const result = await run(scenario);
    console.log(result);
    results.push(result);
  }
} finally {
  if (server) process.kill(-server.pid);
}

console.table(
  results.map((r) => ({
    scenario: r.scenario,
    peers: `${r.connected}/${r.peers}`,
    "connects/s": r.connectsPerSec,
    "open p95 ms": r.openMs.p95,
    "answer p95 ms": r.offerToAnswerMs.p95,
    "relay p99 ms": r.candidateRelayMs.p99,
    "msgs/s": r.messagesPerSec,
    lost: r.messagesLost,
  })),
);
mkdirSync(new URL("results", import.meta.url), { recursive: true });
const file = new URL(
  `results/signal-${new Date().toISOString().slice(0, 19)}.json`,
  import.meta.url,
);
writeFileSync(
  file,
  JSON.stringify({ target: TARGET, candidates: CANDIDATES, results }, null, 2),
);
console.log(`saved ${file.pathname}`);
