import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // Tauri configuration
    clearScreen: false,
    server: {
      port: 5174,
      strictPort: false,
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
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || 'https://ejzsbkxpqmhpjuqmszvd.supabase.co'
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqenNia3hwcW1ocGp1cW1zenZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjEzNjIsImV4cCI6MjA5MzE5NzM2Mn0.lbKXt_BLTNXjTKpmqdPLvU6vC-mWNjbVRYjfSGFVZcc'
      )
    },
    build: {
      target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari16",
      minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
      sourcemap: !!process.env.TAURI_DEBUG,
    },
    worker: {
      format: 'es',
    },
  };
})
