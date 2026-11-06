import adapter from "@sveltejs/adapter-static";
import preprocess from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [preprocess({ postcss: true })],

  kit: {
    // Static build for Cloudflare Pages. `404.html` is the SPA shell: real 404s for unknown URLs, and
    // static/_redirects rewrites /room/[id] to it with status 200.
    adapter: adapter({ fallback: "404.html" }),
  },
};

export default config;
