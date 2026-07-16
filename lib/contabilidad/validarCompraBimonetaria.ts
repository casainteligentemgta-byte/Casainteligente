/** Tolerancia mínima en bolívares al validar monto_ves ≈ monto_usd × tasa. */
export const TOLERANCIA_COHERENCIA_BIMONETARIA_VES = 0.05;

/**
 * Tolerancia efectiva: al convertir VES→USD con 2 decimales, el error máximo
 * teórico es ~media céntima de USD × tasa (p. ej. tasa 5000 ⇒ ~25 Bs).
 * La tolerancia fija ±0.05 fallaba en importaciones CSV con tasas altas.
 */
export function toleranciaCoherenciaBimonetaria(tasaBcvFecha: number): number {
  const tasa = Number(tasaBcvFecha);
  if (!(tasa > 0) || !Number.isFinite(tasa)) {
    return TOLERANCIA_COHERENCIA_BIMONETARIA_VES;
  }
  // 0.005 USD × tasa + margen float
  return Math.max(TOLERANCIA_COHERENCIA_BIMONETARIA_VES, tasa * 0.005 + 0.02);
}

export type ErrorValidacionBimonetaria = {
  ok: false;
  error: string;
  hint: string;
};

export type MontosBimonetariosValidados = {
  ok: true;
  montoVes: number;
  montoUsd: number;
  tasaBcvFecha: number;
  tasaFuente: 'cliente' | 'ci_config_nomina';
};

export type ResultadoValidacionBimonetaria =
  | MontosBimonetariosValidados
  | ErrorValidacionBimonetaria;

/** Parsea montos/tasas desde JSON (acepta coma decimal). */
export function parseMontoBimonetario(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  const s = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function validarCoherenciaBimonetaria(
  montoVes: number,
  montoUsd: number,
  tasaBcvFecha: number,
  tolerancia?: number,
): { ok: true } | ErrorValidacionBimonetaria {
  if (!(tasaBcvFecha > 0)) {
    return {
      ok: false,
      error: 'La tasa BCV debe ser un número mayor que cero.',
      hint: 'Envía tasa_bcv_fecha en el body o configura la fila GLOBAL en ci_config_nomina.',
    };
  }

  const tol =
    tolerancia != null && Number.isFinite(tolerancia) && tolerancia >= 0
      ? tolerancia
      : toleranciaCoherenciaBimonetaria(tasaBcvFecha);

  const esperadoVes = montoUsd * tasaBcvFecha;
  const diff = Math.abs(montoVes - esperadoVes);

  if (diff > tol) {
    return {
      ok: false,
      error: `Incoherencia bimonetaria: monto_ves (${montoVes.toFixed(2)}) no coincide con monto_usd × tasa_bcv_fecha (${esperadoVes.toFixed(2)}).`,
      hint: `Diferencia ${diff.toFixed(4)} Bs (tolerancia ±${tol.toFixed(2)}). Verifica montos y tasa del día de la factura.`,
    };
  }

  return { ok: true };
}

export function validarMontosCompraBimonetarios(input: {
  montoVes: number | null;
  montoUsd: number | null;
  tasaBcvFecha: number | null;
  tasaFuente: 'cliente' | 'ci_config_nomina';
}): ResultadoValidacionBimonetaria {
  if (input.montoVes == null) {
    return {
      ok: false,
      error: 'El campo monto_ves es obligatorio.',
      hint: 'Incluye el total de la factura en bolívares (número ≥ 0).',
    };
  }
  if (input.montoUsd == null) {
    return {
      ok: false,
      error: 'El campo monto_usd es obligatorio.',
      hint: 'Incluye el equivalente en USD de la factura (número ≥ 0).',
    };
  }
  if (input.tasaBcvFecha == null) {
    return {
      ok: false,
      error: 'No se pudo resolver la tasa BCV.',
      hint:
        'Envía tasa_bcv_fecha en el body o registra la fila GLOBAL (cargo_codigo GLOBAL) en ci_config_nomina con tasa_bcv_ves_por_usd.',
    };
  }

  const coherencia = validarCoherenciaBimonetaria(
    input.montoVes,
    input.montoUsd,
    input.tasaBcvFecha,
  );
  if (!coherencia.ok) return coherencia;

  return {
    ok: true,
    montoVes: input.montoVes,
    montoUsd: input.montoUsd,
    tasaBcvFecha: input.tasaBcvFecha,
    tasaFuente: input.tasaFuente,
  };
}
