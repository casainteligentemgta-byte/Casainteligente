/**
 * Evita mezclar artefactos de `next build` con `next dev` (causa "Cannot find module './1682.js'").
 * Si detecta build de producción en .next, borra la carpeta antes de arrancar dev.
 */
import { existsSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextDir = join(root, '.next');
const buildId = join(nextDir, 'BUILD_ID');

if (!existsSync(buildId)) {
  process.exit(0);
}

console.warn(
  '[dev] Se detectó .next de producción (BUILD_ID). Limpiando para evitar chunks rotos en desarrollo…',
);
try {
  rmSync(nextDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 });
  console.log('[dev] OK: .next eliminada. Iniciando compilación en frío.');
} catch (e) {
  console.warn(
    '[dev] No se pudo borrar .next automáticamente. Ejecute: npm run ports:free && npm run clean:next',
  );
  console.warn(e instanceof Error ? e.message : e);
  process.exit(1);
}
