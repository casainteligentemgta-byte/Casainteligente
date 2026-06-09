import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { obtenerCapituloMaestroPorId } from '@/lib/compras/capitulosMaestro';
import type { PrioridadProcura } from '@/lib/compras/viaRapidaProcura';
import { evaluarViaRapidaProcura } from '@/lib/compras/viaRapidaProcura';
import type { UsuarioSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { enviarAlertaProcuraPendienteAdmin } from '@/lib/procuras/alertaAdminProcuraTelegram';
import { normalizarUnidadProcura } from '@/lib/procuras/unidadesProcura';
import type { EstadoProcura } from '@/lib/procuras/procuraEstados';

export type RegistrarProcuraDepartamentoInput = {
  usuario: UsuarioSistemaTelegram;
  capituloMaestroId: string;
  descripcionMaterial: string;
  cantidad: number;
  unidad: string;
  prioridad: PrioridadProcura;
  montoEstimadoUsd?: number | null;
  esConsumible?: boolean;
  observaciones?: string | null;
};

export type RegistrarProcuraDepartamentoResult = {
  id: string;
  ticket: string;
  estado: EstadoProcura;
  viaRapida: boolean;
  motivoVia: string;
};

export async function registrarProcuraDepartamento(
  supabase: SupabaseClient,
  input: RegistrarProcuraDepartamentoInput,
): Promise<{ data: RegistrarProcuraDepartamentoResult | null; error: Error | null }> {
  const capitulo = await obtenerCapituloMaestroPorId(supabase, input.capituloMaestroId);
  if (!capitulo) {
    return { data: null, error: new Error('Capítulo no válido.') };
  }

  const materialTxt = input.descripcionMaterial.trim().slice(0, 500);
  if (!materialTxt) {
    return { data: null, error: new Error('Indique la descripción del material.') };
  }

  const cantidad = input.cantidad;
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { data: null, error: new Error('Cantidad inválida.') };
  }

  const via = await evaluarViaRapidaProcura(supabase, {
    descripcionMaterial: materialTxt,
    montoEstimadoUsd: input.montoEstimadoUsd ?? null,
    esConsumible: input.esConsumible ?? false,
  });

  const estado: EstadoProcura = via.califica ? 'aprobada_directa' : 'solicitada';
  const proyectoId = input.usuario.proyecto_id?.trim() || null;
  let entidadId: string | null = null;
  if (proyectoId) {
    entidadId = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);
  }

  const obsParts: string[] = [];
  if (input.observaciones?.trim()) obsParts.push(input.observaciones.trim());
  obsParts.push(`Capítulo: ${capitulo.codigo} — ${capitulo.nombre}`);
  obsParts.push(`Prioridad: ${input.prioridad}`);
  if (via.califica) obsParts.push(`Vía rápida: ${via.motivo}`);
  const observaciones = obsParts.join('\n').slice(0, 2000);

  const row: Record<string, unknown> = {
    material_txt: materialTxt,
    cantidad,
    unidad: normalizarUnidadProcura(input.unidad),
    estado,
    prioridad: input.prioridad,
    capitulo_maestro_id: capitulo.id,
    monto_estimado_usd: input.montoEstimadoUsd ?? null,
    es_consumible: Boolean(input.esConsumible),
    via_rapida: via.califica,
    observaciones,
    solicitante_nombre: input.usuario.nombre.slice(0, 150),
    solicitante_telegram_chat_id: input.usuario.telegram_id,
  };

  if (proyectoId) row.proyecto_id = proyectoId;
  if (entidadId) row.entidad_id = entidadId;

  const { data, error } = await supabase
    .from('ci_procuras')
    .insert(row as never)
    .select('id, ticket, estado, via_rapida')
    .single();

  if (error) {
    const hint = /capitulo_maestro|prioridad|aprobada_directa|42P01|schema cache/i.test(error.message)
      ? ' Ejecute migración 230_ci_compras_departamento_telegram.sql y NOTIFY pgrst.'
      : '';
    return { data: null, error: new Error(`${error.message}${hint}`) };
  }

  const out = data as { id: string; ticket: string; estado: EstadoProcura; via_rapida?: boolean };

  if (!via.califica && out.id) {
    void enviarAlertaProcuraPendienteAdmin(supabase, String(out.id)).catch((e) => {
      console.warn('[registrarProcuraDepartamento] alerta', e);
    });
  }

  return {
    data: {
      id: String(out.id),
      ticket: String(out.ticket ?? ''),
      estado: out.estado,
      viaRapida: Boolean(out.via_rapida),
      motivoVia: via.motivo,
    },
    error: null,
  };
}

/** Aprobador / Administrador: cambia estado Pendiente → Aprobada o Rechazada. */
export async function resolverProcuraDepartamento(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    accion: 'aprobar' | 'rechazar';
    aprobadorTelegramId: number;
    aprobadorNombre: string;
    motivoRechazo?: string | null;
  },
): Promise<{ ok: boolean; ticket?: string; estado?: string; error?: string }> {
  const nuevoEstado = params.accion === 'rechazar' ? 'rechazada' : 'aprobada';
  const motivo =
    params.accion === 'rechazar'
      ? params.motivoRechazo?.trim() ||
        `Rechazada por ${params.aprobadorNombre} (Telegram ${params.aprobadorTelegramId})`
      : `Aprobada por ${params.aprobadorNombre} (Telegram ${params.aprobadorTelegramId})`;

  const { data, error } = await supabase.rpc(
    'procesar_procuras_lote' as 'ci_registrar_ingreso_manual_campo',
    {
      p_ids: [params.procuraId.trim()],
      p_nuevo_estado: nuevoEstado,
      p_motivo: motivo,
    } as never,
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  if (params.accion === 'rechazar') {
    await supabase
      .from('ci_procuras')
      .update({ motivo_rechazo: motivo.slice(0, 2000) } as never)
      .eq('id', params.procuraId.trim());
  }

  const filas = (data ?? []) as Array<{ ticket: string; nuevo_est: string }>;
  return {
    ok: true,
    ticket: filas[0]?.ticket,
    estado: filas[0]?.nuevo_est ?? nuevoEstado,
  };
}
