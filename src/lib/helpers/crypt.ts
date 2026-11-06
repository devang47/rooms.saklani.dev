// Client-side room crypto (Web Crypto, no deps).
// One PBKDF2 run per room code yields 512 bits: the first half is the AES-GCM key,
// the second half is the Firestore doc ID. PBKDF2 output blocks are independent, so
// the doc ID (which the server sees) reveals nothing about the key, and the key never
// leaves the browser.
// ponytail: strength is capped by the 6-char code (~31 bits); PBKDF2 only slows brute
// force. Lengthen the code or put a random key in the URL #fragment if that matters.

const enc = new TextEncoder();
const dec = new TextDecoder();
const ITERATIONS = 200_000;
const SALT = enc.encode("rooms.saklani.dev/v2");

export const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const toHex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Unbiased random string from `alphabet` using crypto.getRandomValues. */
export const randomString = (length: number, alphabet = CODE_ALPHABET) => {
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length)
        out += alphabet[byte % alphabet.length];
    }
  }
  return out;
};

export interface RoomKeys {
  id: string;
  key: CryptoKey;
}

const cache = new Map<string, Promise<RoomKeys>>();

export const roomKeys = (code: string): Promise<RoomKeys> => {
  code = code.trim().toUpperCase();
  let keys = cache.get(code);
  if (!keys) {
    keys = (async () => {
      const base = await crypto.subtle.importKey(
        "raw",
        enc.encode(code),
        "PBKDF2",
        false,
        ["deriveBits"],
      );
      const bits = new Uint8Array(
        await crypto.subtle.deriveBits(
          {
            name: "PBKDF2",
            hash: "SHA-256",
            salt: SALT,
            iterations: ITERATIONS,
          },
          base,
          512,
        ),
      );
      const key = await crypto.subtle.importKey(
        "raw",
        bits.slice(0, 32),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"],
      );
      return { id: toHex(bits.slice(32)), key };
    })();
    cache.set(code, keys);
    keys.catch(() => cache.delete(code));
  }
  return keys;
};

export const encrypt = async (key: CryptoKey, text: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text),
  );
  return { iv: toB64(iv), data: toB64(new Uint8Array(data)) };
};

export const decrypt = async (
  key: CryptoKey,
  msg: { iv: string; data: string },
) =>
  dec.decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(msg.iv) },
      key,
      fromB64(msg.data),
    ),
  );
