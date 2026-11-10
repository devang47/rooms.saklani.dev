import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { user } from "#stores";

export const app = initializeApp({
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
});

// initializeAuth leaves out the popup and redirect code that getAuth bundles,
// which anonymous sign-in never uses.
const auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });

if (import.meta.env.VITE_USE_EMULATOR) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

let signIn: Promise<User> | undefined;

// Writes need a signed-in user, so they wait on this rather than racing it.
export const ensureSignedIn = () => {
  signIn ??= signInAnonymously(auth).then(
    ({ user: signedIn }) => {
      user.set(signedIn);
      return signedIn;
    },
    (error) => {
      signIn = undefined;
      throw error;
    },
  );
  return signIn;
};
