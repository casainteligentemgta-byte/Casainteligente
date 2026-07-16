import { createHash } from 'crypto';
import {
  cadenaLlaveNaturalCompra,
  type CamposLlaveNaturalCompra,
} from '@/lib/contabilidad/compraLlaveNatural';

export type { CamposLlaveNaturalCompra };
export { cadenaLlaveNaturalCompra, mismaLlaveNaturalCompra } from '@/lib/contabilidad/compraLlaveNatural';

/** SHA-256 hex de la llave natural (solo Node / API routes). */
export function hashLlaveNaturalCompra(campos: CamposLlaveNaturalCompra): string {
  const canon = cadenaLlaveNaturalCompra(campos);
  return createHash('sha256').update(canon, 'utf8').digest('hex');
}
