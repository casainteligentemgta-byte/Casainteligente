/**
 * Borra la carpeta .next (útil en Windows si build falla con EPERM:
 * cierra antes `npm run dev` y vuelve a compilar).
 */
import { existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextDir = join(root, '.next');
if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log('OK: eliminada carpeta .next');
} else {
  console.log('No existe .next, nada que borrar.');
}
