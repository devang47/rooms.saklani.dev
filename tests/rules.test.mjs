// Runs against the Firebase emulators: pnpm test:rules
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { beforeEach, test } from "node:test";
import { initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  setLogLevel,
  updateDoc,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  deleteObject,
  getDownloadURL,
  getStorage,
  listAll,
  ref,
  uploadBytes,
} from "firebase/storage";

setLogLevel("silent");

const PROJECT = "demo-rooms";
const BUCKET = `${PROJECT}.appspot.com`;
const CURRENT_ID = "a".repeat(64);
const PREVIOUS_CLIENT_ID = "b".repeat(128);
const MINUTE = 60 * 1000;

let clients = 0;
const client = (uid) => {
  const app = initializeApp(
    { projectId: PROJECT, storageBucket: BUCKET, apiKey: "demo" },
    `client-${clients++}`,
  );
  const db = getFirestore(app);
  const storage = getStorage(app);
  const options = uid ? { mockUserToken: { user_id: uid } } : {};
  connectFirestoreEmulator(db, "127.0.0.1", 8080, options);
  connectStorageEmulator(storage, "127.0.0.1", 9199, options);
  return { db, storage };
};

const user = client("user-1");
const anonymous = client();

const denied = (promise) =>
  assert.rejects(promise, (error) =>
    /permission|unauthorized/i.test(error.code),
  );

const firestoreUrl = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

// Writes with admin access, to set up states the rules would refuse.
const seedRoom = async (id, timestamp) => {
  const response = await fetch(`${firestoreUrl}/rooms/${id}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner" },
    body: JSON.stringify({
      fields: { timestamp: { integerValue: String(timestamp) } },
    }),
  });
  assert.equal(response.status, 200);
};

const message = (overrides = {}) => ({
  data: "ciphertext",
  timestamp: Date.now(),
  device: "user-1",
  ...overrides,
});

beforeEach(async () => {
  await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: "DELETE" },
  );
});

test("rooms can't be listed, but exact rooms can be read", async () => {
  await seedRoom(CURRENT_ID, Date.now());
  await denied(getDocs(collection(anonymous.db, "rooms")));
  await denied(getDocs(collection(user.db, "rooms")));
  const room = await getDoc(doc(anonymous.db, "rooms", CURRENT_ID));
  assert.equal(room.exists(), true);
});

test("other collections are closed", async () => {
  await denied(getDoc(doc(user.db, "anything", "x")));
  await denied(setDoc(doc(user.db, "anything", "x"), { a: 1 }));
});

test("creating a room needs sign-in, a valid ID and a current timestamp", async () => {
  const room = (db, id = CURRENT_ID) => doc(db, "rooms", id);
  const timestamp = Date.now();

  await denied(setDoc(room(anonymous.db), { timestamp }));
  await denied(setDoc(room(user.db, "short"), { timestamp }));
  await denied(setDoc(room(user.db), { timestamp, extra: 1 }));
  await denied(setDoc(room(user.db), { timestamp: "now" }));
  await denied(setDoc(room(user.db), { timestamp: timestamp + 60 * MINUTE }));
  await denied(setDoc(room(user.db), { timestamp: timestamp - 60 * MINUTE }));

  await setDoc(room(user.db), { timestamp });
});

test("rooms can't be overwritten or edited", async () => {
  await seedRoom(CURRENT_ID, Date.now());
  const room = doc(user.db, "rooms", CURRENT_ID);
  await denied(setDoc(room, { timestamp: Date.now() }));
  await denied(updateDoc(room, { timestamp: Date.now() }));
});

test("messages need sign-in, a live room and the expected shape", async () => {
  await seedRoom(CURRENT_ID, Date.now());
  const messages = (db, id = CURRENT_ID) => collection(db, "rooms", id, "data");

  await denied(addDoc(messages(anonymous.db), message()));
  await denied(addDoc(messages(user.db), message({ extra: 1 })));
  await denied(addDoc(messages(user.db), message({ data: 1 })));
  await denied(
    addDoc(messages(user.db), message({ data: "x".repeat(350001) })),
  );
  await denied(addDoc(messages(user.db, "c".repeat(64)), message()));

  await addDoc(messages(user.db), message());
  const { size } = await getDocs(messages(anonymous.db));
  assert.equal(size, 1);
});

test("messages can't be edited", async () => {
  await seedRoom(CURRENT_ID, Date.now());
  const sent = await addDoc(
    collection(user.db, "rooms", CURRENT_ID, "data"),
    message(),
  );
  await denied(updateDoc(sent, { data: "changed" }));
});

test("expired rooms refuse new messages", async () => {
  await seedRoom(CURRENT_ID, Date.now() - 16 * MINUTE);
  await denied(
    addDoc(collection(user.db, "rooms", CURRENT_ID, "data"), message()),
  );
});

test("deleting needs sign-in", async () => {
  await seedRoom(CURRENT_ID, Date.now());
  const sent = await addDoc(
    collection(user.db, "rooms", CURRENT_ID, "data"),
    message(),
  );
  const room = doc(anonymous.db, "rooms", CURRENT_ID);
  await denied(deleteDoc(room));
  await denied(deleteDoc(doc(anonymous.db, sent.path)));

  await deleteDoc(sent);
  await deleteDoc(doc(user.db, "rooms", CURRENT_ID));
});

test("the client live today keeps working", async () => {
  const room = doc(user.db, "rooms", PREVIOUS_CLIENT_ID);
  await setDoc(room, { timestamp: Date.now() });
  await addDoc(
    collection(user.db, "rooms", PREVIOUS_CLIENT_ID, "data"),
    message({ device: "d".repeat(64) }),
  );
  await uploadBytes(
    ref(user.storage, `${PREVIOUS_CLIENT_ID}/photo.png`),
    new Uint8Array(4),
  );
});

test("storage: uploads need sign-in, a room path and a size under 20 MB", async () => {
  const file = new Uint8Array(1024);
  const path = (name) => `${CURRENT_ID}/${name}`;

  await denied(uploadBytes(ref(anonymous.storage, path("a.txt")), file));
  await denied(uploadBytes(ref(user.storage, "not-a-room/a.txt"), file));
  await denied(uploadBytes(ref(user.storage, "a.txt"), file));
  await denied(
    uploadBytes(ref(user.storage, `${CURRENT_ID}/nested/a.txt`), file),
  );
  await denied(
    uploadBytes(
      ref(user.storage, path("big.bin")),
      new Uint8Array(20 * 1024 * 1024 + 1),
    ),
  );

  await uploadBytes(
    ref(user.storage, path("limit.bin")),
    new Uint8Array(20 * 1024 * 1024),
  );
});

test("storage: files can't be overwritten, and reads and deletes need sign-in", async () => {
  const name = `${CURRENT_ID}/owned-${Date.now()}.txt`;
  const file = ref(user.storage, name);
  await uploadBytes(file, new Uint8Array(4));

  await denied(uploadBytes(file, new Uint8Array(8)));
  await denied(getDownloadURL(ref(anonymous.storage, name)));
  await denied(deleteObject(ref(anonymous.storage, name)));

  assert.match(await getDownloadURL(file), /^http/);
  const { items } = await listAll(ref(user.storage, `${CURRENT_ID}/`));
  assert.ok(items.some((item) => item.fullPath === name));

  await deleteObject(file);
});

test("storage: the whole bucket can't be listed", async () => {
  await denied(listAll(ref(user.storage, "")));
});

test("cleanup removes expired rooms, messages and files, and keeps live ones", async () => {
  const require = createRequire(import.meta.url);
  // A firebase-admin dependency needs SlowBuffer, which Node 25+ removed. The
  // function itself deploys on Node 22, so this only matters for running the test.
  require("node:buffer").SlowBuffer ??= function SlowBuffer() {};
  const { cleanup } = require("../functions/index.js");
  const {
    getFirestore: adminFirestore,
  } = require("../functions/node_modules/firebase-admin/lib/firestore/index.js");
  const {
    getStorage: adminStorage,
  } = require("../functions/node_modules/firebase-admin/lib/storage/index.js");

  const expiredRoom = "c".repeat(64);
  const liveRoom = "d".repeat(64);
  const now = Date.now();

  await seedRoom(expiredRoom, now);
  await seedRoom(liveRoom, now + 30 * MINUTE);
  await addDoc(collection(user.db, "rooms", expiredRoom, "data"), message());
  await uploadBytes(
    ref(user.storage, `${expiredRoom}/old.txt`),
    new Uint8Array(4),
  );

  // Runs with the clock 16 minutes ahead, so everything created above is expired.
  const result = await cleanup(
    adminFirestore(),
    adminStorage().bucket(BUCKET),
    now + 16 * MINUTE,
  );
  assert.ok(result.rooms === 1 && result.files >= 1);

  assert.equal(
    (await getDoc(doc(anonymous.db, "rooms", expiredRoom))).exists(),
    false,
  );
  assert.equal(
    (await getDocs(collection(anonymous.db, "rooms", expiredRoom, "data")))
      .size,
    0,
  );
  assert.equal(
    (await getDoc(doc(anonymous.db, "rooms", liveRoom))).exists(),
    true,
  );
  await assert.rejects(
    getDownloadURL(ref(user.storage, `${expiredRoom}/old.txt`)),
  );
});
