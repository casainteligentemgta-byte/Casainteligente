import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompraListaUnificada } from '@/lib/contabilidad/mapCanalPendienteCompra';

function normalizarNumeroDoc(value: string | null | undefined): string {
  const raw = String(value ?? '').trim().toUpperCase();
  const digits = raw.replace(/\D/g, '');
  return digits || raw;
}

function compraNecesitaRecepcion(c: CompraListaUnificada): boolean {
  return (
    (c.fuente_lista === 'app' || c.fuente_lista == null) &&
    !c.id.startsWith('canal-') &&
    (!c.ingresado_almacen_at?.trim() || !c.ubicacion_destino_id?.trim())
  );
}

/** Completa ingreso físico y ubicación desde recepciones de campo enlazadas a contabilidad. */
export async function enriquecerComprasRecepcionCampo(
  supabase: SupabaseClient,
  compras: CompraListaUnificada[],
): Promise<CompraListaUnificada[]> {
  const candidatas = compras.filter(compraNecesitaRecepcion);
  if (!candidatas.length) return compras;

  const compraIds = Array.from(new Set(candidatas.map((c) => c.id.trim()).filter(Boolean))).slice(
    0,
    400,
  );

  const porCompra = new Map<string, { ubicacion_id: string; ingresado_at: string }>();

  const { data, error } = await supabase
    .from('ci_recepciones_campo')
    .select('contabilidad_compra_id, proyecto_id, num_doc, ubicacion_id, created_at, estado')
    .in('contabilidad_compra_id', compraIds)
    .eq('estado', 'registrado');

  const schemaIncompleto =
    error &&
    /contabilidad_compra_id|relationship between|schema cache|PGRST200|42703|42P01/i.test(
      error.message ?? '',
    );

  if (!error || schemaIncompleto) {
    for (const row of data ?? []) {
      const cid = String(
        (row as { contabilidad_compra_id?: string | null }).contabilidad_compra_id ?? '',
      ).trim();
      if (!cid || porCompra.has(cid)) continue;
      const ubicacionId = String((row as { ubicacion_id?: string | null }).ubicacion_id ?? '').trim();
      if (!ubicacionId) continue;
      const ingresadoAt =
        String((row as { created_at?: string | null }).created_at ?? '').trim() ||
        new Date().toISOString();
      porCompra.set(cid, { ubicacion_id: ubicacionId, ingresado_at: ingresadoAt });
    }
  } else if (error) {
    return compras;
  }

  const sinEnlace = candidatas.filter((c) => !porCompra.has(c.id));
  const proyectoIds = Array.from(
    new Set(sinEnlace.map((c) => c.proyecto_id?.trim()).filter(Boolean) as string[]),
  ).slice(0, 80);

  if (proyectoIds.length) {
    const { data: porProyecto, error: errProy } = await supabase
      .from('ci_recepciones_campo')
      .select('proyecto_id, num_doc, ubicacion_id, created_at, estado')
      .in('proyecto_id', proyectoIds)
      .eq('estado', 'registrado')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!errProy) {
      const indiceProyectoDoc = new Map<
        string,
        { ubicacion_id: string; ingresado_at: string }
      >();

      for (const row of porProyecto ?? []) {
        const pid = String((row as { proyecto_id?: string | null }).proyecto_id ?? '').trim();
        const numDoc = normalizarNumeroDoc(
          String((row as { num_doc?: string | null }).num_doc ?? ''),
        );
        const ubicacionId = String((row as { ubicacion_id?: string | null }).ubicacion_id ?? '').trim();
        if (!pid || !numDoc || !ubicacionId) continue;
        const key = `${pid}|${numDoc}`;
        if (indiceProyectoDoc.has(key)) continue;
        indiceProyectoDoc.set(key, {
          ubicacion_id: ubicacionId,
          ingresado_at:
            String((row as { created_at?: string | null }).created_at ?? '').trim() ||
            new Date().toISOString(),
        });
      }

      for (const c of sinEnlace) {
        const pid = c.proyecto_id?.trim();
        const num = normalizarNumeroDoc(c.invoice_number);
        if (!pid || !num) continue;
        const hit = indiceProyectoDoc.get(`${pid}|${num}`);
        if (hit) porCompra.set(c.id, hit);
      }
    }
  }

  if (!porCompra.size) return compras;

  return compras.map((c) => {
    const rec = porCompra.get(c.id);
    if (!rec) return c;
    return {
      ...c,
      ubicacion_destino_id: c.ubicacion_destino_id?.trim() || rec.ubicacion_id || null,
      ingresado_almacen_at: c.ingresado_almacen_at?.trim() || rec.ingresado_at,
    };
  });
}
