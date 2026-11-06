import { randomString } from "#lib/helpers/crypt.ts";

// Small inline word lists (replaces the unique-names-generator package).
const COLORS =
  "amber aqua azure beige black blue bronze brown coral crimson cyan gold gray green indigo ivory jade lavender lemon lilac lime magenta maroon mint navy olive orange peach pink plum purple red rose ruby salmon sand silver sky teal tomato violet white yellow".split(
    " ",
  );
const ANIMALS =
  "badger bat bear beaver bison boar camel cat cheetah cobra crab crane crow deer dingo dolphin dove eagle eel falcon ferret finch fox frog gecko goat goose hare hawk heron horse ibis jackal jaguar koala lemur leopard lion llama lynx mole moose moth newt otter owl panda panther parrot pelican penguin puma quail rabbit raven robin salmon seal shark sloth snake sparrow squid stork swan tiger toad trout turtle viper walrus wasp whale wolf wombat yak zebra".split(
    " ",
  );

const pick = <T>(list: T[]) =>
  list[crypto.getRandomValues(new Uint32Array(1))[0] % list.length];

/** Readable but hard-to-guess peer ID, e.g. "teal-otter-7k2p" (~5 billion combinations). */
export const generateRandomName = () =>
  `${pick(COLORS)}-${pick(ANIMALS)}-${randomString(4, "abcdefghijklmnopqrstuvwxyz0123456789")}`;
