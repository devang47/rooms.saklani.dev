import { uniqueNamesGenerator, colors, animals } from "unique-names-generator";

export const generateRandomName = () => {
  const name = uniqueNamesGenerator({
    dictionaries: [colors, animals],
    separator: "-",
    style: "lowerCase",
  });
  // The random suffix makes IDs impractical to guess.
  const [suffix] = crypto.getRandomValues(new Uint32Array(1));
  return `${name}-${suffix.toString(36)}`;
};
