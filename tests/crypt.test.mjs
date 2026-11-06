// Run with `pnpm test` (Node 23+ strips the TS types natively).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roomKeys,
  encrypt,
  decrypt,
  randomString,
  CODE_ALPHABET,
} from "../src/lib/helpers/crypt.ts";

test("same code (any case) derives the same doc ID; different codes don't", async () => {
  const a = await roomKeys("abc123");
  const b = await roomKeys(" ABC123 ");
  const c = await roomKeys("ABC124");
  assert.match(a.id, /^[0-9a-f]{64}$/);
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
});

test("encrypt/decrypt round-trips, wrong key or tampering fails", async () => {
  const { key } = await roomKeys("ROOM01");
  const { key: other } = await roomKeys("ROOM02");
  const text = "hello 👋 — ünïcode\nline 2";

  const msg = await encrypt(key, text);
  assert.equal(msg.iv.length, 16); // matches firestore.rules
  assert.notEqual(msg.data, text);
  assert.equal(await decrypt(key, msg), text);

  await assert.rejects(decrypt(other, msg));
  await assert.rejects(
    decrypt(key, {
      ...msg,
      data: (msg.data[0] === "A" ? "B" : "A") + msg.data.slice(1),
    }),
  );
  // Fresh IV each time.
  assert.notEqual((await encrypt(key, text)).data, msg.data);
});

test("randomString uses only the alphabet", () => {
  const s = randomString(500);
  assert.equal(s.length, 500);
  assert.ok([...s].every((ch) => CODE_ALPHABET.includes(ch)));
});
