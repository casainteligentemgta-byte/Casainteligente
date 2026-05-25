import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import type { LuloEstructuradoParse } from '@/lib/proyectos/parseLuloMdbEstructurado';
import {
  calcularCostoUnitarioDirectoApu,
  type LineaApuCalculoInput,
} from '@/lib/proyectos/apuCalculos';
import { montoPartidaDesdeCantidadPrecio } from '@/lib/utils/numericDbLimits';

export type DatosApuParaMontos = Pick<LuloEstructuradoParse, 'insumos' | 'apu'>;

/**
 * Cuando PARTIDAS trae CanPar/DesPar pero PrePar/MonPar en cero (común en Lulo),
 * calcula precio unitario y monto desde COMPOSICION + INSUMOS.
 */
export function enriquecerMontosPartidasDesdeApu(
  partidas: PartidaLuloInsert[],
  datos: DatosApuParaMontos,
): PartidaLuloInsert[] {
  if (partidas.length === 0 || datos.apu.length === 0 || datos.insumos.length === 0) {
    return partidas;
  }

  const insumoByCod = new Map(
    datos.insumos.map((i) => [i.codigo.trim().toUpperCase(), i]),
  );

  const apuByPartida = new Map<string, LineaApuCalculoInput[]>();
  for (const line of datos.apu) {
    const ins = insumoByCod.get(line.codigo_insumo.trim().toUpperCase());
    if (!ins) continue;
    const pk = line.codigo_partida.trim().toUpperCase();
    const list = apuByPartida.get(pk) ?? [];
    list.push({
      cantidad_rendimiento: line.cantidad_rendimiento,
      desperdicio_porcentaje: line.desperdicio_porcentaje,
      insumo: { precio_base: ins.precio_base, tipo: ins.tipo },
    });
    apuByPartida.set(pk, list);
  }

  if (apuByPartida.size === 0) return partidas;

  return partidas.map((p) => {
    const precioOk = Number(p.precio_unitario_estimado) > 0;
    const montoOk = Number(p.monto_total_estimado) > 0;
    if (precioOk && montoOk) return p;

    const lineas = apuByPartida.get(p.codigo_partida.trim().toUpperCase());
    if (!lineas?.length) return p;

    const unitario = calcularCostoUnitarioDirectoApu(lineas);
    if (unitario <= 0) return p;

    const cantidad = Number(p.cantidad_presupuestada) || 0;
    const precio = precioOk ? Number(p.precio_unitario_estimado) : unitario;
    const monto = montoOk
      ? Number(p.monto_total_estimado)
      : montoPartidaDesdeCantidadPrecio(cantidad, precio);

    return {
      ...p,
      precio_unitario_estimado: precio,
      monto_total_estimado: monto,
    };
  });
}

export function partidasNecesitanMontosApu(partidas: PartidaLuloInsert[]): boolean {
  if (partidas.length === 0) return false;
  const conMonto = partidas.filter((p) => Number(p.monto_total_estimado) > 0).length;
  return conMonto < Math.max(1, Math.floor(partidas.length * 0.05));
}
