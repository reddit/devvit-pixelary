import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    exclude: ['node_modules', 'dist'],
    environment: 'jsdom',
    setupFiles: ['src/client/test-setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    isolate: true,
    pool: 'threads',
    resolve: {
      alias: {
        '@src': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/client/components'),
        '@utils': path.resolve(__dirname, './src/client/utils'),
        '@hooks': path.resolve(__dirname, './src/client/hooks'),
        '@shared': path.resolve(__dirname, './src/shared'),
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: '.coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types/',
        '**/*.d.ts',
        'src/client/index.tsx',
        'src/server/index.ts',
        '**/test-setup.ts',
        '**/*.config.ts',
      ],
      all: true,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
