/** Cálculos APU Lulo compartidos (importación + panel analítico + control de compras). */

export type CategoriaInsumoApu = 'equipo' | 'mano_obra' | 'material';

export type LineaApuCalculoInput = {
  cantidad_rendimiento: number;
  desperdicio_porcentaje: number;
  insumo: {
    precio_base: number;
    tipo: string | null;
  };
};

/** Normaliza tipo Lulo (M/E/P) a categoría analítica. */
export function clasificarInsumoApu(tipo: string | null | undefined): CategoriaInsumoApu {
  const t = String(tipo ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/^E|EQ|MAQ|EQUIPO/.test(t)) return 'equipo';
  if (/^P|MO|MANO|OBR|LAB|PER|HH/.test(t)) return 'mano_obra';
  if (/^M|MAT|INS|MATERIAL/.test(t)) return 'material';
  if (/EQUIPO|MAQUINARIA/.test(t)) return 'equipo';
  if (/MANO|PERSONAL|SALARIO|JORNAL/.test(t)) return 'mano_obra';
  return 'material';
}

/**
 * Costo unitario del insumo en la partida (reglas Lulo).
 * - Materiales: Rendimiento × Precio × (1 + Desperdicio/100)
 * - Equipos y MO: Rendimiento × Precio
 */
export function calcularCostoTotalInsumoApu(
  categoria: CategoriaInsumoApu,
  rendimiento: number,
  precioBase: number,
  desperdicioPct: number,
): number {
  const r = Number.isFinite(rendimiento) ? rendimiento : 0;
  const p = Number.isFinite(precioBase) ? precioBase : 0;
  const base = r * p;
  if (categoria === 'material') {
    const d = Number.isFinite(desperdicioPct) ? desperdicioPct : 0;
    return base * (1 + d / 100);
  }
  return base;
}

/** Costo unitario de materiales del APU (suma de líneas tipo material). */
export function calcularCostoUnitarioMaterialesApu(lineas: LineaApuCalculoInput[]): number {
  return lineas.reduce((sum, linea) => {
    const categoria = clasificarInsumoApu(linea.insumo.tipo);
    if (categoria !== 'material') return sum;
    return (
      sum +
      calcularCostoTotalInsumoApu(
        categoria,
        linea.cantidad_rendimiento,
        linea.insumo.precio_base,
        linea.desperdicio_porcentaje,
      )
    );
  }, 0);
}

/** Techo teórico de materiales = costo unitario materiales × cantidad de obra. */
export function calcularTechoTeoricoMaterialPartida(
  lineas: LineaApuCalculoInput[],
  cantidadPresupuestada: number,
): number {
  const cantidad = Number.isFinite(cantidadPresupuestada) ? cantidadPresupuestada : 0;
  const unitario = calcularCostoUnitarioMaterialesApu(lineas);
  return Math.round(unitario * cantidad * 100) / 100;
}
