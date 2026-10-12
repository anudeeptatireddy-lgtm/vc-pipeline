import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // *.int.test.ts talk to a Neon test branch: run them with `npm run test:ownership`.
  test: { include: ["tests/**/*.test.ts"], exclude: ["tests/**/*.int.test.ts", "node_modules/**"], environment: "node" },
});
