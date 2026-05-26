import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri configuration
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      '/api/replicate': {
        target: 'https://api.replicate.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/replicate/, '/v1'),
        secure: false,
        // Forward all headers including Authorization
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite Proxy] Error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[Vite Proxy] ->', req.method, req.url, '->', 'https://api.replicate.com' + proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[Vite Proxy] <-', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  worker: {
    format: 'es',
  },
})
