import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
      ],
    },
    // Playwright specs and the older node:test files are not Vitest suites.
    exclude: [
      'node_modules/**',
      'e2e/**',
      'dist/**',
      '.next/**',
      'scripts/**',
      'src/lib/data/memory.test.ts',
      'src/lib/admin-moderation.test.ts',
      'src/lib/moderation.test.ts',
      'src/lib/categories.test.ts',
      'src/lib/public-user.test.ts',
      'src/lib/encrypted-blob.test.ts',
      'src/lib/security-headers.test.ts',
      'src/app/api/health/health.test.ts',
      'src/lib/create-rating.integration.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
