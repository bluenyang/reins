import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['cli/test/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['test/e2e/build.ts'],
  },
});
