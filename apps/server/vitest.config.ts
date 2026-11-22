import swc from "unplugin-swc"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // SWC emits the decorator metadata NestJS dependency injection relies on.
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    // Integration tests share one database, so files run one at a time.
    fileParallelism: false,
  },
})
