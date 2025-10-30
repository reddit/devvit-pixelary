import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { builtinModules } from 'node:module';

export default defineConfig({
  plugins: [tsconfigPaths()],
  ssr: {
    noExternal: true,
  },
  build: {
    emptyOutDir: false,
    ssr: 'index.ts',
    outDir: '../../dist/server',
    target: 'node22',
    sourcemap: true,
    rollupOptions: {
      external: [...builtinModules],

      output: {
        format: 'cjs',
        entryFileNames: 'index.cjs',
        inlineDynamicImports: true,
      },
    },
  },
});
