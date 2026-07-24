import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarPropsContratoObreroPdfExpress,
  type ContratoExpressManualInput,
} from '@/lib/talento/contratoObreroPdfContext';
import { ContratoObreroPDF } from '@/lib/talento/ContratoObreroPdfStructured';

type ExpressRow = {
  id: string;
  proyecto_id: string;
  config_nomina_id?: string | null;
  obrero_nombre?: string | null;
  obrero_cedula?: string | null;
  obrero_direccion?: string | null;
  horario_semanal_texto?: string | null;
  bono_manual_usd?: number | null;
  bono_manual_ves?: number | null;
};

function manualDesdeExpressRow(row: ExpressRow): ContratoExpressManualInput {
  return {
    obreroNombre: String(row.obrero_nombre ?? '').trim(),
    obreroCedula: String(row.obrero_cedula ?? '').trim(),
    obreroDireccion: row.obrero_direccion?.trim() || null,
    horarioSemanalTexto: row.horario_semanal_texto?.trim() || null,
    bonoManualUsd:
      row.bono_manual_usd != null && Number.isFinite(Number(row.bono_manual_usd))
        ? Number(row.bono_manual_usd)
        : null,
  };
}

export async function generarBufferContratoExpressPdf(
  supabase: SupabaseClient,
  expressId: string,
): Promise<{ ok: true; buf: Buffer; filename: string } | { ok: false; error: string }> {
  const id = expressId.trim();
  if (!id) return { ok: false, error: 'Falta id de contrato express.' };

  const { data, error } = await supabase
    .from('ci_contratos_express')
    .select(
      'id,proyecto_id,config_nomina_id,obrero_nombre,obrero_cedula,obrero_direccion,horario_semanal_texto,bono_manual_usd,bono_manual_ves',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Contrato express no encontrado.' };

  const row = data as ExpressRow;
  const proyectoId = String(row.proyecto_id ?? '').trim();
  const configNominaId = String(row.config_nomina_id ?? '').trim();
  if (!proyectoId || !configNominaId) {
    return {
      ok: false,
      error:
        'Este contrato express no tiene proyecto o cargo (tabulador) vinculado; no se puede regenerar el PDF automáticamente.',
    };
  }

  const manual = manualDesdeExpressRow(row);
  if (!manual.obreroNombre || !manual.obreroCedula) {
    return { ok: false, error: 'Faltan nombre o cédula del obrero en el contrato express.' };
  }

  const loaded = await cargarPropsContratoObreroPdfExpress(supabase, proyectoId, configNominaId, manual);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const expedienteLabel = `EXPRESS-${id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  try {
    const node = createElement(ContratoObreroPDF, {
      ...loaded.props,
      expedienteId: expedienteLabel,
    });
    const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
    const buf = Buffer.from(await blob.arrayBuffer());
    return { ok: true, buf, filename: `contrato-express-${id.slice(0, 8)}.pdf` };
  } catch (e) {
    console.error('[generarBufferContratoExpressPdf]', e);
    return { ok: false, error: 'No se pudo generar el PDF del contrato express.' };
  }
}
