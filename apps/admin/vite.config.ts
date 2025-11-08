import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { compression } from 'vite-plugin-compression2';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = mode === 'development';
  const isProd = mode === 'production';
  
  return {
    plugins: [
      react(),
      isProd && compression({ algorithm: 'gzip', ext: '.gz' }),
      isProd && compression({ algorithm: 'brotliCompress', ext: '.br' })
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@utils': resolve(__dirname, './src/utils'),
        '@pages': resolve(__dirname, './src/pages'),
        '@services': resolve(__dirname, './src/services'),
        '@icupa/ui': resolve(__dirname, '../../packages/ui/src'),
        '@icupa/db': resolve(__dirname, '../../packages/db/src'),
        '@icupa/types': resolve(__dirname, '../../packages/types/src')
      }
    },
    server: { port: 8081, host: true, open: true },
    build: {
      outDir: 'dist',
      sourcemap: isDev,
      minify: isProd ? 'terser' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'supabase': ['@supabase/supabase-js', '@supabase/auth-helpers-react'],
            'ui-components': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
            'charts': ['recharts', 'd3-scale', 'd3-shape'],
            'utils': ['date-fns', 'clsx', 'tailwind-merge']
          }
        }
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@supabase/supabase-js', '@tanstack/react-query']
    }
  };
});
