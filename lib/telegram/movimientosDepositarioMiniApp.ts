/**
 * Movimientos de obra para la Mini App del depositario (solo lectura).
 * Acceso: el depositario asignado a la obra (ci_proyectos.depositario_id) y el administrador.
 * No se entregan precios ni costos: solo materiales, cantidades y quién recibió.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { obtenerUsuarioSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';

const LIMITE = 40;

export type AccesoMovimientos =
  | { ok: true; obras: Array<{ id: string; nombre: string }>; esAdmin: boolean }
  | { ok: false; error: string };

export async function resolverAccesoMovimientosTelegram(
  supabase: SupabaseClient,
  telegramId: string,
): Promise<AccesoMovimientos> {
  const chat = Number(telegramId);
  if (!Number.isFinite(chat)) return { ok: false, error: 'Usuario no válido' };

  try {
    const usuario = await obtenerUsuarioSistemaTelegram(supabase, chat);
    if (usuario?.rol === 'Administrador') {
      const { data } = await supabase.from('ci_proyectos').select('id,nombre').limit(500);
      const obras = ((data ?? []) as Array<{ id: string; nombre: string | null }>).map((p) => ({
        id: String(p.id),
        nombre: String(p.nombre ?? 'Obra'),
      }));
      return { ok: true, obras, esAdmin: true };
    }
  } catch {
    /* sin tabla de usuarios: se decide por depositario */
  }

  const { data: empleados } = await supabase
    .from('ci_empleados')
    .select('id')
    .eq('telegram_chat_id', chat);
  const ids = ((empleados ?? []) as Array<{ id: string }>).map((e) => String(e.id)).filter(Boolean);
  if (!ids.length) return { ok: false, error: 'Esta página es solo para depositarios de obra.' };

  const { data: proyectos } = await supabase
    .from('ci_proyectos')
    .select('id,nombre')
    .in('depositario_id', ids);
  const obras = ((proyectos ?? []) as Array<{ id: string; nombre: string | null }>).map((p) => ({
    id: String(p.id),
    nombre: String(p.nombre ?? 'Obra'),
  }));
  if (!obras.length) return { ok: false, error: 'No tiene obras asignadas como depositario.' };
  return { ok: true, obras, esAdmin: false };
}

export type MovimientoMiniApp = {
  id: string;
  fecha: string;
  tipo: 'entrada' | 'salida' | 'pendiente';
  obra: string;
  titulo: string;
  estado: string;
  lineas: Array<{ descripcion: string; cantidad: number; unidad: string }>;
};

export type DatosMovimientosMiniApp = {
  generado_at: string;
  movimientos: MovimientoMiniApp[];
};

function nombreObra(obras: Array<{ id: string; nombre: string }>, id: string | null): string {
  return obras.find((o) => o.id === id)?.nombre ?? 'Obra';
}

export async function listarMovimientosMiniApp(
  supabase: SupabaseClient,
  obras: Array<{ id: string; nombre: string }>,
): Promise<DatosMovimientosMiniApp> {
  const ids = obras.map((o) => o.id);
  const movimientos: MovimientoMiniApp[] = [];
  if (!ids.length) return { generado_at: new Date().toISOString(), movimientos };

  // Precargas pendientes de ingreso (las que el comprador cargó y aún no están en el almacén).
  const { data: pendientes } = await supabase
    .from('ci_notas_precargadas')
    .select('id,proyecto_id,proveedor_nombre,num_doc,fecha,lineas,created_at')
    .in('proyecto_id', ids)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })
    .limit(LIMITE);
  for (const p of (pendientes ?? []) as Array<Record<string, unknown>>) {
    const lineas = Array.isArray(p.lineas) ? (p.lineas as Array<Record<string, unknown>>) : [];
    movimientos.push({
      id: `np-${p.id}`,
      fecha: String(p.fecha ?? p.created_at ?? '').slice(0, 10),
      tipo: 'pendiente',
      obra: nombreObra(obras, String(p.proyecto_id)),
      titulo: `${String(p.proveedor_nombre ?? 'Proveedor')} · ${String(p.num_doc ?? 'S/N')}`,
      estado: 'Pendiente de ingreso',
      lineas: lineas.map((l) => ({
        descripcion: String(l.descripcion ?? l.material_nombre ?? ''),
        cantidad: Number(l.cantidad) || 0,
        unidad: String(l.unidad ?? ''),
      })),
    });
  }

  // Entradas (recepciones de campo).
  const { data: recepciones } = await supabase
    .from('ci_recepciones_campo')
    .select('id,proyecto_id,num_doc,proveedor_nombre,estado,created_at')
    .in('proyecto_id', ids)
    .order('created_at', { ascending: false })
    .limit(LIMITE);
  const recIds = ((recepciones ?? []) as Array<{ id: string }>).map((r) => String(r.id));
  const lineasRec = new Map<string, Array<{ descripcion: string; cantidad: number; unidad: string }>>();
  if (recIds.length) {
    const { data: ll } = await supabase
      .from('ci_recepciones_campo_lineas')
      .select('recepcion_id,descripcion,cantidad,unidad')
      .in('recepcion_id', recIds);
    for (const l of (ll ?? []) as Array<Record<string, unknown>>) {
      const k = String(l.recepcion_id);
      const arr = lineasRec.get(k) ?? [];
      arr.push({
        descripcion: String(l.descripcion ?? ''),
        cantidad: Number(l.cantidad) || 0,
        unidad: String(l.unidad ?? ''),
      });
      lineasRec.set(k, arr);
    }
  }
  for (const r of (recepciones ?? []) as Array<Record<string, unknown>>) {
    movimientos.push({
      id: `re-${r.id}`,
      fecha: String(r.created_at ?? '').slice(0, 10),
      tipo: 'entrada',
      obra: nombreObra(obras, String(r.proyecto_id)),
      titulo: `${String(r.proveedor_nombre ?? 'Ingreso')} · ${String(r.num_doc ?? 'S/N')}`,
      estado: String(r.estado ?? 'Registrada'),
      lineas: lineasRec.get(String(r.id)) ?? [],
    });
  }

  // Salidas a obrero.
  const { data: egresos } = await supabase
    .from('inv_egresos_campo')
    .select('id,proyecto_id,fecha_egreso,obrero_nombre,stock_aplicado,created_at')
    .in('proyecto_id', ids)
    .order('created_at', { ascending: false })
    .limit(LIMITE);
  const egIds = ((egresos ?? []) as Array<{ id: string }>).map((e) => String(e.id));
  const lineasEg = new Map<string, Array<{ descripcion: string; cantidad: number; unidad: string }>>();
  if (egIds.length) {
    const { data: le } = await supabase
      .from('inv_egresos_campo_lineas')
      .select('egreso_id,material_nombre,cantidad,unidad')
      .in('egreso_id', egIds);
    for (const l of (le ?? []) as Array<Record<string, unknown>>) {
      const k = String(l.egreso_id);
      const arr = lineasEg.get(k) ?? [];
      arr.push({
        descripcion: String(l.material_nombre ?? ''),
        cantidad: Number(l.cantidad) || 0,
        unidad: String(l.unidad ?? ''),
      });
      lineasEg.set(k, arr);
    }
  }
  for (const e of (egresos ?? []) as Array<Record<string, unknown>>) {
    movimientos.push({
      id: `eg-${e.id}`,
      fecha: String(e.fecha_egreso ?? e.created_at ?? '').slice(0, 10),
      tipo: 'salida',
      obra: nombreObra(obras, String(e.proyecto_id)),
      titulo: `Entregado a ${String(e.obrero_nombre ?? 'obrero')}`,
      estado: e.stock_aplicado ? 'Stock descontado' : 'Sin descuento',
      lineas: lineasEg.get(String(e.id)) ?? [],
    });
  }

  movimientos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  return { generado_at: new Date().toISOString(), movimientos: movimientos.slice(0, LIMITE * 3) };
}
