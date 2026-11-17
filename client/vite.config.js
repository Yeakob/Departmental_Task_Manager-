import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const API = process.env.VITE_API_PROXY || 'http://localhost:5000';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'theme-init.js'],
      manifest: {
        name: 'DWMT — Departmental Work Management',
        short_name: 'DWMT',
        description: 'Departmental work management and task tracking',
        theme_color: '#1F6B52',
        background_color: '#F5F7F6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/, /^\/socket\.io/],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/uploads': { target: API, changeOrigin: true },
      '/socket.io': { target: API, ws: true, changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          calendar: ['@fullcalendar/core', '@fullcalendar/react', '@fullcalendar/daygrid', '@fullcalendar/timegrid', '@fullcalendar/list', '@fullcalendar/interaction', '@fullcalendar/multimonth'],
          editor: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-link', '@tiptap/extension-placeholder', '@tiptap/extension-underline'],
          exports: ['xlsx', 'jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
});
