// Compila el CSS de la app (globals.css + utilidades Tailwind) sin red, con Tailwind 4 en modo compatible.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const tw = require('tailwindcss');
const TW = '/opt/npm-tools/node_modules/tailwindcss';

export async function compilarCss(repo, archivos) {
  let globals = fs.readFileSync(path.join(repo, 'app/globals.css'), 'utf8');
  globals = globals.replace(/@tailwind\s+(base|components|utilities);/g, '');
  const entrada = `
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities);
@config "./tailwind.config.js";
@layer base { *, ::before, ::after, ::backdrop { border-color: #e5e7eb; } }
${globals}
`;
  const compilador = await tw.compile(entrada, {
    base: repo,
    loadStylesheet: async (id, base) => {
      const p = id.startsWith('tailwindcss/') ? path.join(TW, id.slice('tailwindcss/'.length)) : path.resolve(base, id);
      return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
    },
    loadModule: async (id, base) => {
      const p = path.resolve(base, id);
      const Module = require('node:module');
      const orig = Module._load;
      // El plugin de animaciones no está instalado aquí: no afecta a los colores.
      Module._load = function (req, ...r) {
        if (req === 'tailwindcss-animate') return () => {};
        return orig.call(this, req, ...r);
      };
      try {
        delete require.cache[p];
        return { path: p, base: path.dirname(p), module: require(p) };
      } finally {
        Module._load = orig;
      }
    },
  });
  const candidatos = new Set();
  for (const a of archivos) {
    const txt = fs.readFileSync(a, 'utf8');
    for (const t of txt.split(/[\s"'`<>{}=;,()]+/)) if (t && t.length < 80) candidatos.add(t);
    // clases con paréntesis o comas dentro de corchetes: text-[var(--x)], bg-[rgb(var(--y)/0.1)]
    for (const m of txt.matchAll(/[A-Za-z0-9:!_\-./]*\[[^\]\s"'`]+\][A-Za-z0-9/.%\-]*/g)) candidatos.add(m[0]);
  }
  return compilador.build([...candidatos]);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const repo = process.argv[2];
  const css = await compilarCss(repo, process.argv.slice(3));
  fs.writeFileSync('salida.css', css);
  console.log('css bytes', css.length);
}
