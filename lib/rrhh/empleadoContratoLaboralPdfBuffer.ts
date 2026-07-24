import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarPropsContratoObreroPdfEstructurado,
  compilarContratoObreroDesdeEmpleadoId,
} from '@/lib/talento/contratoObreroPdfContext';
import { construirExpedienteRefPorEmpleado } from '@/lib/talento/contratoExpedienteRef';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';
import { ContratoLaboralObreroPdfDocument } from '@/lib/talento/ContratoLaboralObreroPdfStub';

export async function generarBufferContratoLaboralEmpleado(
  supabase: SupabaseClient,
  empleadoId: string,
  opts?: { formato?: string; overrides?: Record<string, string> },
): Promise<{ ok: true; buf: Buffer; filename: string } | { ok: false; error: string }> {
  const id = empleadoId.trim();
  if (!id) return { ok: false, error: 'Falta id de empleado' };

  const formato = (opts?.formato ?? '').toLowerCase();
  const overrides = opts?.overrides;

  try {
    const expedienteRef = await construirExpedienteRefPorEmpleado(supabase, id);

    if (formato === 'estructurado') {
      if (overrides && Object.keys(overrides).length > 0) {
        return {
          ok: false,
          error: 'El PDF estructurado no admite overrides; use la plantilla biblioteca.',
        };
      }
      const st = await cargarPropsContratoObreroPdfEstructurado(supabase, id);
      if (!st.ok) return { ok: false, error: st.error };
      const node = createElement(ContratoObreroPDF, {
        ...st.props,
        expedienteId: expedienteRef,
      });
      const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
      const buf = Buffer.from(await blob.arrayBuffer());
      return {
        ok: true,
        buf,
        filename: `contrato-obrero-estructurado-${id.slice(0, 8)}.pdf`,
      };
    }

    const out = await compilarContratoObreroDesdeEmpleadoId(supabase, id, overrides);
    if (!out.ok) return { ok: false, error: out.error };
    const pie =
      out.faltantes.length > 0
        ? 'Revise los recuadros [… COMPLETAR …]: complete la planilla de empleo, el expediente o los valores manuales indicados antes de la firma.'
        : null;
    const node = createElement(ContratoLaboralObreroPdfDocument, {
      expedienteId: expedienteRef,
      titulo: 'CONTRATO INDIVIDUAL DE TRABAJO',
      cuerpoTexto: out.texto,
      pieLegal: pie,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    return { ok: true, buf, filename: `contrato-obrero-${id.slice(0, 8)}.pdf` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    if (msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return { ok: false, error: 'Configuración Supabase incompleta en el servidor.' };
    }
    console.error('[generarBufferContratoLaboralEmpleado]', e);
    return { ok: false, error: 'No se pudo generar el PDF' };
  }
}
