import type { SupabaseClient } from '@supabase/supabase-js';
import {
  obtenerUsuarioSistemaTelegram,
} from '@/lib/compras/usuariosSistemaTelegram';
import type { ProyectoCatalogo } from '@/lib/proyectos/proyectosUnificados';

/** Roles con obra asignada en ci_usuarios_sistema_telegram (ej. comprador Flamboyant). */
const ROLES_OBRA_ASIGNADA = ['Comprador', 'Solicitante'] as const;

export function modoTelegramUsaObraComprador(modo: string): boolean {
  return (
    modo === 'factura_compra' ||
    modo === 'ingreso_manual' ||
    modo === 'ingreso_factura_manual' ||
    modo === 'nota_entrega' ||
    modo === 'emergencia' ||
    modo === 'procura' ||
    modo === 'procura_departamento'
  );
}

/** Limita el picker a la obra del comprador/solicitante cuando tiene proyecto_id. */
export async function filtrarProyectosCatalogoParaChatTelegram(
  supabase: SupabaseClient,
  chatId: string | number,
  proyectos: ProyectoCatalogo[],
): Promise<ProyectoCatalogo[]> {
  let usuario;
  try {
    usuario = await obtenerUsuarioSistemaTelegram(supabase, chatId);
  } catch {
    return proyectos;
  }
  if (!usuario?.proyecto_id?.trim()) return proyectos;
  if (!ROLES_OBRA_ASIGNADA.includes(usuario.rol as (typeof ROLES_OBRA_ASIGNADA)[number])) return proyectos;

  const pid = usuario.proyecto_id.trim();
  const filtrados = proyectos.filter((p) => p.id === pid);
  return filtrados.length ? filtrados : proyectos;
}
