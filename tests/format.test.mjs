import assert from "node:assert/strict";
import { test } from "node:test";
import { linkify } from "../src/utils/format.ts";

const PREFIX =
  "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/";

test("plain text stays one part", () => {
  assert.deepEqual(linkify("hello there", PREFIX), [{ text: "hello there" }]);
});

test("links are split out, without trailing punctuation", () => {
  assert.deepEqual(linkify("see https://example.com/a?b=1. ok", PREFIX), [
    { text: "see " },
    { href: "https://example.com/a?b=1", image: false },
    { text: ". ok" },
  ]);
});

test("only images from this app's uploads get previews", () => {
  const upload = `${PREFIX}abc%2F123-cat.PNG?alt=media&token=x`;
  assert.deepEqual(linkify(upload, PREFIX), [
    { href: upload, image: true, name: "123-cat.PNG" },
  ]);
  assert.equal(
    linkify("https://evil.example/track.png", PREFIX)[0].image,
    false,
  );
  assert.equal(
    linkify(`${PREFIX}abc%2Fnotes.txt?alt=media`, PREFIX)[0].image,
    false,
  );
});

test("javascript and other schemes are never links", () => {
  assert.deepEqual(linkify("javascript:alert(1)", PREFIX), [
    { text: "javascript:alert(1)" },
  ]);
});

test("uploads show their own file name, without the unique prefix", () => {
  const upload = `${PREFIX}abc%2F9f1c2d3e-0a1b-4c2d-8e3f-123456789abc-trip%20notes.txt?alt=media`;
  assert.deepEqual(linkify(upload, PREFIX), [
    { href: upload, image: false, name: "trip notes.txt" },
  ]);
});
