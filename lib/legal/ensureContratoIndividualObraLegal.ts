import type { SupabaseClient } from '@supabase/supabase-js';
import { CONTRATO_OBRERO_CUERPO_DEFAULT } from '@/lib/talento/plantillas/contratoObreroDefaultCuerpo';
import { extraerVariablesDeCuerpo } from '@/lib/legal/plantillasFormatos';

/**
 * Código canónico en Legal → Formatos.
 * Coincide con la semilla de migración 271 (`contrato_laboral_obra_ve`),
 * actualizada al cuerpo completo del contrato individual.
 */
export const CODIGO_CONTRATO_INDIVIDUAL_OBRA_LEGAL = 'contrato_laboral_obra_ve';

/** Alias semántico (migración 296); se mantiene sincronizado y el stub viejo se desactiva si coexisten. */
export const CODIGO_CONTRATO_INDIVIDUAL_OBRA_ALIAS =
  'contrato_individual_obra_determinada_ve';

const TITULO = 'Contrato individual de trabajo por obra determinada';
const DESCRIPCION =
  'Formato LOTTT / CCT construcción — contrato individual de trabajo por obra determinada (Venezuela). Revisar con asesoría legal antes de firmar.';

function esStubCorto(cuerpo: string | null | undefined): boolean {
  const t = String(cuerpo ?? '').trim();
  if (t.length < 800) return true;
  return !/PERIODO DE PRUEBA|CONTRATO INDIVIDUAL DE TRABAJO POR OBRA DETERMINADA/i.test(t);
}

function payload() {
  const cuerpo = CONTRATO_OBRERO_CUERPO_DEFAULT;
  return {
    titulo: TITULO,
    tipo: 'contrato',
    jurisdiccion: 'venezuela',
    categoria: 'laboral',
    descripcion: DESCRIPCION,
    cuerpo_markdown: cuerpo,
    variables: extraerVariablesDeCuerpo(cuerpo),
    activo: true,
    updated_at: new Date().toISOString(),
  };
}

async function upsertGlobalPorCodigo(
  admin: SupabaseClient,
  codigo: string,
  fields: ReturnType<typeof payload>,
): Promise<void> {
  const { data: existing } = await admin
    .from('ci_legal_plantillas')
    .select('id, cuerpo_markdown')
    .is('org_id', null)
    .eq('codigo', codigo)
    .maybeSingle();

  if (!existing?.id) {
    const { error } = await admin.from('ci_legal_plantillas').insert({
      org_id: null,
      codigo,
      ...fields,
    });
    if (error && !/unique|duplicate/i.test(error.message)) {
      console.warn(`[legal] ensure ${codigo} insert:`, error.message);
    }
    return;
  }

  if (!esStubCorto((existing as { cuerpo_markdown?: string }).cuerpo_markdown)) {
    // Ya tiene el formato completo; solo alinea título/descripcion/activo.
    const { error } = await admin
      .from('ci_legal_plantillas')
      .update({
        titulo: fields.titulo,
        descripcion: fields.descripcion,
        categoria: fields.categoria,
        tipo: fields.tipo,
        jurisdiccion: fields.jurisdiccion,
        activo: true,
        updated_at: fields.updated_at,
      })
      .eq('id', (existing as { id: string }).id);
    if (error) console.warn(`[legal] ensure ${codigo} meta:`, error.message);
    return;
  }

  const { error } = await admin
    .from('ci_legal_plantillas')
    .update(fields)
    .eq('id', (existing as { id: string }).id);
  if (error) console.warn(`[legal] ensure ${codigo} update:`, error.message);
}

/**
 * Asegura el formato completo del contrato individual por obra determinada
 * en Legal → Formatos (`ci_legal_plantillas`, org_id null).
 */
export async function ensureContratoIndividualObraLegal(
  admin: SupabaseClient,
): Promise<void> {
  const fields = payload();

  try {
    await upsertGlobalPorCodigo(admin, CODIGO_CONTRATO_INDIVIDUAL_OBRA_LEGAL, fields);
    await upsertGlobalPorCodigo(admin, CODIGO_CONTRATO_INDIVIDUAL_OBRA_ALIAS, fields);

    // Evitar dos entradas idénticas activas: deja el alias canónico nuevo y
    // desactiva el código legacy solo si ambos existen con cuerpo completo.
    const { data: both } = await admin
      .from('ci_legal_plantillas')
      .select('id, codigo, cuerpo_markdown, activo')
      .is('org_id', null)
      .in('codigo', [
        CODIGO_CONTRATO_INDIVIDUAL_OBRA_LEGAL,
        CODIGO_CONTRATO_INDIVIDUAL_OBRA_ALIAS,
      ]);

    const rows = (both ?? []) as Array<{
      id: string;
      codigo: string;
      cuerpo_markdown?: string;
      activo?: boolean;
    }>;
    const legacy = rows.find((r) => r.codigo === CODIGO_CONTRATO_INDIVIDUAL_OBRA_LEGAL);
    const alias = rows.find((r) => r.codigo === CODIGO_CONTRATO_INDIVIDUAL_OBRA_ALIAS);
    if (
      legacy &&
      alias &&
      !esStubCorto(legacy.cuerpo_markdown) &&
      !esStubCorto(alias.cuerpo_markdown) &&
      legacy.activo !== false
    ) {
      const { error } = await admin
        .from('ci_legal_plantillas')
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq('id', legacy.id);
      if (error) {
        console.warn('[legal] ensure desactivar stub duplicado:', error.message);
      }
    }
  } catch (err) {
    console.warn('[legal] ensureContratoIndividualObraLegal:', err);
  }
}
