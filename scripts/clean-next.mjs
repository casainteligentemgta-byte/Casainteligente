/**
 * Borra la carpeta .next (útil en Windows si build falla con EPERM).
 * En Windows intenta antes quitar solo `.next/trace` (suele bloquearse).
 */
import { existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextDir = join(root, '.next');
const traceFile = join(nextDir, 'trace');

if (!existsSync(nextDir)) {
  console.log('No existe .next, nada que borrar.');
  process.exit(0);
}

/** En Windows `cmd rmdir` a veces borra lo que Node no puede por locks en `trace`. */
function winRmdirNext() {
  if (process.platform !== 'win32') return false;
  try {
    execFileSync('cmd', ['/c', 'rmdir', '/s', '/q', nextDir], {
      stdio: 'pipe',
      windowsHide: true,
    });
    return !existsSync(nextDir);
  } catch {
    return false;
  }
}

if (process.platform === 'win32' && winRmdirNext()) {
  console.log('OK: eliminada carpeta .next (rmdir Windows)');
  process.exit(0);
}

try {
  if (existsSync(traceFile)) {
    try {
      rmSync(traceFile, { force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      /* sigue */
    }
  }
  rmSync(nextDir, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
  console.log('OK: eliminada carpeta .next');
} catch (e) {
  if (winRmdirNext()) {
    console.log('OK: eliminada carpeta .next (rmdir Windows, 2.º intento)');
    process.exit(0);
  }
  console.error(
    'No se pudo borrar .next (EPERM). Ejecuta `npm run ports:free`, cierra `npm run dev`/Cursor y reintenta.',
  );
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
