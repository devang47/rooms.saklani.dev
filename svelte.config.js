import adapter from "@sveltejs/adapter-node";
import preprocess from "svelte-preprocess";
import { loadEnv } from "vite";

const env = loadEnv("production", process.cwd(), "VITE_");
const peerServer = `${env.VITE_PEERJS_HOST}:${env.VITE_PEERJS_PORT}`;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors

  preprocess: [
    preprocess({
      postcss: true,
    }),
  ],

  kit: {
    adapter: adapter(),
    csp: {
      mode: "hash",
      directives: {
        "default-src": ["self"],
        "base-uri": ["self"],
        "form-action": ["self"],
        "object-src": ["none"],
        // gtag and gapi come from Firebase Analytics and Firebase Auth.
        "script-src": [
          "self",
          "https://www.googletagmanager.com",
          "https://apis.google.com",
        ],
        // Svelte transitions and style attributes need inline styles.
        "style-src": ["self", "unsafe-inline", "https://fonts.googleapis.com"],
        "font-src": ["self", "https://fonts.gstatic.com"],
        "img-src": [
          "self",
          "data:",
          "https://res.cloudinary.com",
          "https://www.google.com",
          "https://*.google-analytics.com",
          "https://*.googletagmanager.com",
        ],
        "frame-src": [`https://${env.VITE_AUTH_DOMAIN}`],
        "connect-src": [
          "self",
          "https://*.googleapis.com",
          "https://www.google.com",
          "https://*.google-analytics.com",
          "https://*.analytics.google.com",
          "https://*.googletagmanager.com",
          `https://${peerServer}`,
          `wss://${peerServer}`,
          ...(env.VITE_USE_EMULATOR
            ? [
                "http://127.0.0.1:9099",
                "http://127.0.0.1:8080",
                "http://127.0.0.1:9199",
              ]
            : []),
        ],
      },
    },
  },
};

export default config;
