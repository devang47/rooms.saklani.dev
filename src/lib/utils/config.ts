import { browser } from "$app/env";
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// initializeAuth instead of getAuth: anonymous sign-in never needs the popup/redirect code.
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});
export const db = getFirestore(app);

// Local Firebase emulators (e2e tests, `vite dev --mode emulators`). Ports match firebase.json.
export const useEmulators =
  browser && import.meta.env.VITE_USE_EMULATORS === "true";
if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8181);
}

// Firestore/Storage rules require auth: every room call awaits this first.
let authReady: Promise<void> | undefined;
export const ensureAuth = () =>
  (authReady ??= new Promise<void>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      if (u) resolve();
      else signInAnonymously(auth).then(() => resolve(), reject);
    });
  }).catch((err) => {
    authReady = undefined;
    throw err;
  }));
