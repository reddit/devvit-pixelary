import { defineConfig, mergeConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import rootConfig from '../../vitest.config';

export default mergeConfig(
  rootConfig,
  defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./test-setup.ts'],
    },
  })
);
