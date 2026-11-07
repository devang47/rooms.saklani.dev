import { loading, loadingUpload } from "$stores";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getStorage,
} from "firebase/storage";
import { app, ensureSignedIn } from "../utils/config";
import { addNotification } from "../utils/notifications";
import { deriveRoom } from "./crypt";
import { gsap } from "gsap";

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
    const storage = getStorage(app);
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

        gsap.to(".loading-bar-width", {
          width: Math.max(progress, 30) + "%",
        });
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

export const minifyURL = async (e: string) =>
  new Promise((resolve, reject) => {
    var data = {
      url: e,
      domain: "tiny.one",
    };

    fetch("https://api.tinyurl.com/create", {
      method: "post",
      headers: {
        accept: "application/json",
        "content-Type": "application/json",
        authorization: `Bearer ${import.meta.env.VITE_SHORTIO_API_KEY}`,
      },
      body: JSON.stringify(data),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        resolve(data.data.tiny_url);
      });
  });
