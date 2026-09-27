import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      // Express owns the HTTP listener and mounts Vite in middleware mode.
      // `hmr.clientPort: 0` tells the browser client to open the HMR socket
      // against the page's own host/port, so it attaches to that same Express
      // listener. Without it Vite falls back to the fixed default 24678 for a
      // second websocket server, which fails whenever anything else holds it.
      hmr: process.env.DISABLE_HMR === 'true' ? false : { clientPort: 0 },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
