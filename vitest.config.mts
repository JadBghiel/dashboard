import { defineConfig } from "vitest/config";

export default defineConfig({
  // same @/ alias as tsconfig, done by hand so the setup doesnt need another plugin
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // the test db is 1 container, 2 files truncating at the same time would fight
    fileParallelism: false,
    typecheck: {
      // the front/back contract is a type, so it gets checked like any other assertion
      include: ["tests/**/*.test-d.ts"],
      tsconfig: "tsconfig.json",
    },
  },
});
