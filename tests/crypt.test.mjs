import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decrypt,
  deriveRoom,
  encrypt,
  generateRoomCode,
} from "../src/helpers/crypt.ts";

test("room codes are 6 characters from the expected alphabet", () => {
  const codes = Array.from({ length: 500 }, () => generateRoomCode());
  assert.ok(codes.every((code) => /^[A-Z0-9]{6}$/.test(code)));
  assert.ok(new Set(codes).size > 490);
});

test("messages round trip, including unicode and long text", async () => {
  const { key } = await deriveRoom("ABC123");
  for (const message of ["hello", "héllo 👋\nline two", "x".repeat(200_000)]) {
    assert.equal(await decrypt(key, await encrypt(key, message)), message);
  }
});

test("the same message encrypts differently each time", async () => {
  const { key } = await deriveRoom("ABC123");
  assert.notEqual(await encrypt(key, "hi"), await encrypt(key, "hi"));
});

test("room codes are case-insensitive and rooms are separate", async () => {
  const room = await deriveRoom("ABC123");
  assert.equal(room, await deriveRoom("abc123"));
  assert.match(room.id, /^[a-f0-9]{64}$/);

  const other = await deriveRoom("ZZZ999");
  assert.notEqual(room.id, other.id);
  await assert.rejects(decrypt(other.key, await encrypt(room.key, "secret")));
});

test("tampered messages are rejected", async () => {
  const { key } = await deriveRoom("ABC123");
  const bytes = Buffer.from(await encrypt(key, "secret"), "base64");
  bytes[bytes.length - 1] ^= 1;
  await assert.rejects(decrypt(key, bytes.toString("base64")));
});
