const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 600_000;
const SALT = new TextEncoder().encode("rooms.saklani.dev/room/v2");

export type RoomSecrets = { id: string; key: CryptoKey };

const derivedRooms = new Map<string, Promise<RoomSecrets>>();

export const generateRoomCode = (length = 6) => {
  let code = "";
  while (code.length < length) {
    const [byte] = crypto.getRandomValues(new Uint8Array(1));
    // Reject 252-255 so every character stays equally likely.
    if (byte < 252) code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
};

// Splits one derivation into a public room ID and a private message key, so
// reading the database never reveals the key.
// ponytail: a 6-character code is about 31 bits, so someone holding a database
// dump could still brute-force it. PBKDF2 slows that down and rooms only last 15
// minutes. Real end-to-end encryption needs a random key in an invite link.
const derive = async (code: string): Promise<RoomSecrets> => {
  const password = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
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
        iterations: PBKDF2_ITERATIONS,
      },
      password,
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
  const id = Array.from(bits.slice(32), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { id, key };
};

export const deriveRoom = (code: string) => {
  const normalized = code.toUpperCase();
  let room = derivedRooms.get(normalized);
  if (!room) {
    room = derive(normalized);
    derivedRooms.set(normalized, room);
  }
  return room;
};

export const encrypt = async (key: CryptoKey, message: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(message),
    ),
  );
  let binary = "";
  for (const byte of [...iv, ...ciphertext]) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

export const decrypt = async (key: CryptoKey, encrypted: string) => {
  const bytes = Uint8Array.from(atob(encrypted), (char) => char.charCodeAt(0));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, IV_BYTES) },
    key,
    bytes.slice(IV_BYTES),
  );
  return new TextDecoder().decode(plaintext);
};
