import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  resolve: {
    alias: {
      '@client': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'src/client'
      ),
      '@components': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'src/client/components'
      ),
      '@utils': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'src/client/utils'
      ),
      '@hooks': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'src/client/hooks'
      ),
      '@src': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
      '@server': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'src/server'
      ),
      '@shared': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'src/shared'
      ),
      react: 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom': 'preact/compat',
      'react-dom/client': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
    },
  },
  plugins: [preact(), tsconfigPaths()],
  test: {
    globals: true,
    exclude: ['node_modules', 'dist'],
    environment: 'jsdom',
    setupFiles: ['src/client/test-setup.ts', 'src/server/test-setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    isolate: true,
    pool: 'threads',
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
