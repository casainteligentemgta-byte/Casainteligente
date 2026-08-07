import { cedulaDigitosCore, normCedulaToken } from '@/lib/talento/cedulaAuth';

/**
 * Extrae el núcleo numérico de cédula desde un nombre de archivo.
 * Acepta p.ej. `V-12345678.pdf`, `V12345678_firmado.jpg`, `contrato 12.345.678.pdf`.
 */
export function cedulaDigitosDesdeNombreArchivo(filename: string): string | null {
  const base = filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[_\s]+/g, ' ').trim();
  if (!cleaned) return null;

  // Preferir patrón con prefijo V/E
  const conLetra = cleaned.match(/\b([VE])[\s.\-]?(\d{6,9})\b/i);
  if (conLetra) {
    const dig = cedulaDigitosCore(`${conLetra[1]}${conLetra[2]}`);
    return dig.length >= 6 ? dig : null;
  }

  // Solo dígitos (con o sin puntos/guiones)
  const soloNums = cleaned.match(/(?:\d[.\-]?){6,9}/);
  if (soloNums) {
    const dig = cedulaDigitosCore(soloNums[0]);
    return dig.length >= 6 ? dig : null;
  }

  const fallback = cedulaDigitosCore(normCedulaToken(cleaned));
  return fallback.length >= 6 ? fallback : null;
}

export function contratoCoincideConNombreArchivo(
  obreroCedula: string,
  filename: string,
): boolean {
  const fromFile = cedulaDigitosDesdeNombreArchivo(filename);
  if (!fromFile) return false;
  const fromRow = cedulaDigitosCore(obreroCedula);
  return fromRow.length >= 6 && fromRow === fromFile;
}
