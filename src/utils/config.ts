import { initializeApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type User,
} from "firebase/auth";

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

if (import.meta.env.VITE_USE_EMULATOR) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

let signIn: Promise<User> | undefined;

// Writes need a signed-in user, so they wait on this instead of racing the
// sign-in started by the layout.
export const ensureSignedIn = () => {
  signIn ??= signInAnonymously(auth).then(
    ({ user }) => user,
    (error) => {
      signIn = undefined;
      throw error;
    },
  );
  return signIn;
};
