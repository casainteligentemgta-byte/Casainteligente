/**
 * Payload para crear una obra (`ci_proyectos`) a partir de un presupuesto aceptado.
 * El INSERT dispara el trigger 388 (`ci_asegurar_almacen_obra`).
 */
import { ESTADOS_PRESUPUESTO_ACEPTADO } from '@/lib/clientes/presupuestosCliente';
import { numeroPresupuesto } from './datosPresupuesto';

export const ESTADOS_CONVERTIR_OBRA = ESTADOS_PRESUPUESTO_ACEPTADO;

export function puedeConvertirEnObra(status: string | null | undefined): boolean {
  return (ESTADOS_CONVERTIR_OBRA as readonly string[]).includes(String(status ?? '').trim());
}

export function nombreObraDesdePresupuesto(opts: {
  cliente: string;
  numero: string | number | null | undefined;
}): string {
  const nro = numeroPresupuesto(opts.numero);
  const cliente = String(opts.cliente ?? '').trim() || 'Cliente';
  return `Obra ${cliente} — ${nro}`;
}

export function payloadObraDesdePresupuesto(opts: {
  customerId: string | null | undefined;
  entidadId: string | null | undefined;
  budgetId: string;
  nombre: string;
  ubicacion?: string | null;
  montoUsd: number;
  status: string | null | undefined;
}): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (!puedeConvertirEnObra(opts.status)) {
    return { ok: false, error: 'Solo se convierte en obra un presupuesto aprobado, por pagar o pagado.' };
  }
  const customerId = String(opts.customerId ?? '').trim();
  if (!customerId) {
    return { ok: false, error: 'El presupuesto no tiene cliente. Átalo a un cliente antes de crear la obra.' };
  }
  const entidadId = String(opts.entidadId ?? '').trim();
  if (!entidadId) {
    return { ok: false, error: 'Elige la entidad (patrono / empresa que ejecuta la obra).' };
  }
  const nombre = String(opts.nombre ?? '').trim();
  if (!nombre) {
    return { ok: false, error: 'Indica el nombre de la obra.' };
  }
  const budgetId = String(opts.budgetId ?? '').trim();
  if (!budgetId) {
    return { ok: false, error: 'Falta el presupuesto.' };
  }
  const monto = Number(opts.montoUsd);
  const montoFinal = Number.isFinite(monto) && monto >= 0 ? Math.round(monto * 100) / 100 : 0;
  const ubicacion = String(opts.ubicacion ?? '').trim() || 'Por definir';

  return {
    ok: true,
    payload: {
      customer_id: customerId,
      entidad_id: entidadId,
      budget_id: budgetId,
      nombre,
      nombre_proyecto: nombre,
      ubicacion_texto: ubicacion,
      monto_aproximado: montoFinal,
      moneda: 'USD',
      tipo_proyecto: 'integral',
      estado: 'nuevo',
    },
  };
}
