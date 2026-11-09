import { app, ensureSignedIn } from "../utils/config";
import {
  doc,
  addDoc,
  connectFirestoreEmulator,
  setDoc,
  getDoc,
  getFirestore,
  collection,
  query,
  orderBy,
  deleteDoc,
  onSnapshot,
  getDocs,
} from "firebase/firestore";

import { decrypt, deriveRoom, encrypt, generateRoomCode } from "./crypt";
import { roomMessages } from "#stores";

const db = getFirestore(app);

if (import.meta.env.VITE_USE_EMULATOR) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export const createRoom = async () => {
  const roomId = generateRoomCode();
  const { id } = await deriveRoom(roomId);

  await ensureSignedIn();
  await setDoc(doc(db, "rooms", id), {
    timestamp: new Date().getTime(),
  });

  return roomId;
};

export const addMessage = async ({
  roomId,
  message,
}: {
  roomId: string;
  message: string;
}) => {
  const { id, key } = await deriveRoom(roomId);
  const user = await ensureSignedIn();

  await addDoc(collection(db, "rooms", id, "data"), {
    data: await encrypt(key, message),
    timestamp: new Date().getTime(),
    device: user.uid,
  });
};

export const getRoomMessages = async (
  roomId: string,
  onUpdate: (first: boolean) => void,
) => {
  const { id, key } = await deriveRoom(roomId);

  const dataCollection = collection(db, "rooms", id, "data");

  const dataQuery = query(dataCollection, orderBy("timestamp"));

  // Messages are decrypted before they render, so each bubble appears at its
  // final size, and each message is decrypted only once.
  const plaintext = new Map<string, Promise<string>>();
  const read = (docId: string, ciphertext: string) => {
    if (!plaintext.has(docId)) {
      plaintext.set(
        docId,
        decrypt(key, ciphertext).catch(() => "Unable to decrypt this message"),
      );
    }
    return plaintext.get(docId)!;
  };

  let first = true;
  let latest = 0;
  return onSnapshot(dataQuery, async (snapshot) => {
    const version = ++latest;
    const messages = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        return { ...data, data: await read(doc.id, data.data) };
      }),
    );
    // A newer snapshot may have finished first; never go back to an older one.
    if (version !== latest) return;
    roomMessages.set(messages);
    const isFirst = first;
    first = false;
    // Lets the new messages render before the page measures or scrolls.
    setTimeout(() => onUpdate(isFirst), 50);
  });
};

export const checkIfRoomExists = async (roomId: string) => {
  const { id } = await deriveRoom(roomId);

  const room = await getDoc(doc(db, "rooms", id));
  return room.exists() ? room.data() : false;
};

export const deleteRoom = async (roomId: string) => {
  const { id: cryptedKey } = await deriveRoom(roomId);
  await ensureSignedIn();

  const { deleteRoomFiles } = await import("./storage");
  await deleteRoomFiles(cryptedKey);

  const docRef = doc(db, "rooms", cryptedKey);

  const q = query(collection(db, "rooms", cryptedKey, "data"));
  const querySnapshot = await getDocs(q);

  await Promise.all(
    querySnapshot.docs.map((message) => deleteDoc(message.ref)),
  );
  await deleteDoc(docRef);
};
