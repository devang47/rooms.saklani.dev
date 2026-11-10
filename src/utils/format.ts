export type Part =
  | { text: string }
  | { href: string; image: boolean; name?: string };

const LINK = /https?:\/\/[^\s<>"']+/g;
const IMAGE = /\.(avif|gif|jpe?g|png|webp)$/i;

// Where this app's uploads live. Only these get image previews, so a message
// can't make everyone in the room load an image from a server that logs them.
export const uploadsPrefix = () =>
  `${
    import.meta.env.VITE_USE_EMULATOR
      ? "http://127.0.0.1:9199"
      : "https://firebasestorage.googleapis.com"
  }/v0/b/${import.meta.env.VITE_STORAGE_BUCKET}/o/`;

// The file name of one of this app's uploads, without the random prefix
// added to keep names unique.
const uploadName = (href: string, prefix: string) => {
  if (!href.startsWith(prefix)) return;
  try {
    const path = decodeURIComponent(new URL(href).pathname);
    return path.slice(path.lastIndexOf("/") + 1).replace(/^[0-9a-f-]{36}-/, "");
  } catch {
    return;
  }
};

// Splits a message into text and links, so links render without raw HTML.
export const linkify = (text: string, prefix: string): Part[] => {
  const parts: Part[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    // Trailing punctuation usually ends the sentence, not the link.
    const href = match[0].replace(/[.,!?;:)\]]+$/, "");
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    const name = uploadName(href, prefix);
    parts.push(
      name ? { href, image: IMAGE.test(name), name } : { href, image: false },
    );
    last = match.index + href.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
};
