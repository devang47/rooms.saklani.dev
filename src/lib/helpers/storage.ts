// Firebase Storage is only needed for uploads and room deletion, so this module is
// imported on demand to keep it out of the chat page's initial bundle.
import {
  connectStorageEmulator,
  deleteObject,
  getDownloadURL,
  getStorage,
  listAll,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { app, ensureAuth, useEmulators } from "#lib/utils/config.ts";
import { randomString, roomKeys } from "#lib/helpers/crypt.ts";

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // keep in sync with storage.rules

const storage = getStorage(app);
if (useEmulators) connectStorageEmulator(storage, "127.0.0.1", 9199);

/** Uploads a file to the room's folder and resolves its download URL. */
export const uploadFile = async (
  roomId: string,
  file: File,
  onProgress: (percent: number) => void,
) => {
  if (file.size > MAX_FILE_SIZE)
    throw new Error("File size exceeds the 100 MB limit");

  await ensureAuth();
  const { id } = await roomKeys(roomId);
  // Random prefix: same-named uploads no longer overwrite each other.
  const uploadTask = uploadBytesResumable(
    ref(storage, `${id}/${randomString(8)}-${file.name}`),
    file,
  );
  uploadTask.on("state_changed", (snapshot) =>
    onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
  );

  await uploadTask;
  return getDownloadURL(uploadTask.snapshot.ref);
};

/** Deletes every file of a room (by its doc ID). */
export const deleteRoomFiles = async (roomDocId: string) => {
  const files = await listAll(ref(storage, roomDocId));
  await Promise.all(files.items.map((file) => deleteObject(file)));
};
