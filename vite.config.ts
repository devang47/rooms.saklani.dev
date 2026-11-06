import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      // Static build for Cloudflare Pages. `404.html` is the SPA shell: real 404s for unknown
      // URLs, and static/_redirects rewrites /room/[id] to it with status 200.
      adapter: adapter({ fallback: "404.html" }),
    }),
  ],
});
