import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.vitest.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
