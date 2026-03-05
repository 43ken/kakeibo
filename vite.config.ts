import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages では /リポジトリ名/ がベースになる
// ローカル開発時は '/' のまま
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png'],
      manifest: {
        name: '家計簿アプリ',
        short_name: '家計簿',
        description: 'シンプル家計管理 - オフライン対応',
        theme_color: '#007AFF',
        background_color: '#F2F2F7',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // ── App-shell precaching ──────────────────────────────────────────────
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,

        // New SW activates immediately and claims all open tabs.
        // main.tsx listens for 'controllerchange' and reloads the page,
        // ensuring users always run the latest JS bundle after an update.
        clientsClaim: true,
        skipWaiting: true,

        // ── Runtime caching ───────────────────────────────────────────────────
        // All Firebase / Google API calls must go directly to the network.
        // Firestore uses gRPC-Web streams (not SW-interceptable), but Auth
        // token refresh and REST fallback calls use plain HTTPS that the SW
        // CAN intercept. NetworkOnly ensures the SW never serves a stale
        // token or a cached Firestore response.
        runtimeCaching: [
          // Firestore REST API & gRPC-Web streaming endpoint
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
          // Firebase Auth — Identity Toolkit (signIn, getUser, etc.)
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
          // Firebase Auth — Secure Token Service (token refresh)
          {
            urlPattern: /^https:\/\/securetoken\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
          // Firebase platform services (Storage, Remote Config, etc.)
          {
            urlPattern: /^https:\/\/firebase\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
          // Catch-all: any other *.googleapis.com endpoint
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
          // Google Sign-In / OAuth
          {
            urlPattern: /^https:\/\/accounts\.google\.com\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
});
