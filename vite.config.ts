import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'strip-remote-script-loaders',
      generateBundle(_options, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type !== 'chunk') continue;
          file.code = file.code.replaceAll('/js/telegram-login.js', '/js/disabled-telegram');
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@marsidev/react-turnstile': resolve('stubs/empty-captcha.js'),
      '@hcaptcha/react-hcaptcha': resolve('stubs/empty-captcha.js'),
      '@stripe/stripe-js': resolve('stubs/empty-stripe.js'),
      '@stripe/crypto': resolve('stubs/empty-stripe-crypto.js'),
      buffer: 'buffer',
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        popup: resolve('popup.html'),
        auth: resolve('auth.html'),
        offscreen: resolve('offscreen.html'),
        background: resolve('src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
