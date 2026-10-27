import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['cli/test/**/*.test.ts', 'test/**/*.test.ts'],
    // tests never spawn a vendor CLI: model checks see every CLI as absent (see detect.ts)
    env: { REINS_NO_VENDOR_SPAWN: '1' },
    // tests spawn git and the built cli; Windows and macOS runners need more than the 5 s default
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['test/tmp.ts', 'test/e2e/build.ts'],
  },
});
