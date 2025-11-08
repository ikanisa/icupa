import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = mode === 'development';
  const isProd = mode === 'production';
  
  return {
    plugins: [
      react({
        fastRefresh: true,
        babel: {
          plugins: [
            ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
          ]
        }
      }),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: isDev,
          type: 'module'
        },
        includeAssets: [
          'favicon.ico',
          'robots.txt',
          'apple-touch-icon.png',
          'safari-pinned-tab.svg'
        ],
        manifest: {
          name: 'ICUPA Client',
          short_name: 'ICUPA',
          description: 'In-venue ordering system',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/pwa-72x72.png', sizes: '72x72', type: 'image/png' },
            { src: '/pwa-96x96.png', sizes: '96x96', type: 'image/png' },
            { src: '/pwa-128x128.png', sizes: '128x128', type: 'image/png' },
            { src: '/pwa-144x144.png', sizes: '144x144', type: 'image/png' },
            { src: '/pwa-152x152.png', sizes: '152x152', type: 'image/png' },
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-384x384.png', sizes: '384x384', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,gif,webp,woff,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'supabase-storage',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api',
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        }
      }),
      isProd && visualizer({
        filename: './dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@utils': resolve(__dirname, './src/utils'),
        '@pages': resolve(__dirname, './src/pages'),
        '@services': resolve(__dirname, './src/services'),
        '@stores': resolve(__dirname, './src/stores'),
        '@types': resolve(__dirname, './src/types'),
        '@icupa/ui': resolve(__dirname, '../../packages/ui/src'),
        '@icupa/db': resolve(__dirname, '../../packages/db/src'),
        '@icupa/types': resolve(__dirname, '../../packages/types/src'),
        '@icupa/utils': resolve(__dirname, '../../packages/utils/src')
      }
    },
    server: {
      port: 8080,
      host: true,
      open: true,
      proxy: {
        '/api': {
          target: env.VITE_SUPABASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    preview: { port: 8080, host: true },
    build: {
      outDir: 'dist',
      sourcemap: isDev,
      minify: isProd ? 'terser' : false,
      terserOptions: isProd ? {
        compress: { drop_console: true, drop_debugger: true }
      } : undefined,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) return 'react';
              if (id.includes('@supabase')) return 'supabase';
              if (id.includes('@tanstack')) return 'query';
              if (id.includes('@radix-ui') || id.includes('class-variance-authority')) return 'ui';
              return 'vendor';
            }
          }
        }
      },
      chunkSizeWarningLimit: 1000,
      reportCompressedSize: false
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js', '@tanstack/react-query'],
      exclude: ['@icupa/ui', '@icupa/db']
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    }
  };
});
