import { toPgNumeric15_2 } from '@/lib/utils/numericDbLimits';

export type MargenesLuloObra = {
  porcentaje_admin?: number | null;
  porcentaje_utilidad?: number | null;
  porcentaje_fcm?: number | null;
};

/** Costo directo unitario → P.U. venta (admin + utilidad, reglas panel APU Lulo). */
export function precioUnitarioVentaDesdeCostoDirecto(
  costoDirecto: number,
  margenes?: MargenesLuloObra,
): number {
  const cd = Number.isFinite(costoDirecto) ? costoDirecto : 0;
  if (cd <= 0) return 0;
  const pctAdmin = Number(margenes?.porcentaje_admin ?? 0);
  const pctUtilidad = Number(margenes?.porcentaje_utilidad ?? 0);
  const totalAdministracion = cd * (pctAdmin / 100);
  const totalUtilidad = (cd + totalAdministracion) * (pctUtilidad / 100);
  return toPgNumeric15_2(cd + totalAdministracion + totalUtilidad);
}
