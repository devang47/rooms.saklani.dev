import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
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
            "img-src": ["self", "data:"],
            "connect-src": [
              "self",
              "https://*.googleapis.com",
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
