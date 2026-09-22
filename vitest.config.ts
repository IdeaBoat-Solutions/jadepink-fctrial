import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/* Unit tests cover the pure domain core only — phone normalization, the two
   state machines, round-robin, derived summaries. No DB/network: those are
   exercised by scripts/verify-stage3.mjs against a live Supabase. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
