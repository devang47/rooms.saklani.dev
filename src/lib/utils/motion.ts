// Tiny Web Animations helpers (replaces GSAP). Intro animations live in CSS (global.css).

export const prefersReducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const POWER3_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)";

const animate = (
  el: Element | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
) =>
  el && !prefersReducedMotion()
    ? el
        .animate(keyframes, { fill: "forwards", ...options })
        .finished.then(() => {})
    : Promise.resolve();

/** Full-screen wipe between the home and join pages. Resolves once the screen is covered. */
export const coverScreen = () =>
  animate(
    document.querySelector(".transition-join-page"),
    [{ height: "0" }, { height: "100%" }],
    {
      duration: 700,
      easing: POWER3_OUT,
    },
  );

/** Join success: fade the floating images and blow the button up to fill the screen. */
export const expandButton = (button: Element | null) => {
  document
    .querySelectorAll(".moveable-block")
    .forEach((el) => animate(el, [{ opacity: 0 }], { duration: 100 }));
  return animate(button, [{ transform: "scale(100)" }], {
    duration: 300,
    easing: "linear",
  });
};
