import { browser } from "$app/environment";
import { initializeApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";

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

let analytics: Analytics;
if (typeof window !== "undefined") analytics = getAnalytics();
let auth = getAuth(app);
export { analytics, auth };

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
