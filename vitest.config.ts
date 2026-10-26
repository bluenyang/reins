import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['cli/test/**/*.test.ts', 'test/**/*.test.ts'],
    // tests never spawn a vendor CLI: model checks see every CLI as absent (see detect.ts)
    env: { REINS_NO_VENDOR_SPAWN: '1' },
    globalSetup: ['test/tmp.ts', 'test/e2e/build.ts'],
  },
});
