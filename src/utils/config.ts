import { browser } from "$app/environment";
import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent, type Analytics } from "firebase/analytics";
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Local Firebase emulators (`pnpm dev:local`, e2e tests). Ports match firebase.json.
const useEmulators = browser && import.meta.env.VITE_USE_EMULATORS === "true";
if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8181);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

const analytics: Analytics | undefined =
  browser && !useEmulators ? getAnalytics(app) : undefined;
export const track = (event: string) => analytics && logEvent(analytics, event);

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
