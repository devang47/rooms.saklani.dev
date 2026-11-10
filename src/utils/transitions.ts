// Slides the page cover down, ready for the next page to appear underneath.
export const coverPage = () =>
  document.querySelector(".transition-join-page")!.animate(
    { height: ["0", "100%"] },
    {
      duration: 250,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      fill: "forwards",
    },
  ).finished;
