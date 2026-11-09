import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, loadEnv } from "vite";

const REQUIRED_ENV = [
  "VITE_API_KEY",
  "VITE_AUTH_DOMAIN",
  "VITE_PROJECT_ID",
  "VITE_STORAGE_BUCKET",
  "VITE_SENDER_ID",
  "VITE_APP_ID",
  "VITE_PEERJS_HOST",
  "VITE_PEERJS_PORT",
];

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  // Without this, a missing variable still builds, into a broken site.
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (command === "build" && missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  // A local signalling server (tests, development) runs without TLS.
  const peerLocal = /^(localhost|127\.0\.0\.1)$/.test(
    env.VITE_PEERJS_HOST ?? "",
  );
  const peerServer =
    `${env.VITE_PEERJS_HOST}:${env.VITE_PEERJS_PORT}` as `${string}.${string}`;

  return {
    // Small fonts would otherwise become data: URLs, which the CSP blocks.
    build: { assetsInlineLimit: 0 },
    plugins: [
      sveltekit({
        preprocess: vitePreprocess(),
        // Small enough that inlining beats a render-blocking request.
        inlineStyleThreshold: 40 * 1024,
        // /room/[id] can't be prerendered, so it uses the fallback page.
        adapter: adapter({ fallback: "200.html" }),
        csp: {
          mode: "hash",
          directives: {
            "default-src": ["self"],
            "base-uri": ["self"],
            "form-action": ["self"],
            "object-src": ["none"],
            "script-src": ["self"],
            // Svelte transitions and style attributes need inline styles.
            "style-src": ["self", "unsafe-inline"],
            "font-src": ["self"],
            // Uploaded images are previewed in the chat.
            "img-src": [
              "self",
              "data:",
              "blob:",
              "https://firebasestorage.googleapis.com",
              ...(env.VITE_USE_EMULATOR
                ? (["http://127.0.0.1:9199"] as const)
                : []),
            ],
            "connect-src": [
              "self",
              "https://*.googleapis.com",
              `${peerLocal ? "http" : "https"}://${peerServer}`,
              `${peerLocal ? "ws" : "wss"}://${peerServer}`,
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
