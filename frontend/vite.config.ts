/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // Iconos generados desde public/aura.svg (ver pwa-assets.config.ts)
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        id: '/',
        name: 'AURA TALENT AI',
        short_name: 'AURA',
        description: 'Plataforma inteligente de talento, empleabilidad y reclutamiento asistida por IA.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        theme_color: '#050507',
        background_color: '#050507',
        categories: ['business', 'productivity', 'education'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        // Los modelos de vision (~20 MB) se descargan solo al activar la camara y luego se guardan en cache
        globIgnores: ['**/mediapipe/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/health/],
        cleanupOutdatedCaches: true,
        // Nunca cachear el API: contiene datos personales y de sesion
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/health'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/mediapipe/'),
            handler: 'CacheFirst',
            options: { cacheName: 'aura-mediapipe', expiration: { maxEntries: 8 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Mismo origen para el API: la cookie de refresh (SameSite=strict) funciona sin CORS
    proxy: {
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Separa las librerias grandes en chunks propios: descarga paralela
        // y mejor cacheo (el codigo de la app cambia mas que los vendors).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (
            id.includes('@react-three') ||
            id.includes('/three/') ||
            id.includes('three-stdlib') ||
            id.includes('/maath/')
          )
            return 'three'
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('react-router') ||
            id.includes('/scheduler/')
          )
            return 'react-vendor'
          if (
            id.includes('/motion/') ||
            id.includes('/gsap/') ||
            id.includes('lucide-react')
          )
            return 'ui'
          if (id.includes('@tanstack') || id.includes('zustand')) return 'data'
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
