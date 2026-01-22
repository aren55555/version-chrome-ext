import { build } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

const entries = ['content', 'popup', 'options'];

for (const entry of entries) {
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: entry === 'content',
      sourcemap: true,
      watch: isWatch ? {} : null,
      lib: {
        entry: resolve(__dirname, `src/${entry}.ts`),
        name: entry,
        formats: ['iife'],
        fileName: () => `${entry}.js`,
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
  });
}
