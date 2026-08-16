import {playwright} from '@vitest/browser-playwright';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vitest/config';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Browser unit tests, run with Vitest (formerly Karma).
export default defineConfig({
  test: {
    include: ['test/browser/spec/**/*.test.js'],
    globals: true,
    setupFiles: [path.resolve(dir, 'vitest.setup.js')],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{browser: 'chromium'}],
    },
  },
});
