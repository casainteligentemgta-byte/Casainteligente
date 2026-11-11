import type { SupabaseClient } from '@supabase/supabase-js';
import { esAdminGlobalRoles } from '@/lib/clientes/entidadActiva';
import { entidadesIdsDesdeRoles } from '@/lib/clientes/clienteEntidades';
import { listarRolesEmpresaUsuario } from '@/lib/auth/ciUsuariosRolesDb';
import { resolverUsuarioAuthDesdeTelegram } from '@/lib/telegram/resolverUsuarioAuthTelegram';
import { EntidadConNombre, SELECT_NOMBRE_ENTIDAD, nombreEntidad } from '@/lib/entidades/nombreEntidad';
import { todayIsoVenezuela } from '@/lib/contabilidad/comprasFiltros';
import {
  CREDITOS_POR_PAGINA,
  CREDITO_COMPROBANTES_BUCKET,
  ROLES_TELEGRAM_CREDITO,
  armarCreditosAbiertos,
  creditoQuedaPagado,
  creditoVisibleEnAlcance,
  redondearUsd,
  rolTelegramPuedeCredito,
  saldoCredito,
  validarMontoPago,
  type AlcanceEntidadesCredito,
  type CompraCreditoRow,
  type CreditoAbierto,
  type FacturaCreditoRow,
  type PagoCreditoRow,
} from '@/lib/contabilidad/creditoPagos';
import { sumasPagoPorFactura, tablaAusente } from '@/lib/contabilidad/creditoPagosConsulta';
import {
  exigirUsuarioSistemaTelegram,
  obtenerUsuarioSistemaTelegram,
  usuarioEsAdministradorProcura,
  type RolComprasTelegram,
  type UsuarioSistemaTelegram,
} from '@/lib/compras/usuariosSistemaTelegram';
import { permisosEnforcementActivo, resolverActorTelegram, type ActorPermisos } from '@/lib/auth/permisos';
import { normalizarRolEmpresa } from '@/lib/auth/permisosCatalogo';

const SELECT_FACTURA =
  'id,invoice_number,supplier_name,entidad_id,proyecto_id,fecha_vencimiento,dias_credito,date,total_amount,total_amount_usd,monto_usd,moneda,condicion_pago';
const SELECT_COMPRA =
  'id,purchase_invoice_id,entidad_id,invoice_number,supplier_name,total_amount,total_amount_usd,monto_usd,moneda';

export async function alcanceEntidadesCreditoWeb(
  actor: ActorPermisos,
  supabase: SupabaseClient,
): Promise<AlcanceEntidadesCredito> {
  if (esAdminGlobalRoles(actor.rolesEmpresa)) {
    return { todas: true, entidadIds: [] };
  }
  if (!actor.userId) return { todas: false, entidadIds: [] };
  const roles = await listarRolesEmpresaUsuario(supabase, actor.userId);
  return { todas: false, entidadIds: entidadesIdsDesdeRoles(roles) };
}

export async function alcanceEntidadesCreditoTelegram(
  supabase: SupabaseClient,
  chatId: string | number,
  usuario?: UsuarioSistemaTelegram | null,
): Promise<AlcanceEntidadesCredito> {
  const u = usuario ?? (await obtenerUsuarioSistemaTelegram(supabase, chatId).catch(() => null));
  if (u && usuarioEsAdministradorProcura(u)) {
    return { todas: true, entidadIds: [] };
  }

  const ids = new Set<string>();
  try {
    const authId = await resolverUsuarioAuthDesdeTelegram(supabase, String(chatId));
    if (authId) {
      const roles = await listarRolesEmpresaUsuario(supabase, authId);
      if (esAdminGlobalRoles(roles.map((r) => String(r.rol)))) {
        return { todas: true, entidadIds: [] };
      }
      for (const id of entidadesIdsDesdeRoles(roles)) ids.add(id);
    }
  } catch {
    /* sin mapping auth */
  }

  const actor = await resolverActorTelegram(supabase, chatId).catch(() => null);
  if (actor && esAdminGlobalRoles(actor.rolesEmpresa)) {
    return { todas: true, entidadIds: [] };
  }

  const proyectoIds = new Set<string>();
  if (u?.proyecto_id) proyectoIds.add(u.proyecto_id);
  for (const r of actor?.rolesObra ?? []) {
    if (r.proyectoId) proyectoIds.add(r.proyectoId);
  }
  if (proyectoIds.size) {
    const { data } = await supabase
      .from('ci_proyectos')
      .select('id,entidad_id')
      .in('id', Array.from(proyectoIds));
    for (const p of data ?? []) {
      const eid = String((p as { entidad_id?: string | null }).entidad_id ?? '').trim();
      if (eid) ids.add(eid);
    }
  }

  if (ids.size) return { todas: false, entidadIds: Array.from(ids) };
  // Comprador/contador del bot sin entidad asignada: ve el listado (si no, /credito quedaría vacío).
  return { todas: true, entidadIds: [] };
}

async function nombresEntidad(
  supabase: SupabaseClient,
  entidadIds: string[],
): Promise<Record<string, string>> {
  const ids = entidadIds.filter(Boolean);
  if (!ids.length) return {};
  const { data } = await supabase.from('ci_entidades').select(SELECT_NOMBRE_ENTIDAD).in('id', ids);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as EntidadConNombre;
    out[String(r.id)] = nombreEntidad(r, 'Empresa');
  }
  return out;
}

export async function listarCreditosAbiertos(
  supabase: SupabaseClient,
  alcance: AlcanceEntidadesCredito,
  hoyIso = todayIsoVenezuela(),
): Promise<CreditoAbierto[]> {
  const { data: facturas, error } = await supabase
    .from('purchase_invoices')
    .select(SELECT_FACTURA)
    .eq('condicion_pago', 'credito');
  if (error) {
    if (tablaAusente(error.message)) return [];
    throw new Error(error.message);
  }

  const filas = (facturas ?? []) as FacturaCreditoRow[];
  const ids = filas.map((f) => f.id).filter(Boolean);
  if (!ids.length) return [];

  const comprasPorChunk: CompraCreditoRow[] = [];
  const pagosPorChunk: PagoCreditoRow[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const [{ data: compras, error: cErr }, { data: pagos, error: pErr }] = await Promise.all([
      supabase.from('contabilidad_compras').select(SELECT_COMPRA).in('purchase_invoice_id', chunk),
      supabase.from('contabilidad_credito_pagos').select('purchase_invoice_id,monto_usd').in('purchase_invoice_id', chunk),
    ]);
    if (cErr && !tablaAusente(cErr.message)) throw new Error(cErr.message);
    if (pErr && !tablaAusente(pErr.message)) throw new Error(pErr.message);
    comprasPorChunk.push(...((compras ?? []) as CompraCreditoRow[]));
    if (!pErr) pagosPorChunk.push(...((pagos ?? []) as PagoCreditoRow[]));
  }

  const entidadIds = new Set<string>();
  for (const f of filas) if (f.entidad_id) entidadIds.add(String(f.entidad_id));
  for (const c of comprasPorChunk) if (c.entidad_id) entidadIds.add(String(c.entidad_id));

  return armarCreditosAbiertos({
    facturas: filas,
    compras: comprasPorChunk,
    pagos: pagosPorChunk,
    nombresEntidad: await nombresEntidad(supabase, Array.from(entidadIds)),
    hoyIso,
    alcance,
  });
}

export async function cargarCreditoAbierto(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  alcance: AlcanceEntidadesCredito,
  hoyIso = todayIsoVenezuela(),
): Promise<CreditoAbierto | null> {
  const id = purchaseInvoiceId.trim();
  if (!id) return null;
  const lista = await listarCreditosAbiertos(supabase, alcance, hoyIso);
  return lista.find((c) => c.purchaseInvoiceId === id) ?? null;
}

export type RegistrarPagoCreditoParams = {
  purchaseInvoiceId: string;
  montoUsd?: number | null;
  fechaPago?: string | null;
  referencia?: string | null;
  nombre: string;
  telegramChatId?: string | number | null;
  userId?: string | null;
  comprobante?: {
    path: string;
    fileName: string;
    mimeType: string;
  } | null;
};

export async function registrarPagoCredito(
  supabase: SupabaseClient,
  alcance: AlcanceEntidadesCredito,
  params: RegistrarPagoCreditoParams,
): Promise<{ credito: CreditoAbierto; montoUsd: number; quedaPagado: boolean }> {
  const credito = await cargarCreditoAbierto(supabase, params.purchaseInvoiceId, alcance);
  if (!credito) {
    throw new Error('Crédito no encontrado o ya pagado.');
  }
  if (!creditoVisibleEnAlcance(credito.entidadId, alcance)) {
    throw new Error('No puede pagar créditos de otra entidad.');
  }
  const monto = params.montoUsd != null ? redondearUsd(Number(params.montoUsd)) : credito.saldoUsd;
  const errMonto = validarMontoPago(monto, credito.saldoUsd);
  if (errMonto) throw new Error(errMonto);

  const fecha = String(params.fechaPago ?? '').slice(0, 10) || todayIsoVenezuela();
  const chatNum = params.telegramChatId != null ? Number(params.telegramChatId) : null;

  const { error } = await supabase.from('contabilidad_credito_pagos').insert({
    purchase_invoice_id: credito.purchaseInvoiceId,
    contabilidad_compra_id: credito.contabilidadCompraId,
    monto_usd: monto,
    fecha_pago: fecha,
    pagado_por_nombre: params.nombre.trim() || null,
    pagado_por_telegram_chat_id: Number.isFinite(chatNum) ? Math.trunc(chatNum!) : null,
    pagado_por_user_id: params.userId?.trim() || null,
    referencia: params.referencia?.trim() || null,
    comprobante_storage_path: params.comprobante?.path ?? null,
    comprobante_file_name: params.comprobante?.fileName ?? null,
    comprobante_mime_type: params.comprobante?.mimeType ?? null,
  });
  if (error) throw new Error(error.message);

  const pagadoUsd = redondearUsd(credito.pagadoUsd + monto);
  return {
    credito: { ...credito, pagadoUsd, saldoUsd: saldoCredito(credito.totalUsd, pagadoUsd) },
    montoUsd: monto,
    quedaPagado: creditoQuedaPagado(credito.totalUsd, pagadoUsd),
  };
}

export async function subirComprobanteCredito(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  file: { buffer: Buffer; mimeType: string; fileName: string },
): Promise<{ path: string; fileName: string; mimeType: string }> {
  const ext = (file.fileName.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
  const path = `${purchaseInvoiceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(CREDITO_COMPROBANTES_BUCKET).upload(path, file.buffer, {
    contentType: file.mimeType || 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, fileName: file.fileName, mimeType: file.mimeType };
}

export async function exigirPermisoCreditoTelegram(
  supabase: SupabaseClient,
  chatId: string | number,
): Promise<
  | { ok: true; usuario: UsuarioSistemaTelegram; alcance: AlcanceEntidadesCredito }
  | { ok: false; error: string }
> {
  const auth = await exigirUsuarioSistemaTelegram(supabase, chatId, {
    permitirRoles: [...ROLES_TELEGRAM_CREDITO] as RolComprasTelegram[],
  });
  if (!auth.ok) {
    return {
      ok: false,
      error:
        '⛔ Solo comprador, administrador o contador pueden ver créditos. Pida el acceso al administrador.',
    };
  }
  if (!rolTelegramPuedeCredito(auth.usuario.rol)) {
    return { ok: false, error: `⛔ Rol «${auth.usuario.rol}» no autoriza /credito.` };
  }
  const alcance = await alcanceEntidadesCreditoTelegram(supabase, chatId, auth.usuario);
  return { ok: true, usuario: auth.usuario, alcance };
}

export function actorWebPuedePagarCredito(actor: ActorPermisos): boolean {
  if (!permisosEnforcementActivo()) return true;
  if (actor.permisos.has('compra.credito_pagar')) return true;
  const roles = actor.rolesEmpresa.map((r) => normalizarRolEmpresa(r)).filter(Boolean);
  return roles.some((r) => r === 'admin' || r === 'comprador' || r === 'contador');
}

export { CREDITOS_POR_PAGINA, sumasPagoPorFactura };
