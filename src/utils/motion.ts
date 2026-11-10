import { quintOut } from "svelte/easing";

// Reduced motion keeps the fades and drops the movement.
export const reduceMotion =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export const easeOut = quintOut;
