import { analytics, app, ensureSignedIn } from "../utils/config";
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
import { logEvent } from "firebase/analytics";

// import {  } from "firebase/firestore/lite";

import { deriveRoom, encrypt, generateRoomCode } from "./crypt";
import { roomMessages } from "#stores";
import {
  connectStorageEmulator,
  getStorage,
  listAll,
  ref,
  deleteObject,
} from "firebase/storage";

const db = getFirestore(app);
const storage = getStorage(app);

if (import.meta.env.VITE_USE_EMULATOR) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

export const createRoom = async () => {
  const roomId = generateRoomCode();
  const { id } = await deriveRoom(roomId);

  await ensureSignedIn();
  await setDoc(doc(db, "rooms", id), {
    timestamp: new Date().getTime(),
  });

  logEvent(analytics, "room_created");

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

  logEvent(analytics, "message_pushed");
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
  logEvent(analytics, "check_for_room_existance");

  const room = await getDoc(doc(db, "rooms", id));
  return room.exists() ? room.data() : false;
};

export const deleteRoom = async (roomId: string) => {
  const { id: cryptedKey } = await deriveRoom(roomId);
  await ensureSignedIn();

  const filesRef = ref(storage, cryptedKey + "/");
  const files = await listAll(filesRef);

  files.items.forEach(async (e) => {
    // @ts-ignore
    let path = e._location.path;

    const filesRef = ref(storage, path);
    await deleteObject(filesRef);
  });

  const docRef = doc(db, "rooms", cryptedKey);

  const q = query(collection(db, "rooms", cryptedKey, "data"));
  const querySnapshot = await getDocs(q);

  querySnapshot.forEach(async (doData) => {
    await deleteDoc(doc(db, "rooms", cryptedKey, "data", doData.id));
  });

  await deleteDoc(docRef);
  logEvent(analytics, "room_deleted");
};
