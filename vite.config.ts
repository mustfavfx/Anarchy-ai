import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri configuration
  clearScreen: false,
  server: {
    port: 5173,
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
        configureServer(server) {
          server.middlewares.use((_options, _req, _res, next) => {
            if (_req.url?.startsWith('/api')) {
              _res.setHeader('Access-Control-Allow-Origin', '*');
            }
            next();
          });
          server.middlewares.use('/api', (_req, _res, next) => {
            _res.setHeader('Access-Control-Allow-Origin', '*');
            next();
          });
          server.middlewares.use('/api', (_req, _res, next) => {
            _res.setHeader('Access-Control-Allow-Origin', '*');
            next();
          });
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to:', req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from:', req.url, '->', proxyRes.statusCode);
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
