import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { applyOwnerFilter, assertAgendaOwner, ownerInsertPayload } from '@/lib/agenda/owner';
import type { AgendaOwner, AgendaToolArgs, AgendaToolResult } from '@/types/agenda';

function getSupabase() {
  return createSupabaseAdminClient();
}

function asMes(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

export const ejecutarToolDeAgenda = async (
  name: string,
  args: AgendaToolArgs,
  owner: AgendaOwner,
): Promise<AgendaToolResult> => {
  assertAgendaOwner(owner);

  switch (name) {
    case 'guardarFechaEspecial': {
      const { error: insertError } = await getSupabase().from('special_dates').insert([
        {
          ...ownerInsertPayload(owner),
          title: args.titulo,
          category: args.categoria,
          event_date: args.fecha,
          event_time: args.hora || null,
          notes: args.notas ?? args.notes ?? null,
        },
      ]);

      if (insertError) throw new Error(`Error en Supabase: ${insertError.message}`);
      return {
        status: 'success',
        message: `Evento "${args.titulo}" guardado correctamente.`,
      };
    }

    case 'consultarFechasEspeciales': {
      let query = applyOwnerFilter(
        getSupabase().from('special_dates').select('*'),
        owner,
      );

      if (args.categoria) {
        query = query.eq('category', args.categoria);
      }

      const mes = asMes(args.mes);
      if (mes !== undefined) {
        if (mes < 1 || mes > 12) {
          throw new Error('El mes debe estar entre 1 y 12.');
        }
        query = query.filter('event_date', 'raw', `extract(month from event_date) = ${mes}`);
      }

      const { data: selectData, error: selectError } = await query.order('event_date', {
        ascending: true,
      });

      if (selectError) throw new Error(`Error al consultar Supabase: ${selectError.message}`);

      return { status: 'success', data: selectData ?? [] };
    }

    default:
      throw new Error(`Tool no encontrada: ${name}`);
  }
};
