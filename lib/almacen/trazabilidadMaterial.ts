import type { SupabaseClient } from '@supabase/supabase-js';
import type { TipoMovimientoInventario } from '@/lib/almacen/aplicarDeltaStockInventario';

export type TrayectoriaMovimiento = {
  id: string;
  evento: string;
  descripcion: string;
  fecha: string;
  ubicacion: string | null;
  cantidad: number;
  observaciones: string | null;
  referencia_tipo: string | null;
  documento_id: string | null;
};

export type MovimientoJourneyTipo =
  | 'INGRESO_COMPRA'
  | 'TRASPASO_PRESTAMO'
  | 'DEVOLUCION_PRESTAMO'
  | 'CONSUMO_OBRA'
  | 'AJUSTE_AUDITORIA';

export type MovimientoJourney = {
  id: string;
  tipo: MovimientoJourneyTipo;
  cantidad: number;
  origen: string;
  destino: string;
  fecha: string;
  responsable: string;
  notas: string;
};

function etiquetaResponsable(referenciaTipo: string | null): string {
  const r = String(referenciaTipo ?? '').trim().toLowerCase();
  if (!r) return 'Sistema de inventario';
  if (r.includes('compras_factura')) return 'Compras / recepción';
  if (r.includes('egreso') || r.includes('salida')) return 'Egreso en obra';
  if (r.includes('transfer')) return 'Traspaso entre almacenes';
  if (r.includes('telegram')) return 'Telegram';
  return referenciaTipo?.trim() || 'Sistema de inventario';
}

/** Convierte filas del ledger a eventos de la línea de tiempo UI (origen → destino). */
export function trayectoriaAMovimientosJourney(filas: TrayectoriaMovimiento[]): MovimientoJourney[] {
  const out: MovimientoJourney[] = [];

  for (let i = 0; i < filas.length; i++) {
    const r = filas[i];
    const qty = Math.round(Math.abs(r.cantidad) * 10000) / 10000;
    const ubi = r.ubicacion?.trim() || '—';
    const notas = r.observaciones?.trim() || '';
    const responsable = etiquetaResponsable(r.referencia_tipo);
    const evt = r.evento;

    if (evt === 'transferencia_salida') {
      const next = filas[i + 1];
      const pareja =
        next?.evento === 'transferencia_entrada' &&
        Math.abs(Math.abs(next.cantidad) - qty) < 0.0001;
      if (pareja) {
        out.push({
          id: `${r.id}-${next.id}`,
          tipo: 'TRASPASO_PRESTAMO',
          cantidad: qty,
          origen: ubi,
          destino: next.ubicacion?.trim() || '—',
          fecha: next.fecha,
          responsable: etiquetaResponsable(next.referencia_tipo) || responsable,
          notas: [notas, next.observaciones?.trim()].filter(Boolean).join(' · '),
        });
        i += 1;
        continue;
      }
      out.push({
        id: r.id,
        tipo: 'TRASPASO_PRESTAMO',
        cantidad: qty,
        origen: ubi,
        destino: 'En tránsito',
        fecha: r.fecha,
        responsable,
        notas,
      });
      continue;
    }

    if (evt === 'transferencia_entrada') {
      const prev = filas[i - 1];
      const yaPareado =
        prev?.evento === 'transferencia_salida' &&
        out.length > 0 &&
        out[out.length - 1].id.includes(prev.id);
      if (yaPareado) continue;

      const esDevolucion = prev?.evento === 'transferencia_salida';
      out.push({
        id: r.id,
        tipo: esDevolucion ? 'DEVOLUCION_PRESTAMO' : 'TRASPASO_PRESTAMO',
        cantidad: qty,
        origen: prev?.ubicacion?.trim() || 'Origen anterior',
        destino: ubi,
        fecha: r.fecha,
        responsable,
        notas,
      });
      continue;
    }

    if (evt === 'ingreso_compra' || evt === 'recepcion_campo') {
      out.push({
        id: r.id,
        tipo: 'INGRESO_COMPRA',
        cantidad: qty,
        origen: 'Proveedor / externo',
        destino: ubi,
        fecha: r.fecha,
        responsable,
        notas,
      });
      continue;
    }

    if (evt === 'salida_obra') {
      out.push({
        id: r.id,
        tipo: 'CONSUMO_OBRA',
        cantidad: qty,
        origen: ubi,
        destino: 'Consumo en obra',
        fecha: r.fecha,
        responsable,
        notas,
      });
      continue;
    }

    out.push({
      id: r.id,
      tipo: 'AJUSTE_AUDITORIA',
      cantidad: qty,
      origen: r.cantidad < 0 ? ubi : 'Ajuste',
      destino: r.cantidad >= 0 ? ubi : 'Ajuste',
      fecha: r.fecha,
      responsable,
      notas: notas || r.descripcion,
    });
  }

  return out;
}

type MovRow = {
  id: string;
  tipo_movimiento: string;
  delta_disponible: number | null;
  delta_reservada: number | null;
  delta_transito_entrante: number | null;
  created_at: string;
  notas: string | null;
  referencia_tipo: string | null;
  documento_id: string | null;
  ubicacion?: { nombre?: string | null; tipo?: string | null } | { nombre?: string | null; tipo?: string | null }[] | null;
};

const ETIQUETAS_TIPO: Record<TipoMovimientoInventario, string> = {
  ingreso_compra: 'Ingreso por compra',
  transferencia_salida: 'Traspaso (salida)',
  transferencia_entrada: 'Traspaso (entrada)',
  recepcion_campo: 'Recepción en campo',
  salida_obra: 'Salida / consumo en obra',
  ajuste: 'Ajuste de inventario',
  anulacion: 'Anulación',
};

function nombreUbicacion(raw: MovRow['ubicacion']): string {
  const u = Array.isArray(raw) ? raw[0] : raw;
  return String(u?.nombre ?? '').trim();
}

function cantidadPrincipal(m: MovRow): number {
  const d = Number(m.delta_disponible) || 0;
  if (d !== 0) return d;
  const r = Number(m.delta_reservada) || 0;
  if (r !== 0) return r;
  return Number(m.delta_transito_entrante) || 0;
}

function etiquetaEvento(tipo: string): string {
  const t = tipo as TipoMovimientoInventario;
  return ETIQUETAS_TIPO[t] ?? tipo.replace(/_/g, ' ');
}

function descripcionMovimiento(m: MovRow): string {
  const ubi = nombreUbicacion(m.ubicacion) || 'Ubicación';
  const qty = Math.abs(cantidadPrincipal(m));
  const signo = cantidadPrincipal(m) >= 0 ? '+' : '−';
  const tipo = m.tipo_movimiento;

  if (tipo === 'ingreso_compra') {
    return `${signo}${qty} unidad(es) ingresaron a [${ubi}]`;
  }
  if (tipo === 'transferencia_entrada') {
    return `${signo}${qty} unidad(es) entraron a [${ubi}]`;
  }
  if (tipo === 'transferencia_salida') {
    return `${signo}${qty} unidad(es) salieron de [${ubi}]`;
  }
  if (tipo === 'salida_obra') {
    return `${signo}${qty} unidad(es) egresaron desde [${ubi}] (consumo en obra)`;
  }
  if (tipo === 'recepcion_campo') {
    return `${signo}${qty} unidad(es) recibidas en [${ubi}]`;
  }
  if (tipo === 'anulacion') {
    return `Anulación: ${signo}${qty} en [${ubi}]`;
  }
  return `${signo}${qty} unidad(es) en [${ubi}] (${etiquetaEvento(tipo)})`;
}

export async function listarTrayectoriaMaterial(
  supabase: SupabaseClient,
  materialId: string,
): Promise<{ trayectoria: TrayectoriaMovimiento[]; material?: { nombre: string; codigo: string | null } }> {
  const mid = materialId.trim();
  if (!mid) throw new Error('Falta el identificador del material.');

  const { data: mat, error: matErr } = await supabase
    .from('global_inventory')
    .select('id, name, sap_code')
    .eq('id', mid)
    .maybeSingle();

  if (matErr && matErr.code !== '42P01') throw new Error(matErr.message);

  const { data, error } = await supabase
    .from('inv_movimientos')
    .select(
      `
      id,
      tipo_movimiento,
      delta_disponible,
      delta_reservada,
      delta_transito_entrante,
      created_at,
      notas,
      referencia_tipo,
      documento_id,
      ubicacion:inv_ubicaciones ( nombre, tipo )
    `,
    )
    .eq('material_id', mid)
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === '42P01') {
      throw new Error('Ledger inv_movimientos no disponible. Aplique migración 203 en Supabase.');
    }
    throw new Error(error.message);
  }

  const trayectoria = (data ?? []).map((row) => {
    const m = row as MovRow;
    const ubi = nombreUbicacion(m.ubicacion);
    return {
      id: m.id,
      evento: m.tipo_movimiento,
      descripcion: descripcionMovimiento(m),
      fecha: m.created_at,
      ubicacion: ubi || null,
      cantidad: cantidadPrincipal(m),
      observaciones: m.notas?.trim() || null,
      referencia_tipo: m.referencia_tipo?.trim() || null,
      documento_id: m.documento_id ? String(m.documento_id) : null,
    };
  });

  return {
    trayectoria,
    material: mat
      ? {
          nombre: String(mat.name ?? 'Material'),
          codigo: mat.sap_code ? String(mat.sap_code) : null,
        }
      : undefined,
  };
}
