import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    prerender: {
      enabled: true,
      crawlLinks: true,
    },
  },
  nitro: {
    preset: "static",
    output: {
      dir: ".output",
      publicDir: ".output/public",
    },
  },
});
