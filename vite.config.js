import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        article: resolve(process.cwd(), 'article.html'),
        policy: resolve(process.cwd(), 'policy.html')
      }
    }
  }
});