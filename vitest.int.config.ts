// Integration tests against the Neon test branch (tests/*.int.test.ts).
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["tests/**/*.int.test.ts"], environment: "node", testTimeout: 120_000, hookTimeout: 120_000, fileParallelism: false },
});
