import type { SupabaseClient } from '@supabase/supabase-js';
import { getTelegramAllowedChatIds } from '@/lib/telegram/botApi';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';

export type FilaTelegramWhitelist = {
  id: string;
  chat_id: number;
  nombre: string;
  cargo: string | null;
  telefono: string | null;
  email: string | null;
  proyecto_id: string | null;
  empleado_id: string | null;
  nomina_id: string | null;
  origen: 'manual' | 'nomina' | 'empleado';
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_WHITELIST =
  'id,chat_id,nombre,cargo,telefono,email,proyecto_id,empleado_id,nomina_id,origen,activo,notas,created_at,updated_at';

function mapFilaTelegramWhitelist(r: Record<string, unknown>): FilaTelegramWhitelist {
  return {
    id: String(r.id),
    chat_id: Number(r.chat_id),
    nombre: String(r.nombre ?? '').trim() || 'Sin nombre',
    cargo: r.cargo != null ? String(r.cargo).trim() || null : null,
    telefono: r.telefono != null ? String(r.telefono).trim() || null : null,
    email: r.email != null ? String(r.email).trim() || null : null,
    proyecto_id: r.proyecto_id != null ? String(r.proyecto_id) : null,
    empleado_id: r.empleado_id != null ? String(r.empleado_id) : null,
    nomina_id: r.nomina_id != null ? String(r.nomina_id) : null,
    origen: (r.origen as FilaTelegramWhitelist['origen']) ?? 'manual',
    activo: Boolean(r.activo),
    notas: r.notas != null ? String(r.notas).trim() || null : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

const CACHE_TTL_MS = 60_000;
let cacheAllowed: { ids: Set<string>; expiresAt: number } | null = null;

export function invalidarCacheWhitelistTelegram(): void {
  cacheAllowed = null;
}

function whitelistEnforcedByEnv(): boolean {
  return (
    process.env.TELEGRAM_WHITELIST_ENFORCED === 'true' ||
    process.env.TELEGRAM_WHITELIST_ENFORCED === '1'
  );
}

export function parseTelegramChatIdInput(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function cargarChatIdsAutorizadosDb(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();

  const [{ data: lista }, { data: nomina }, { data: usuariosCompras }] = await Promise.all([
    supabase
      .from('ci_telegram_whitelist')
      .select('chat_id')
      .eq('activo', true),
    supabase
      .from('ci_proyecto_nomina')
      .select('telegram_chat_id, empleado_id, ci_empleados(telegram_chat_id)')
      .eq('activo', true),
    supabase
      .from('ci_usuarios_sistema_telegram')
      .select('telegram_id')
      .eq('activo', true),
  ]);

  for (const row of lista ?? []) {
    const cid = (row as { chat_id?: number | null }).chat_id;
    if (cid != null) ids.add(String(cid));
  }

  for (const row of nomina ?? []) {
    const r = row as {
      telegram_chat_id?: number | null;
      ci_empleados?: { telegram_chat_id?: number | null } | null;
    };
    if (r.telegram_chat_id != null) ids.add(String(r.telegram_chat_id));
    const empChat = r.ci_empleados?.telegram_chat_id;
    if (empChat != null) ids.add(String(empChat));
  }

  for (const row of usuariosCompras ?? []) {
    const tid = (row as { telegram_id?: number | null }).telegram_id;
    if (tid != null) ids.add(String(tid));
  }

  return ids;
}

async function getCachedAllowedDbIds(): Promise<Set<string>> {
  const now = Date.now();
  if (cacheAllowed && cacheAllowed.expiresAt > now) {
    return cacheAllowed.ids;
  }

  const admin = telegramSupabaseAdmin();
  if (!admin.ok) return new Set();

  try {
    const ids = await cargarChatIdsAutorizadosDb(admin.client);
    cacheAllowed = { ids, expiresAt: now + CACHE_TTL_MS };
    return ids;
  } catch {
    return cacheAllowed?.ids ?? new Set();
  }
}

/** true si hay reglas activas (env, forzado o filas en BD). */
export async function telegramWhitelistEstaActiva(): Promise<boolean> {
  if (whitelistEnforcedByEnv()) return true;
  if (getTelegramAllowedChatIds().size > 0) return true;
  const dbIds = await getCachedAllowedDbIds();
  return dbIds.size > 0;
}

/**
 * Autoriza chat si está en env, lista blanca BD, nómina activa o usuarios compras Telegram.
 * Sin reglas configuradas → permite todos (modo prueba).
 */
export async function isChatAllowedAsync(chatId: string | number): Promise<boolean> {
  const id = String(chatId);

  if (getTelegramAllowedChatIds().has(id)) return true;

  const activa = await telegramWhitelistEstaActiva();
  if (!activa) return true;

  const dbIds = await getCachedAllowedDbIds();
  return dbIds.has(id);
}

export async function listarTelegramWhitelist(
  supabase: SupabaseClient,
): Promise<FilaTelegramWhitelist[]> {
  const { data, error } = await supabase
    .from('ci_telegram_whitelist')
    .select(SELECT_WHITELIST)
    .order('activo', { ascending: false })
    .order('nombre');

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => mapFilaTelegramWhitelist(r as Record<string, unknown>));
}

export type CrearTelegramWhitelistInput = {
  nombre: string;
  chat_id: string | number;
  cargo?: string | null;
  telefono?: string | null;
  email?: string | null;
  notas?: string | null;
};

export async function crearTelegramWhitelist(
  supabase: SupabaseClient,
  input: CrearTelegramWhitelistInput,
): Promise<FilaTelegramWhitelist> {
  const nombre = input.nombre.trim();
  const chatId = parseTelegramChatIdInput(input.chat_id);
  if (!nombre) throw new Error('nombre requerido');
  if (chatId == null) throw new Error('chat_id inválido');

  const row = {
    chat_id: chatId,
    nombre,
    cargo: input.cargo?.trim().slice(0, 100) || null,
    telefono: input.telefono?.trim() || null,
    email: input.email?.trim() || null,
    notas: input.notas?.trim() || null,
    origen: 'manual' as const,
    activo: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ci_telegram_whitelist')
    .upsert(row, { onConflict: 'chat_id' })
    .select(SELECT_WHITELIST)
    .single();

  if (error) throw new Error(error.message);
  invalidarCacheWhitelistTelegram();

  return mapFilaTelegramWhitelist(data as Record<string, unknown>);
}

export async function actualizarTelegramWhitelist(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<{
    nombre: string;
    cargo: string | null;
    telefono: string | null;
    email: string | null;
    activo: boolean;
    notas: string | null;
  }>,
): Promise<FilaTelegramWhitelist> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nombre !== undefined) body.nombre = patch.nombre.trim();
  if (patch.cargo !== undefined) body.cargo = patch.cargo?.trim().slice(0, 100) || null;
  if (patch.telefono !== undefined) body.telefono = patch.telefono?.trim() || null;
  if (patch.email !== undefined) body.email = patch.email?.trim() || null;
  if (patch.activo !== undefined) body.activo = patch.activo;
  if (patch.notas !== undefined) body.notas = patch.notas?.trim() || null;

  const { data, error } = await supabase
    .from('ci_telegram_whitelist')
    .update(body)
    .eq('id', id.trim())
    .select(SELECT_WHITELIST)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Registro no encontrado');
  invalidarCacheWhitelistTelegram();

  return mapFilaTelegramWhitelist(data as Record<string, unknown>);
}

export async function eliminarTelegramWhitelist(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('ci_telegram_whitelist').delete().eq('id', id.trim());
  if (error) throw new Error(error.message);
  invalidarCacheWhitelistTelegram();
}

/** Sincroniza nómina → lista blanca cuando hay chat_id. */
export async function sincronizarWhitelistDesdeNomina(
  supabase: SupabaseClient,
  params: {
    nominaId: string;
    proyectoId: string;
    empleadoId: string | null;
    nombre: string;
    email: string | null;
    telegramChatId: number | null;
    activo: boolean;
    rolObra?: string | null;
  },
): Promise<void> {
  if (!params.activo || params.telegramChatId == null) {
    await supabase
      .from('ci_telegram_whitelist')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('nomina_id', params.nominaId);
    invalidarCacheWhitelistTelegram();
    return;
  }

  await supabase.from('ci_telegram_whitelist').upsert(
    {
      chat_id: params.telegramChatId,
      nombre: params.nombre.trim() || 'Sin nombre',
      cargo: params.rolObra?.trim().slice(0, 100) || null,
      email: params.email,
      proyecto_id: params.proyectoId,
      empleado_id: params.empleadoId,
      nomina_id: params.nominaId,
      origen: 'nomina',
      activo: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chat_id' },
  );
  invalidarCacheWhitelistTelegram();
}
