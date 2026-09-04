import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to inline small CSS into index.html to eliminate render-blocking external stylesheet requests
function inlineCssPlugin() {
  return {
    name: 'inline-css-plugin',
    enforce: 'post' as const,
    transformIndexHtml(html: string, { bundle }: any) {
      if (!bundle) return html;
      let result = html;
      for (const [key, value] of Object.entries(bundle)) {
        if (key.endsWith('.css') && (value as any).source) {
          const css = (value as any).source.toString();
          const regex = new RegExp(`<link[^>]*href=["'][^"']*${key}["'][^>]*>`, 'g');
          result = result.replace(regex, `<style>${css}</style>`);
        }
      }
      return result;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    inlineCssPlugin(),
  ],
  server: {
    fs: {
      strict: false,
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: {
    format: 'es',
  },
});
