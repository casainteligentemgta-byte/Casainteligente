import type { TelegramEstado } from '@/lib/telegram/estados';
import type { PrioridadProcura } from '@/lib/compras/viaRapidaProcura';
import { parsePrioridadProcura } from '@/lib/compras/viaRapidaProcura';

export type PasoProcuraDepartamento =
  | 'capitulo'
  | 'material'
  | 'cantidad'
  | 'unidad'
  | 'prioridad'
  | 'consumible'
  | 'monto'
  | 'confirm';

const PASOS_PROCURA: readonly PasoProcuraDepartamento[] = [
  'capitulo',
  'material',
  'cantidad',
  'unidad',
  'prioridad',
  'consumible',
  'monto',
  'confirm',
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function num(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  return undefined;
}

function paso(v: unknown): PasoProcuraDepartamento | undefined {
  const s = str(v);
  return s && (PASOS_PROCURA as readonly string[]).includes(s)
    ? (s as PasoProcuraDepartamento)
    : undefined;
}

function prioridad(v: unknown): PrioridadProcura | undefined {
  const s = str(v);
  return s ? parsePrioridadProcura(s) ?? undefined : undefined;
}

export function esUuidProcura(id: string): boolean {
  return UUID_RE.test(id.trim());
}

export type MetadataProcuraDepartamentoParsed = {
  paso?: PasoProcuraDepartamento;
  usuario_id?: string;
  usuario_nombre?: string;
  capitulo_id?: string;
  capitulo_codigo?: string;
  capitulo_nombre?: string;
  material_id?: string;
  material_txt?: string;
  material_busqueda_borrador?: string;
  por_verificar?: boolean;
  cantidad?: number;
  unidad?: string;
  prioridad?: PrioridadProcura;
  es_consumible?: boolean;
  monto_estimado_usd?: number | null;
  observaciones?: string;
  ttl_pendiente?: boolean;
};

export function parseMetadataProcuraDepartamento(
  estado: TelegramEstado,
): MetadataProcuraDepartamentoParsed {
  const m = estado.metadata ?? {};
  const monto = m.monto_estimado_usd;
  return {
    paso: paso(m.paso),
    usuario_id: str(m.usuario_id),
    usuario_nombre: str(m.usuario_nombre),
    capitulo_id: str(m.capitulo_id),
    capitulo_codigo: str(m.capitulo_codigo),
    capitulo_nombre: str(m.capitulo_nombre),
    material_id: str(m.material_id),
    material_txt: str(m.material_txt),
    material_busqueda_borrador: str(m.material_busqueda_borrador),
    por_verificar: bool(m.por_verificar),
    cantidad: num(m.cantidad),
    unidad: str(m.unidad),
    prioridad: prioridad(m.prioridad),
    es_consumible: bool(m.es_consumible),
    monto_estimado_usd: monto === null ? null : num(monto),
    observaciones: str(m.observaciones),
    ttl_pendiente: bool(m.ttl_pendiente),
  };
}

export type MetadataMotivoRechazoParsed = {
  procura_id?: string;
  procura_ticket?: string;
  aprobador_nombre?: string;
  aprobador_telegram_id?: number;
  canal_admin_chat_id?: string;
  canal_admin_message_id?: number;
};

export function parseMetadataMotivoRechazo(estado: TelegramEstado): MetadataMotivoRechazoParsed {
  const m = estado.metadata ?? {};
  const msgId = m.canal_admin_message_id;
  return {
    procura_id: str(m.procura_id),
    procura_ticket: str(m.procura_ticket),
    aprobador_nombre: str(m.aprobador_nombre),
    aprobador_telegram_id: num(m.aprobador_telegram_id),
    canal_admin_chat_id: str(m.canal_admin_chat_id),
    canal_admin_message_id:
      typeof msgId === 'number' && Number.isFinite(msgId) ? msgId : undefined,
  };
}

/** Telegram callback_data máx. 64 bytes. */
export function callbackDataTelegramValido(data: string, max = 64): boolean {
  return data.length > 0 && data.length <= max;
}
