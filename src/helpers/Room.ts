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

import { deriveRoom, encrypt, generateRoomCode } from "./crypt";
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
  scrollToBottom: () => void,
) => {
  const { id } = await deriveRoom(roomId);

  const dataCollection = collection(db, "rooms", id, "data");

  const dataQuery = query(dataCollection, orderBy("timestamp"));

  onSnapshot(dataQuery, (snapshot) => {
    roomMessages.set(snapshot.docs.map((doc) => doc.data()) || []);

    setTimeout(() => {
      scrollToBottom();
    }, 100);
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

  querySnapshot.forEach(async (doData) => {
    await deleteDoc(doc(db, "rooms", cryptedKey, "data", doData.id));
  });

  await deleteDoc(docRef);
};
