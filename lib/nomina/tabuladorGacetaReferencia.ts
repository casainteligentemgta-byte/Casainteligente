import { CARGOS_OBREROS } from '@/lib/constants/cargosObreros';
import { SALARIO_BASICO_DIARIO_VES_POR_NIVEL } from '@/lib/nomina/tabuladorSalariosConstruccion2023';

/** Texto corto para UI y columna `tabulador_referencia` al poblar desde la app. */
export const TABULADOR_GACETA_ETIQUETA =
  'GOE N° 6.752 — Conv. Colectiva Construcción (homologación 20-06-2023)';

/** Fecha de referencia del tabulador numérico (SB diario por nivel 1–9). */
export const TABULADOR_GACETA_VIGENCIA_ISO = '2023-06-20';

export type FilaTabuladorGacetaReferencia = {
  nivel: number;
  codigo: string;
  nombre: string;
  salarioBasicoDiarioVes: number;
  /** Referencia mensual SB × 30 (convención de pantalla; nómina puede usar otra base). */
  salarioBasicoMensualRef30: number;
};

function salarioBasicoDiarioPorNivel(nivel: number): number {
  const i = Math.min(9, Math.max(1, Math.floor(nivel))) - 1;
  return SALARIO_BASICO_DIARIO_VES_POR_NIVEL[i] ?? 0;
}

/** Filas del anexo «Oficios y Salarios» + SB diario del tabulador por nivel salarial. */
export function filasTabuladorGacetaReferencia(): FilaTabuladorGacetaReferencia[] {
  return CARGOS_OBREROS.map((c) => {
    const diario = salarioBasicoDiarioPorNivel(c.nivel);
    return {
      nivel: c.nivel,
      codigo: c.codigo,
      nombre: c.nombre,
      salarioBasicoDiarioVes: diario,
      salarioBasicoMensualRef30: Math.round(diario * 30 * 100) / 100,
    };
  });
}

export function compararCodigoOficio(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10));
  const pb = b.split('.').map((x) => Number.parseInt(x, 10));
  const m = Math.max(pa.length, pb.length);
  for (let i = 0; i < m; i++) {
    const da = Number.isFinite(pa[i]) ? pa[i]! : 0;
    const db = Number.isFinite(pb[i]) ? pb[i]! : 0;
    if (da !== db) return da - db;
  }
  return 0;
}
