/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      colors: {
        dark: "#38404A",
        light: "#F6F6F6",
      },
      transitionTimingFunction: {
        "cubic-ease": "cubic-bezier(.77,0,.175,1)",
        "out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      fontFamily: {
        mono: ["JetBrains Mono Variable", "monospace"],
      },
    },
  },
  plugins: [],
};
