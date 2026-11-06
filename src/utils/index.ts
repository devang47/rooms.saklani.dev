import { uniqueNamesGenerator, colors, animals } from "unique-names-generator";
import { randomString } from "$helpers/crypt";

/** Readable but hard-to-guess peer ID, e.g. "red-fox-7k2p" (~30 billion combinations). */
export const generateRandomName = () =>
  uniqueNamesGenerator({
    dictionaries: [colors, animals],
    separator: "-",
    style: "lowerCase",
  }) +
  "-" +
  randomString(4, "abcdefghijklmnopqrstuvwxyz0123456789");
