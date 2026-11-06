// Security rules tests. Run with `pnpm test:rules` (starts Firestore + Storage emulators).
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

const { FieldValue, Timestamp } = firebase.firestore;
const ROOM = "a".repeat(64);
const MIN = 60_000;
const msg = {
  iv: "A".repeat(16),
  data: "ciphertext",
  timestamp: 1,
  device: "dev",
};

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rooms",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

const user = () => env.authenticatedContext("alice");
const db = () => user().firestore();
/** @param {number} ageMin */
const seedRoom = (ageMin) =>
  env.withSecurityRulesDisabled((ctx) =>
    ctx
      .firestore()
      .doc(`rooms/${ROOM}`)
      .set({ createdAt: Timestamp.fromMillis(Date.now() - ageMin * MIN) }),
  );

test("rooms: create only with server time, valid ID, signed in", async () => {
  const ts = FieldValue.serverTimestamp();
  await assertFails(
    env
      .unauthenticatedContext()
      .firestore()
      .doc(`rooms/${ROOM}`)
      .set({ createdAt: ts }),
  );
  await assertFails(db().doc("rooms/not-a-hash").set({ createdAt: ts }));
  await assertFails(
    db()
      .doc(`rooms/${ROOM}`)
      .set({ createdAt: Timestamp.fromMillis(Date.now() + 60 * MIN) }),
  );
  await assertFails(db().doc(`rooms/${ROOM}`).set({ createdAt: ts, extra: 1 }));
  await assertSucceeds(db().doc(`rooms/${ROOM}`).set({ createdAt: ts }));
  // Existing room can't be overwritten / extended.
  await assertFails(db().doc(`rooms/${ROOM}`).set({ createdAt: ts }));
});

test("rooms: no listing, reads only while alive", async () => {
  await seedRoom(1);
  await assertFails(db().collection("rooms").get());
  await assertSucceeds(db().doc(`rooms/${ROOM}`).get());
  await assertFails(
    db()
      .doc(`rooms/${"b".repeat(64)}`)
      .get(),
  ); // missing
  await seedRoom(16);
  await assertFails(db().doc(`rooms/${ROOM}`).get()); // expired
});

test("messages: validated shape, only in live rooms", async () => {
  await seedRoom(1);
  const data = () => db().collection(`rooms/${ROOM}/data`);
  await assertSucceeds(data().add(msg));
  await assertSucceeds(data().get());
  await assertFails(data().add({ ...msg, plaintext: "hi" }));
  await assertFails(data().add({ ...msg, iv: "short" }));
  await assertFails(data().add({ ...msg, data: "x".repeat(60001) }));
  await assertFails(data().add({ ...msg, timestamp: "now" }));
  await assertFails(
    env
      .unauthenticatedContext()
      .firestore()
      .collection(`rooms/${ROOM}/data`)
      .get(),
  );

  await seedRoom(16);
  await assertFails(data().add(msg));
  await assertFails(data().get());
});

test("storage: 100 MB cap, only in live rooms", async () => {
  /** @param {string} name */
  const file = (name) => user().storage().ref(`${ROOM}/${name}`);
  const small = new Uint8Array(1024);

  await assertFails(file("none.txt").put(small).then()); // room doesn't exist
  await seedRoom(1);
  await assertSucceeds(file("ok.txt").put(small).then());
  await assertSucceeds(user().storage().ref(ROOM).listAll());
  await assertFails(
    file("big.bin")
      .put(new Uint8Array(100 * 1024 * 1024 + 1))
      .then(),
  );
  await assertFails(
    env
      .unauthenticatedContext()
      .storage()
      .ref(`${ROOM}/anon.txt`)
      .put(small)
      .then(),
  );

  await seedRoom(16);
  await assertFails(file("late.txt").put(small).then());
});
