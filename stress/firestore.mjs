// Load test for Firebase rooms against the Firestore emulator: pnpm stress:firestore
//
// Every user is a separate Firestore client, as a separate browser would be.
// Each one listens to its room the way the app does (onSnapshot ordered by
// timestamp) and sends MSGS encrypted messages with the app's own crypto.
// We time each write and how long every other user in the room takes to see it.
//
// The emulator is one local process, so absolute numbers are a floor for your
// machine, not production. Use them to compare runs and to find what breaks.
// Override the scenarios with ROOMS=20 USERS=10 MSGS=5.
//
// pnpm stress:firestore:live runs against the real project in .env instead.
// Readers stay signed out like the app's; writes go through a small pool of
// anonymous accounts (Firebase caps new accounts per IP). Every room, message
// and account it makes is deleted at the end. It is real, billed traffic.
import { mkdirSync, writeFileSync } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { deleteApp, initializeApp } from "firebase/app";
import { deleteUser, getAuth, signInAnonymously } from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  setLogLevel,
} from "firebase/firestore";
import { deriveRoom, encrypt, generateRoomCode } from "../src/helpers/crypt.ts";

setLogLevel("silent");
const env = process.env;
const LIVE = env.LIVE === "1";
const WRITERS = Number(env.WRITERS ?? 10);
const [HOST, PORT] = (env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(
  ":",
);
const MSGS = Number(env.MSGS ?? (LIVE ? 3 : 5));
// Users send at a random moment inside this window, like people typing.
const SPREAD_MS = Number(env.SPREAD_MS ?? 5000);
const TIMEOUT = 30_000;
const SCENARIOS = env.ROOMS
  ? [{ name: "custom", rooms: +env.ROOMS, users: +(env.USERS ?? 2) }]
  : LIVE
    ? [
        { name: "many rooms", rooms: 50, users: 2 },
        { name: "big room", rooms: 1, users: 100 },
        { name: "mixed", rooms: 10, users: 10 },
      ]
    : [
        { name: "many rooms", rooms: 200, users: 2 },
        { name: "big room", rooms: 1, users: 150 },
        { name: "mixed", rooms: 30, users: 10 },
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

const CONFIG = LIVE
  ? {
      apiKey: env.VITE_API_KEY,
      authDomain: env.VITE_AUTH_DOMAIN,
      projectId: env.VITE_PROJECT_ID,
      appId: env.VITE_APP_ID,
    }
  : { projectId: "demo-rooms", apiKey: "demo" };
if (LIVE && !CONFIG.apiKey) throw new Error("run with --env-file=.env");

let clients = 0;
const client = (uid) => {
  const app = initializeApp(CONFIG, `c${clients++}`);
  const db = getFirestore(app);
  if (!LIVE)
    connectFirestoreEmulator(db, HOST, +PORT, {
      mockUserToken: { user_id: uid },
    });
  return { app, db, uid };
};

// Who writes: each member locally, a shared signed-in pool when live.
let writers = [];
if (LIVE) {
  writers = await Promise.all(
    Array.from({ length: WRITERS }, async () => {
      const c = client("writer");
      await signInAnonymously(getAuth(c.app));
      return c;
    }),
  );
}
const writerFor = (m, i) => (LIVE ? writers[i % writers.length] : m);

async function run({ name, rooms, users }) {
  // High lag means this machine, not Firestore, is what slowed delivery.
  const lag = monitorEventLoopDelay({ resolution: 10 });
  lag.enable();
  const errors = {};
  const error = (e) =>
    (errors[e.code ?? e.message] = (errors[e.code ?? e.message] ?? 0) + 1);
  const writeMs = [],
    deliveryMs = [],
    sentAt = new Map(),
    sender = new Map();
  const saved = new Set(),
    seen = new Set(),
    failed = new Set();
  let reads = 0,
    deliveries = 0;

  const roomList = await Promise.all(
    Array.from({ length: rooms }, async () => {
      const room = await deriveRoom(generateRoomCode());
      const owner = LIVE ? writers[0] : client(`owner-${room.id.slice(0, 8)}`);
      await setDoc(doc(owner.db, "rooms", room.id), { timestamp: Date.now() });
      if (!LIVE) await deleteApp(owner.app);
      return room;
    }),
  );

  const members = roomList.flatMap((room, r) =>
    Array.from({ length: users }, (_, u) => ({
      room,
      ...client(`r${r}-u${u}`),
    })),
  );

  // Everyone joins and waits for their first snapshot, as the room page does.
  const joinStart = performance.now();
  await Promise.all(
    members.map(
      (m) =>
        new Promise((resolve) => {
          m.stop = onSnapshot(
            query(
              collection(m.db, "rooms", m.room.id, "data"),
              orderBy("timestamp"),
            ),
            (snapshot) => {
              const now = performance.now();
              snapshot.docs.map((d) => d.data()); // the app rebuilds its list every time
              for (const change of snapshot.docChanges()) {
                if (change.type !== "added") continue;
                reads++;
                const id = change.doc.id;
                seen.add(id);
                if (sender.get(id) === m.uid) continue; // own message shows instantly
                deliveries++;
                if (sentAt.has(id)) deliveryMs.push(now - sentAt.get(id));
              }
              resolve();
            },
            (e) => (error(e), resolve()),
          );
        }),
    ),
  );
  const joinSecs = (performance.now() - joinStart) / 1000;

  const sendStart = performance.now();
  await Promise.all(
    members.map(async (m, n) => {
      const w = writerFor(m, n);
      for (let i = 0; i < MSGS; i++) {
        await sleep(Math.random() * (SPREAD_MS / MSGS));
        const ref = doc(collection(w.db, "rooms", m.room.id, "data"));
        const data = await encrypt(
          m.room.key,
          `message ${i} from ${m.uid} `.repeat(4),
        );
        const start = performance.now();
        sentAt.set(ref.id, start);
        sender.set(ref.id, m.uid);
        try {
          await setDoc(ref, { data, timestamp: Date.now(), device: m.uid });
          writeMs.push(performance.now() - start);
          saved.add(ref.id);
        } catch (e) {
          failed.add(ref.id);
          error(e);
        }
      }
    }),
  );
  const sendSecs = (performance.now() - sendStart) / 1000;

  // A write can land and still report an error, so count what reached anyone.
  const landed = () => new Set([...saved, ...seen]).size;
  let expected = landed() * (users - 1),
    count = 0,
    idleSince = performance.now();
  while (deliveries < expected && performance.now() - idleSince < TIMEOUT) {
    if (deliveries > count)
      (count = deliveries), (idleSince = performance.now());
    await sleep(50);
    expected = landed() * (users - 1);
  }

  for (const m of members) m.stop();
  await Promise.all(members.map((m) => deleteApp(m.app)));

  // Leave nothing behind. Ids are known, so no listing is needed.
  if (LIVE) {
    const roomOf = new Map(members.map((m) => [m.uid, m.room.id]));
    const ids = [...new Set([...saved, ...seen, ...failed])];
    const del = (path, i) =>
      deleteDoc(doc(writers[i % writers.length].db, ...path)).catch(error);
    for (let i = 0; i < ids.length; i += 200)
      await Promise.all(
        ids
          .slice(i, i + 200)
          .map((id, j) =>
            del(["rooms", roomOf.get(sender.get(id)), "data", id], j),
          ),
      );
    await Promise.all(roomList.map((room, i) => del(["rooms", room.id], i)));
  }

  return {
    scenario: name,
    rooms,
    usersPerRoom: users,
    clients: members.length,
    joinSecs: +joinSecs.toFixed(2),
    messagesWritten: writeMs.length,
    writesPerSec: Math.round(writeMs.length / sendSecs),
    writeMs: summary(writeMs),
    fanOutMs: summary(deliveryMs),
    deliveriesExpected: expected,
    deliveriesMissed: expected - deliveries,
    // The sender was told it failed, but everyone else got the message.
    failedButDelivered: [...failed].filter((id) => seen.has(id)).length,
    // Each document a listener receives is one billed read in production.
    billedReads: reads,
    eventLoopLagP99Ms: Math.round(lag.percentile(99) / 1e6),
    errors,
  };
}

const results = [];
console.log(LIVE ? `LIVE: project ${CONFIG.projectId}` : "emulator");
for (const scenario of SCENARIOS) {
  console.log(
    `\n▶ ${scenario.name}: ${scenario.rooms} rooms × ${scenario.users} users × ${MSGS} msgs`,
  );
  const result = await run(scenario);
  console.log(result);
  results.push(result);
}

console.table(
  results.map((r) => ({
    scenario: r.scenario,
    clients: r.clients,
    "join s": r.joinSecs,
    "writes/s": r.writesPerSec,
    "write p95 ms": r.writeMs.p95,
    "fan-out p50 ms": r.fanOutMs.p50,
    "fan-out p99 ms": r.fanOutMs.p99,
    missed: r.deliveriesMissed,
    "false fails": r.failedButDelivered,
    reads: r.billedReads,
    "lag p99 ms": r.eventLoopLagP99Ms,
  })),
);
mkdirSync(new URL("results", import.meta.url), { recursive: true });
const file = new URL(
  `results/firestore-${LIVE ? "live-" : ""}${new Date().toISOString().slice(0, 19)}.json`,
  import.meta.url,
);
writeFileSync(
  file,
  JSON.stringify(
    {
      target: LIVE ? CONFIG.projectId : "emulator",
      msgs: MSGS,
      spreadMs: SPREAD_MS,
      results,
    },
    null,
    2,
  ),
);
console.log(`saved ${file.pathname}`);
for (const w of writers)
  await deleteUser(getAuth(w.app).currentUser).catch(() => {});
process.exit(0);
