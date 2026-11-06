import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getStorage,
} from "firebase/storage";
import { app, ensureAuth } from "../utils/config";
import { randomString, roomKeys } from "./crypt";
import { gsap } from "gsap";

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // keep in sync with storage.rules

/** Uploads a file to the room's folder and resolves its download URL. */
export const uploadFile = async (roomId: string, file: File) => {
  if (file.size > MAX_FILE_SIZE)
    throw new Error("File size exceeds the 100 MB limit");

  await ensureAuth();
  const { id } = await roomKeys(roomId);
  // Random prefix: same-named uploads no longer overwrite each other.
  const storageRef = ref(
    getStorage(app),
    `${id}/${randomString(8)}-${file.name}`,
  );

  const uploadTask = uploadBytesResumable(storageRef, file);
  uploadTask.on("state_changed", (snapshot) => {
    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
    gsap.to(".loading-bar-width", { width: Math.max(progress, 30) + "%" });
  });

  await uploadTask;
  return getDownloadURL(uploadTask.snapshot.ref);
};
