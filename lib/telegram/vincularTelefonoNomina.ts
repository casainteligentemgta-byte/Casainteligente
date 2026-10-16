import type { SupabaseClient } from '@supabase/supabase-js';
import { actualizarFilaNominaProyecto } from '@/lib/proyectos/proyectoNomina';
import { etiquetaRolNomina } from '@/lib/proyectos/rolesProyectoNomina';

/**
 * Autovínculo por teléfono: el administrador carga en la nómina el número del celular
 * (p. ej. el de la empresa para el depositario). Quien tenga ese teléfono abre el bot,
 * toca «Compartir mi número» y queda registrado sin que nadie copie su chat ID.
 */

export const TEXTO_BOTON_COMPARTIR = '📱 Compartir mi número';

/** Teclado de Telegram que pide el contacto propio (solo funciona en chats privados). */
export function tecladoCompartirNumero() {
  return {
    keyboard: [[{ text: TEXTO_BOTON_COMPARTIR, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

/**
 * Los últimos 10 dígitos identifican un celular venezolano sin importar el formato:
 * 0414-1234567, +58 414 1234567 y 584141234567 → 4141234567.
 */
export function claveTelefono(v: string | null | undefined): string | null {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.slice(-10);
}

export type ContactoTelegram = { phone_number: string; user_id?: number; first_name?: string };

type FilaNomina = {
  id: string;
  proyecto_id: string;
  rol: string;
  nombre: string | null;
  telegram_chat_id: number | null;
  telegram_telefono: string | null;
  ci_empleados?: { nombre_completo?: string | null; celular?: string | null; telefono?: string | null } | null;
  ci_proyectos?: { nombre?: string | null } | null;
};

export type ResultadoVinculo =
  | { estado: 'vinculado'; asignaciones: { obra: string; rol: string }[]; nombre: string }
  | { estado: 'ya_vinculado'; asignaciones: { obra: string; rol: string }[]; nombre: string }
  | { estado: 'otro_chat'; nombre: string }
  | { estado: 'no_encontrado' }
  | { estado: 'no_es_propio' };

/** Pura: qué filas de la nómina corresponden al teléfono. */
export function filasDelTelefono<T extends Pick<FilaNomina, 'telegram_telefono' | 'ci_empleados'>>(
  filas: T[],
  telefono: string,
): T[] {
  const k = claveTelefono(telefono);
  if (!k) return [];
  return filas.filter((f) => {
    const tels = [f.telegram_telefono, f.ci_empleados?.celular, f.ci_empleados?.telefono];
    return tels.some((t) => claveTelefono(t) === k);
  });
}

export async function vincularChatPorTelefono(
  supabase: SupabaseClient,
  params: { chatId: string; fromId: number | null; contacto: ContactoTelegram },
): Promise<ResultadoVinculo> {
  // Solo vale el número propio: no se puede vincular a otra persona reenviando su contacto.
  if (params.contacto.user_id == null || params.fromId == null || params.contacto.user_id !== params.fromId) {
    return { estado: 'no_es_propio' };
  }
  const columnas: string =
    'id,proyecto_id,rol,nombre,telegram_chat_id,telegram_telefono,ci_empleados(nombre_completo,celular,telefono),ci_proyectos(nombre)';
  const { data, error } = await supabase.from('ci_proyecto_nomina').select(columnas).eq('activo', true).limit(5000);
  if (error) throw new Error(error.message);
  const coincidencias = filasDelTelefono((data ?? []) as unknown as FilaNomina[], params.contacto.phone_number);
  if (!coincidencias.length) return { estado: 'no_encontrado' };

  const chat = Number(params.chatId);
  const nombreDe = (f: FilaNomina) => f.ci_empleados?.nombre_completo?.trim() || f.nombre?.trim() || 'Sin nombre';
  const libres = coincidencias.filter((f) => f.telegram_chat_id == null || Number(f.telegram_chat_id) === chat);
  if (!libres.length) {
    // El número ya está vinculado a otro Telegram: lo cambia el administrador, no el bot.
    return { estado: 'otro_chat', nombre: nombreDe(coincidencias[0]) };
  }

  const asignaciones = libres.map((f) => ({
    obra: f.ci_proyectos?.nombre?.trim() || 'Obra',
    rol: etiquetaRolNomina(f.rol),
  }));
  const pendientes = libres.filter((f) => Number(f.telegram_chat_id) !== chat);
  if (!pendientes.length) return { estado: 'ya_vinculado', asignaciones, nombre: nombreDe(libres[0]) };

  for (const f of pendientes) {
    await actualizarFilaNominaProyecto(supabase, f.proyecto_id, f.id, { telegram_chat_id: chat });
  }
  return { estado: 'vinculado', asignaciones, nombre: nombreDe(libres[0]) };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mensajeResultadoVinculo(r: ResultadoVinculo): string {
  const lista = (a: { obra: string; rol: string }[]) => a.map((x) => `• ${escHtml(x.rol)} · ${escHtml(x.obra)}`).join('\n');
  switch (r.estado) {
    case 'vinculado':
      return `✅ <b>Listo, ${escHtml(r.nombre)}.</b> Su Telegram quedó registrado:\n${lista(r.asignaciones)}\n\nEscriba /start para ver el menú.`;
    case 'ya_vinculado':
      return `ℹ️ Este Telegram ya estaba registrado:\n${lista(r.asignaciones)}\n\nEscriba /start para ver el menú.`;
    case 'otro_chat':
      return '⚠️ Ese número ya está vinculado a otro Telegram. Pida al administrador que lo libere en la nómina de la obra y vuelva a intentarlo.';
    case 'no_es_propio':
      return '⚠️ Use el botón «Compartir mi número»: solo se acepta el número de este mismo Telegram.';
    default:
      return '⛔ Ese número no está en la nómina de ninguna obra. Pida al administrador que lo cargue (Equipo → Nómina) y vuelva a tocar «Compartir mi número».';
  }
}
