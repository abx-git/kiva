import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'dist');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? '';
  const connectSrc = ["'self'"];
  if (supabaseUrl) {
    try {
      connectSrc.push(new URL(supabaseUrl).origin);
    } catch {
      /* ignore invalid URL at build time */
    }
  }

  const CSP = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(' ')}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return {
    base: '/kiva/',
    envDir: __dirname,
    build: {
      outDir: OUT_DIR,
      emptyOutDir: true,
    },
    plugins: [
      {
        name: 'kiva-csp-prod',
        transformIndexHtml(html, ctx) {
          if (ctx.server) return html;
          const tag = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
          return html.replace('</head>', `    ${tag}\n  </head>`);
        },
      },
    ],
  };
});
