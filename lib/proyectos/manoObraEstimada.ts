import { calcularCompensacionDiaria } from '@/lib/nomina/compensacionDiaria';

/** Niveles de referencia para acotar el coste (banda baja / media / tope tabulador). */
const NIVELES_REF = [1, 5, 9] as const;

export type FilaManoObraEstimada = {
  nivel: number;
  etiqueta: string;
  /** Remuneración diaria + cesta ticket diario (VES) por obrero. */
  costoDiarioConCestaPorObrero: number;
  /** `costoDiarioConCestaPorObrero` × días × dotación (escenario lineal). */
  subtotalEstimado: number;
};

export function diasCalendarioInclusive(inicioISO: string, finISO: string): number {
  const a = new Date(`${inicioISO}T12:00:00`);
  const b = new Date(`${finISO}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  const ms = b.getTime() - a.getTime();
  const diff = Math.floor(ms / 86_400_000) + 1;
  return Math.max(1, diff);
}

/**
 * Tabla resumen de costo de mano de obra estimado (convención construcción 2023 + cesta ticket por defecto).
 * Es orientativa: asume dotación constante y jornal según nivel de referencia.
 */
export function filasManoObraEstimada(
  diasCalendario: number,
  obreros: number,
): FilaManoObraEstimada[] {
  const d = Math.max(1, Math.floor(diasCalendario));
  const o = Math.max(1, Math.floor(obreros));

  return NIVELES_REF.map((nivel) => {
    const c = calcularCompensacionDiaria(nivel);
    const diario = Math.round((c.totalDiarioVES + c.cestaTicketDiarioVES) * 100) / 100;
    const subtotal = Math.round(diario * d * o * 100) / 100;
    const etiqueta =
      nivel === 1
        ? 'Nivel 1 (banda baja)'
        : nivel === 5
          ? 'Nivel 5 (referencia media)'
          : 'Nivel 9 (tope tabulador)';
    return {
      nivel,
      etiqueta,
      costoDiarioConCestaPorObrero: diario,
      subtotalEstimado: subtotal,
    };
  });
}
