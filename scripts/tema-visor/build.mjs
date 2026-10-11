/**
 * Arma una copia de las pantallas con datos inventados, sin red ni base de datos,
 * para poder fotografiarlas en claro y en oscuro (ver README.md de esta carpeta).
 * Uso: node scripts/tema-visor/build.mjs && node scripts/tema-visor/shot.mjs <carpeta-de-capturas>
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { compilarCss } from './tw.mjs';
const require = createRequire('/opt/npm-tools/node_modules/');
const esbuild = require('esbuild');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const REPO = process.argv[2] ?? path.resolve(AQUI, '../..');
const SALIDA = process.env.VISOR_SALIDA ?? path.join(os.tmpdir(), 'ci-visor');
fs.mkdirSync(SALIDA, { recursive: true });

const STUBS = {
  'next/link': 'stubs/next-link.tsx',
  'next/navigation': 'stubs/next-navigation.ts',
  '@tanstack/react-query': 'stubs/react-query.ts',
  'lucide-react': 'stubs/lucide.tsx',
  sonner: 'stubs/sonner.ts',
  '@/lib/supabase/client': 'stubs/supabase-client.ts',
  '@dnd-kit/core': 'stubs/dnd-kit.tsx',
  '@dnd-kit/sortable': 'stubs/dnd-kit.tsx',
  '@dnd-kit/utilities': 'stubs/dnd-kit.tsx',
};
const EXT = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx'];
const plugin = {
  name: 'visor',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (STUBS[a.path]) return { path: path.join(AQUI, STUBS[a.path]) };
      if (a.path.startsWith('@/')) {
        const base = path.join(REPO, a.path.slice(2));
        for (const e of EXT) if (fs.existsSync(base + e) && fs.statSync(base + e).isFile()) return { path: base + e };
      }
      return null;
    });
  },
};
const meta = await esbuild.build({
  entryPoints: [path.join(AQUI, 'entry.tsx')],
  bundle: true, format: 'esm', splitting: true, outdir: SALIDA, jsx: 'automatic', metafile: true,
  nodePaths: ['/opt/npm-tools/node_modules', '/home/claude/.npm-global/lib/node_modules'], plugins: [plugin], logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"development"' },
});
const fuentes = Object.keys(meta.metafile.inputs).filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.includes('node_modules')).map((f) => path.resolve(f));
fuentes.push(path.join(REPO, 'app/layout.tsx'), path.join(REPO, 'components/AppChrome.tsx'));
let css = await compilarCss(REPO, fuentes);
const extra = path.join(REPO, 'app/tema-claro.css');
if (fs.existsSync(extra)) css += '\n' + fs.readFileSync(extra, 'utf8');
fs.writeFileSync(path.join(SALIDA, 'app.css'), css);
fs.writeFileSync(path.join(SALIDA, 'index.html'), '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="app.css"></head><body><div id="raiz"></div><script type="module" src="entry.js"></script></body></html>');
console.log('ok', fuentes.length, 'fuentes;', css.length, 'bytes css');
