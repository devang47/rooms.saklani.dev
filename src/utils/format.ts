export type Part = { text: string } | { href: string; image: boolean };

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

const isUploadedImage = (href: string, prefix: string) => {
  if (!href.startsWith(prefix)) return false;
  try {
    return IMAGE.test(decodeURIComponent(new URL(href).pathname));
  } catch {
    return false;
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
    parts.push({ href, image: isUploadedImage(href, prefix) });
    last = match.index + href.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
};
