import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const peerServer =
    `${env.VITE_PEERJS_HOST}:${env.VITE_PEERJS_PORT}` as `${string}.${string}`;
  const authDomain = env.VITE_AUTH_DOMAIN as `${string}.${string}`;

  return {
    plugins: [
      sveltekit({
        preprocess: vitePreprocess(),
        // /room/[id] can't be prerendered, so it uses the fallback page.
        adapter: adapter({ fallback: "200.html" }),
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
            "style-src": [
              "self",
              "unsafe-inline",
              "https://fonts.googleapis.com",
            ],
            "font-src": ["self", "https://fonts.gstatic.com"],
            "img-src": [
              "self",
              "data:",
              "https://res.cloudinary.com",
              "https://www.google.com",
              "https://*.google-analytics.com",
              "https://*.googletagmanager.com",
            ],
            "frame-src": [`https://${authDomain}`],
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
                ? ([
                    "http://127.0.0.1:9099",
                    "http://127.0.0.1:8080",
                    "http://127.0.0.1:9199",
                  ] as const)
                : []),
            ],
          },
        },
      }),
    ],
  };
});
