import type {
  LuloWebErpApuPartida,
  LuloWebErpConfig,
  LuloWebErpEquipo,
  LuloWebErpManoObra,
  LuloWebErpMaterial,
} from '@/types/lulo-web-erp';

export type ResultadoApuLuloWin = {
  totalMateriales: number;
  totalSalariosDiarios: number;
  totalBonosDiarios: number;
  costoPrestaciones: number;
  totalManoObraDiaria: number;
  costoUnitarioManoObra: number;
  costoEquiposDiariosDirectos: number;
  herramientaMenorDiaria: number;
  totalEquiposDiarios: number;
  costoUnitarioEquipos: number;
  costoDirectoUnitario: number;
  montoAdmin: number;
  montoUtilidad: number;
  precioUnitarioFinal: number;
};

/** Cálculo APU estilo LuloWin (rendimiento diario en MO y equipos). */
export function calcularApuLuloWin(
  apu: LuloWebErpApuPartida,
  rendimiento: number,
  config: LuloWebErpConfig,
): ResultadoApuLuloWin {
  const ren = rendimiento > 0 ? rendimiento : 1;

  const totalMateriales = apu.materiales.reduce(
    (sum, item) => sum + item.cantidad * item.precio,
    0,
  );

  const totalSalariosDiarios = apu.manoObra.reduce(
    (sum, item) => sum + item.cantidad * item.salario,
    0,
  );
  const totalBonosDiarios = apu.manoObra.reduce(
    (sum, item) => sum + item.cantidad * item.bono,
    0,
  );

  const costoPrestaciones =
    totalSalariosDiarios * (config.prestacionesSociales / 100);
  const totalManoObraDiaria =
    totalSalariosDiarios + costoPrestaciones + totalBonosDiarios;
  const costoUnitarioManoObra = totalManoObraDiaria / ren;

  const costoEquiposDiariosDirectos = apu.equipos.reduce((sum, item) => {
    if (item.esPorcentajeManoObra) return sum;
    return sum + item.cantidad * item.tarifa;
  }, 0);

  const herramientaMenorDiaria = totalManoObraDiaria * 0.05;
  const totalEquiposDiarios = costoEquiposDiariosDirectos + herramientaMenorDiaria;
  const costoUnitarioEquipos = totalEquiposDiarios / ren;

  const costoDirectoUnitario =
    totalMateriales + costoUnitarioManoObra + costoUnitarioEquipos;
  const montoAdmin = costoDirectoUnitario * (config.gastosAdministrativos / 100);
  const montoUtilidad =
    (costoDirectoUnitario + montoAdmin) * (config.utilidad / 100);
  const precioUnitarioFinal = costoDirectoUnitario + montoAdmin + montoUtilidad;

  return {
    totalMateriales,
    totalSalariosDiarios,
    totalBonosDiarios,
    costoPrestaciones,
    totalManoObraDiaria,
    costoUnitarioManoObra,
    costoEquiposDiariosDirectos,
    herramientaMenorDiaria,
    totalEquiposDiarios,
    costoUnitarioEquipos,
    costoDirectoUnitario,
    montoAdmin,
    montoUtilidad,
    precioUnitarioFinal,
  };
}

export function apuVacio(): LuloWebErpApuPartida {
  return { materiales: [], equipos: [], manoObra: [] };
}
