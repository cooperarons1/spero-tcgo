import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Tests live next to the code in __tests__ folders. Excluding the
    // sim-history JSONL paths and the venv keeps vitest discovery fast.
    include: ['server/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.venv/**', '**/dist/**'],
    // Long-running games can take a few hundred ms — give the runner
    // headroom without making real bugs hide forever.
    testTimeout: 5000,
  },
});
