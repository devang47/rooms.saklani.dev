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
  assert.deepEqual(linkify(upload, PREFIX), [{ href: upload, image: true }]);
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
