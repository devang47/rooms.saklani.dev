import { loading, loadingUpload } from "#stores";
import {
  connectStorageEmulator,
  deleteObject,
  getDownloadURL,
  getStorage,
  listAll,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { app, ensureSignedIn } from "../utils/config";
import { addNotification } from "../utils/notifications";
import { deriveRoom } from "./crypt";

const storage = getStorage(app);

if (import.meta.env.VITE_USE_EMULATOR) {
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

// Keep in sync with the limit in storage.rules.
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const uploadFile = async (roomId: string, file: File) => {
  if (file.size > MAX_FILE_BYTES) {
    addNotification("File size exceeds 20mb limit!", true);
    throw new Error("File too large");
  }

  const { id } = await deriveRoom(roomId);
  await ensureSignedIn();

  return new Promise((resolve, reject) => {
    // The UUID stops two files with the same name from colliding, because the
    // storage rules don't allow overwrites.
    const storageRef = ref(
      storage,
      `${id}/${crypto.randomUUID()}-${file.name}`,
    );

    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

        const bar = document.querySelector<HTMLElement>(".loading-bar-width");
        if (bar) bar.style.width = Math.max(progress, 30) + "%";
      },
      (error) => {
        loading.set(false);
        loadingUpload.set(false);
        addNotification("Error while uploading file!", true);
        reject(error);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(async (e) => {
          loading.set(false);
          loadingUpload.set(false);
          resolve(e);
        });
      },
    );
  });
};

export const deleteRoomFiles = async (id: string) => {
  const files = await listAll(ref(storage, id + "/"));
  await Promise.all(files.items.map(deleteObject));
};
