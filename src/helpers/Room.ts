import { db, storage, ensureAuth, track } from "../utils/config";
import {
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { listAll, ref, deleteObject } from "firebase/storage";
import { roomMessages } from "$stores";
import { decrypt, encrypt, randomString, roomKeys } from "./crypt";

export const MAX_MESSAGE_LENGTH = 10_000;
export const ROOM_TTL_MS = 15 * 60 * 1000; // keep in sync with the rules and cleanup function

/** Random per-browser ID, only used to right-align your own messages. */
const getDeviceId = () => {
  let id = localStorage.getItem("deviceId");
  if (!id) localStorage.setItem("deviceId", (id = randomString(16)));
  return id;
};

export const createRoom = async () => {
  await ensureAuth();
  const code = randomString(6);
  const { id } = await roomKeys(code);

  // Rules only allow `create`, so a (very unlikely) code collision fails instead of hijacking a room.
  await setDoc(doc(db, "rooms", id), { createdAt: serverTimestamp() });
  track("room_created");

  return code;
};

export const addMessage = async ({
  roomId,
  message,
}: {
  roomId: string;
  message: string;
}) => {
  await ensureAuth();
  const { id, key } = await roomKeys(roomId);

  await addDoc(collection(db, "rooms", id, "data"), {
    ...(await encrypt(key, message)),
    timestamp: Date.now(),
    device: getDeviceId(),
  });
  track("message_pushed");
};

/**
 * Subscribes to decrypted room messages. `onClosed` fires when the room is deleted or the
 * rules start denying reads. Returns the unsubscribe function.
 */
export const getRoomMessages = async (
  roomId: string,
  scrollToBottom: () => void,
  onClosed: () => void,
) => {
  await ensureAuth();
  const { id, key } = await roomKeys(roomId);
  const me = getDeviceId();
  let latest = 0;

  // Firestore checks rules when a listener starts, so deleting the room doesn't cut off the
  // messages listener. Watch the room doc itself to notice deletion.
  const unsubRoom = onSnapshot(
    doc(db, "rooms", id),
    (snap) => !snap.exists() && onClosed(),
    onClosed,
  );

  const unsubMessages = onSnapshot(
    query(collection(db, "rooms", id, "data"), orderBy("timestamp")),
    async (snapshot) => {
      const run = ++latest;
      const messages = await Promise.all(
        snapshot.docs.map(async (d) => {
          const m = d.data();
          try {
            return {
              id: d.id,
              data: await decrypt(key, { iv: m.iv, data: m.data }),
              timestamp: m.timestamp,
              device: m.device,
              mine: m.device === me,
            };
          } catch {
            return null; // undecryptable (e.g. legacy format): skip it
          }
        }),
      );
      if (run !== latest) return; // a newer snapshot already won

      roomMessages.set(messages.filter(Boolean));
      setTimeout(scrollToBottom, 100);
    },
    onClosed,
  );

  return () => {
    unsubRoom();
    unsubMessages();
  };
};

/** Resolves `{ timestamp }` (creation time in ms) for a live room, or `false`. */
export const checkIfRoomExists = async (roomId: string) => {
  await ensureAuth();
  const { id } = await roomKeys(roomId);
  track("check_for_room_existance");

  try {
    const snap = await getDoc(doc(db, "rooms", id));
    const createdAt = snap.get("createdAt") as Timestamp | undefined;
    return createdAt ? { timestamp: createdAt.toMillis() } : false;
  } catch (err: any) {
    // Rules deny reads of missing and expired rooms alike.
    if (err?.code === "permission-denied") return false;
    throw err;
  }
};

export const deleteRoom = async (roomId: string) => {
  await ensureAuth();
  const { id } = await roomKeys(roomId);

  // Files and messages first: rules only allow listing them while the room doc exists.
  const files = await listAll(ref(storage, id));
  await Promise.all(files.items.map((file) => deleteObject(file)));

  const messages = await getDocs(collection(db, "rooms", id, "data"));
  await Promise.all(messages.docs.map((d) => deleteDoc(d.ref)));

  await deleteDoc(doc(db, "rooms", id));
  track("room_deleted");
};
