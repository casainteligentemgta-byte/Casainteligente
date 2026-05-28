import type { ValidacionPartida } from '@/types/inventario-obra';

export type { ValidacionPartida };

/**
 * Valida si la cantidad a imputar/sacar supera el techo de la partida.
 *
 * @param cantidadASacar - Cantidad nueva a asignar (p. ej. imputación en transferencia)
 * @param cantidadPresupuestada - Techo (`obra_partidas_materiales.cantidad_techo`)
 * @param cantidadAsignadaReal - Ya consumido/imputado en esa partida+material
 */
export function validarTechoPresupuestario(
  cantidadASacar: number,
  cantidadPresupuestada: number,
  cantidadAsignadaReal: number,
): ValidacionPartida {
  const sacar = Math.max(0, Number(cantidadASacar) || 0);
  const techo = Math.max(0, Number(cantidadPresupuestada) || 0);
  const asignado = Math.max(0, Number(cantidadAsignadaReal) || 0);

  const disponibleReal = techo - asignado;

  if (sacar <= disponibleReal) {
    return {
      permitido: true,
      diferencia: 0,
      porcentajeExceso: 0,
      requiereJustificacion: false,
    };
  }

  const exceso = sacar - disponibleReal;
  const porcentajeExceso =
    techo > 0 ? Math.round((exceso / techo) * 100) : sacar > 0 ? 100 : 0;

  return {
    permitido: false,
    diferencia: exceso,
    porcentajeExceso,
    requiereJustificacion: true,
  };
}

/**
 * Alias explícito para imputaciones: valida solo la cantidad nueva contra techo menos lo ya consumido.
 * Equivalente a `(v_consumido + cantidadNueva) > techo` en `inv_validar_imputacion_partida`.
 */
export function validarImputacionPartida(
  cantidadNueva: number,
  cantidadTecho: number,
  cantidadYaConsumida: number,
): ValidacionPartida {
  return validarTechoPresupuestario(cantidadNueva, cantidadTecho, cantidadYaConsumida);
}

/** Mapea fila UI → validación de techo. */
export function validarFilaDespachoPartida(
  cantidadASacar: number,
  fila: {
    cantidad_presupuestada: number;
    cantidad_asignada_real: number;
  },
): ValidacionPartida {
  return validarTechoPresupuestario(
    cantidadASacar,
    fila.cantidad_presupuestada,
    fila.cantidad_asignada_real,
  );
}

const MIN_JUSTIFICACION = 8;

/** Exceso permitido solo con justificación no vacía (alineado al trigger SQL). */
export function puedeAutorizarDespachoPartida(
  validacion: ValidacionPartida,
  justificacion: string,
): boolean {
  if (validacion.permitido) return true;
  if (!validacion.requiereJustificacion) return false;
  return justificacion.trim().length >= MIN_JUSTIFICACION;
}
