import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  css: {
    transformer: 'lightningcss',
  },
  resolve: {
    alias: {
      '@client': path.resolve(path.dirname(fileURLToPath(import.meta.url))),
      '@components': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'components'
      ),
      '@utils': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'utils'
      ),
      '@hooks': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'hooks'
      ),
      '@src': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
      '@server': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../server'
      ),
      '@shared': path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../shared'
      ),
    },
  },
  plugins: [tsconfigPaths(), preact(), tailwindcss()],
  build: {
    cssMinify: 'lightningcss',
    outDir: '../../dist/client',
    emptyOutDir: !process.env.ENTRY,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    rollupOptions: {
      input: (() => {
        const single = process.env.ENTRY;
        if (single) {
          // Allow building a single entry via ENTRY env var
          return { [single]: `./${single}.html` };
        }
        return {
          drawing: './drawing.html',
          pinned: './pinned.html',
          collection: './collection.html',
          tournament: './tournament.html',
        };
      })(),
      output: {
        // Vendor: third-party deps only; app-shared: app modules used across entries
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          const appSharedDirs = [
            '/src/client/components/',
            '/src/client/hooks/',
            '/src/client/utils/',
            '/src/shared/',
          ];
          if (appSharedDirs.some((p) => id.includes(p))) return 'shared';
        },
        // Ensure CSS doesn't inherit arbitrary shared chunk names like "errors"
        assetFileNames(assetInfo) {
          const baseName = Array.isArray(
            (assetInfo as { names?: unknown }).names
          )
            ? ((assetInfo as { names: string[] }).names[0] ?? '')
            : '';
          const ext = baseName.split('.').pop();
          if (ext === 'css') return 'assets/styles-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    minify: 'esbuild',
  },
});
