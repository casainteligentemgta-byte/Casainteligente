/**
 * Persistencia de memoria de proveedor (perfil + correcciones).
 * Soft-fail si las tablas aún no existen (migración 403).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import {
  MAX_FACTURAS_AGREGAR,
  agregarPerfilProveedor,
  aplicarCorreccionesExtracted,
  claveRifPerfil,
  construirHintProveedor,
  correccionesDeLineas,
  correccionesDesdeCambio,
  enriquecerExtractedConMemoriaPuro,
  detectarAnomaliasFactura,
  prefillingDesdePerfil,
  variantesRifBusqueda,
  type AnomaliaFacturaCanal,
  type CorreccionProveedor,
  type FacturaConfirmadaParaPerfil,
  type ProveedorPerfil,
} from '@/lib/compras/proveedorMemoria';

function tablaAusente(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '42P01' || /does not exist|no existe/i.test(err.message ?? '');
}

function filaPerfilDesdeDb(row: Record<string, unknown> | null): ProveedorPerfil | null {
  if (!row) return null;
  const rif = String(row.rif_normalizado ?? '').trim();
  if (!rif) return null;
  const itemsRaw = Array.isArray(row.items) ? row.items : [];
  return {
    rif_normalizado: rif,
    rif_etiqueta: String(row.rif_etiqueta ?? rif),
    nombre_canonico: (row.nombre_canonico as string | null) ?? null,
    moneda_habitual: (row.moneda_habitual as string | null) ?? null,
    dias_credito_habitual:
      row.dias_credito_habitual != null ? Number(row.dias_credito_habitual) : null,
    condicion_pago_habitual: (row.condicion_pago_habitual as string | null) ?? null,
    entidad_id_habitual: (row.entidad_id_habitual as string | null) ?? null,
    proyecto_id_habitual: (row.proyecto_id_habitual as string | null) ?? null,
    ubicacion_destino_id_habitual: (row.ubicacion_destino_id_habitual as string | null) ?? null,
    imputacion_habitual: (row.imputacion_habitual as string | null) ?? null,
    clasificacion_gasto_habitual: (row.clasificacion_gasto_habitual as string | null) ?? null,
    n_facturas: Number(row.n_facturas) || 0,
    items: itemsRaw
      .map((it) => {
        const r = it as Record<string, unknown>;
        return {
          nombre_norm: String(r.nombre_norm ?? ''),
          nombre_habitual: String(r.nombre_habitual ?? ''),
          precio_mediana: Number(r.precio_mediana) || 0,
          n: Number(r.n) || 0,
        };
      })
      .filter((it) => it.nombre_norm),
  };
}

export async function cargarPerfilProveedor(
  supabase: SupabaseClient,
  rif: string | null | undefined,
): Promise<ProveedorPerfil | null> {
  const clave = claveRifPerfil(rif);
  if (!clave) return null;
  const { data, error } = await supabase
    .from('ci_proveedor_perfil')
    .select('*')
    .eq('rif_normalizado', clave)
    .maybeSingle();
  if (tablaAusente(error)) return null;
  if (error) {
    console.warn('[proveedorMemoria] perfil:', error.message);
    return null;
  }
  return filaPerfilDesdeDb((data ?? null) as Record<string, unknown> | null);
}

export async function cargarCorreccionesProveedor(
  supabase: SupabaseClient,
  rif: string | null | undefined,
): Promise<CorreccionProveedor[]> {
  const claves = variantesRifBusqueda(rif);
  const compact = claveRifPerfil(rif);
  if (compact && !claves.includes(compact)) claves.push(compact);
  if (!claves.length) return [];
  const { data, error } = await supabase
    .from('ci_proveedor_correcciones')
    .select('campo, valor_original, valor_corregido, n_veces, rif_normalizado')
    .in('rif_normalizado', claves);
  if (tablaAusente(error)) return [];
  if (error) {
    console.warn('[proveedorMemoria] correcciones:', error.message);
    return [];
  }
  return ((data ?? []) as CorreccionProveedor[]).map((c) => ({
    campo: c.campo,
    valor_original: c.valor_original,
    valor_corregido: c.valor_corregido,
    n_veces: c.n_veces,
  }));
}

export async function registrarCorreccionesProveedor(
  supabase: SupabaseClient,
  params: {
    rif: string | null | undefined;
    correcciones: CorreccionProveedor[];
    origen?: 'telegram' | 'web' | 'confirmacion';
  },
): Promise<void> {
  const rif = claveRifPerfil(params.rif);
  if (!rif || !params.correcciones.length) return;

  for (const c of params.correcciones) {
    const original = String(c.valor_original ?? '').trim();
    const corregido = String(c.valor_corregido ?? '').trim();
    if (!original || !corregido || original === corregido) continue;

    const { data: previa, error: selErr } = await supabase
      .from('ci_proveedor_correcciones')
      .select('id, n_veces')
      .eq('rif_normalizado', rif)
      .eq('campo', c.campo)
      .eq('valor_original', original)
      .maybeSingle();
    if (tablaAusente(selErr)) return;
    if (selErr) {
      console.warn('[proveedorMemoria] leer corrección:', selErr.message);
      continue;
    }

    const rowPrevia = previa as { id?: string; n_veces?: number } | null;
    if (rowPrevia?.id) {
      const { error } = await supabase
        .from('ci_proveedor_correcciones')
        .update({
          valor_corregido: corregido,
          n_veces: (Number(rowPrevia.n_veces) || 1) + 1,
          updated_at: new Date().toISOString(),
          origen: params.origen ?? 'web',
        })
        .eq('id', rowPrevia.id);
      if (error && !tablaAusente(error)) {
        console.warn('[proveedorMemoria] update corrección:', error.message);
      }
      continue;
    }

    const { error } = await supabase.from('ci_proveedor_correcciones').insert({
      rif_normalizado: rif,
      campo: c.campo,
      valor_original: original,
      valor_corregido: corregido,
      n_veces: 1,
      origen: params.origen ?? 'web',
    });
    if (error && !tablaAusente(error)) {
      console.warn('[proveedorMemoria] insert corrección:', error.message);
    }
  }
}

type CompraHistRow = {
  supplier_rif?: string | null;
  supplier_name?: string | null;
  moneda?: string | null;
  moneda_original?: string | null;
  entidad_id?: string | null;
  proyecto_id?: string | null;
  ubicacion_destino_id?: string | null;
  imputacion?: string | null;
  clasificacion_gasto_entidad?: string | null;
  purchase_invoices?: {
    condicion_pago?: string | null;
    dias_credito?: number | null;
    moneda_original?: string | null;
    moneda?: string | null;
  } | null;
  contabilidad_compra_lineas?: Array<{
    descripcion?: string | null;
    precio_unitario?: number | null;
  }> | null;
};

function filaHistAFactura(row: CompraHistRow): FacturaConfirmadaParaPerfil {
  const inv = row.purchase_invoices;
  return {
    supplier_rif: row.supplier_rif,
    supplier_name: row.supplier_name,
    moneda: inv?.moneda_original ?? inv?.moneda ?? row.moneda_original ?? row.moneda,
    dias_credito: inv?.dias_credito ?? null,
    condicion_pago: inv?.condicion_pago ?? null,
    entidad_id: row.entidad_id,
    proyecto_id: row.proyecto_id,
    ubicacion_destino_id: row.ubicacion_destino_id,
    imputacion: row.imputacion,
    clasificacion_gasto_entidad: row.clasificacion_gasto_entidad,
    items: (row.contabilidad_compra_lineas ?? []).map((l) => ({
      description: l.descripcion,
      unit_price: l.precio_unitario != null ? Number(l.precio_unitario) : null,
    })),
  };
}

export async function refrescarPerfilProveedorTrasConfirmacion(
  supabase: SupabaseClient,
  params: {
    extracted: ExtractedCanalHeader;
    entidadId?: string | null;
    proyectoId?: string | null;
    ubicacionDestinoId?: string | null;
    imputacionEntidad?: boolean;
    clasificacionGastoEntidad?: string | null;
  },
): Promise<void> {
  const rif = claveRifPerfil(params.extracted.supplier_rif);
  if (!rif) return;

  const variantes = variantesRifBusqueda(params.extracted.supplier_rif);
  const { data, error } = await supabase
    .from('contabilidad_compras')
    .select(
      'supplier_rif, supplier_name, moneda, moneda_original, entidad_id, proyecto_id, ubicacion_destino_id, imputacion, clasificacion_gasto_entidad, purchase_invoices ( condicion_pago, dias_credito, moneda_original, moneda ), contabilidad_compra_lineas ( descripcion, precio_unitario )',
    )
    .in('supplier_rif', variantes.length ? variantes : [rif])
    .order('fecha', { ascending: false })
    .limit(MAX_FACTURAS_AGREGAR);

  if (error && !tablaAusente(error)) {
    console.warn('[proveedorMemoria] hist compras:', error.message);
  }

  const hist = ((data ?? []) as CompraHistRow[]).map(filaHistAFactura);
  const actual: FacturaConfirmadaParaPerfil = {
    supplier_rif: params.extracted.supplier_rif,
    supplier_name: params.extracted.supplier_name,
    moneda: params.extracted.moneda as string | null | undefined,
    dias_credito: params.extracted.dias_credito ?? null,
    condicion_pago: params.extracted.condicion_pago as string | null | undefined,
    entidad_id: params.entidadId,
    proyecto_id: params.proyectoId,
    ubicacion_destino_id: params.ubicacionDestinoId,
    imputacion: params.imputacionEntidad ? IMPUTACION_ENTIDAD : 'obra',
    clasificacion_gasto_entidad: params.clasificacionGastoEntidad,
    items: (params.extracted.items ?? []).map((it) => ({
      description: it.description,
      unit_price: it.unit_price,
    })),
  };

  const perfil = agregarPerfilProveedor([actual, ...hist]);
  if (!perfil) return;

  const { error: upErr } = await supabase.from('ci_proveedor_perfil').upsert(
    {
      rif_normalizado: perfil.rif_normalizado,
      rif_etiqueta: perfil.rif_etiqueta,
      nombre_canonico: perfil.nombre_canonico,
      moneda_habitual: perfil.moneda_habitual,
      dias_credito_habitual: perfil.dias_credito_habitual,
      condicion_pago_habitual: perfil.condicion_pago_habitual,
      entidad_id_habitual: perfil.entidad_id_habitual,
      proyecto_id_habitual: perfil.proyecto_id_habitual,
      ubicacion_destino_id_habitual: perfil.ubicacion_destino_id_habitual,
      imputacion_habitual: perfil.imputacion_habitual,
      clasificacion_gasto_habitual: perfil.clasificacion_gasto_habitual,
      n_facturas: perfil.n_facturas,
      items: perfil.items,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'rif_normalizado' },
  );
  if (upErr && !tablaAusente(upErr)) {
    console.warn('[proveedorMemoria] upsert perfil:', upErr.message);
  }
}

export async function registrarCorreccionesTrasEdicion(
  supabase: SupabaseClient,
  params: {
    rif?: string | null;
    original: Record<string, unknown>;
    corregido: Record<string, unknown>;
    origen: 'telegram' | 'web' | 'confirmacion';
  },
): Promise<void> {
  const rif =
    claveRifPerfil(params.rif) ||
    claveRifPerfil(String(params.corregido.supplier_rif ?? '')) ||
    claveRifPerfil(String(params.original.supplier_rif ?? ''));
  const cabecera = correccionesDesdeCambio({
    original: params.original,
    corregido: params.corregido,
  });
  const lineas = correccionesDeLineas(
    params.original.items as ExtractedCanalHeader['items'],
    params.corregido.items as ExtractedCanalHeader['items'],
  );
  const todas = [...cabecera, ...lineas];
  if (!todas.length) return;

  // Si corrigieron el RIF, guarda el mapeo bajo el RIF original (para la próxima lectura).
  const rifOriginal = claveRifPerfil(String(params.original.supplier_rif ?? ''));
  if (rifOriginal && rifOriginal !== rif) {
    await registrarCorreccionesProveedor(supabase, {
      rif: rifOriginal,
      correcciones: todas.filter((c) => c.campo === 'supplier_rif').length
        ? todas
        : [
            ...todas,
            {
              campo: 'supplier_rif',
              valor_original: String(params.original.supplier_rif ?? ''),
              valor_corregido: String(params.corregido.supplier_rif ?? rif),
            },
          ],
      origen: params.origen,
    });
  }

  await registrarCorreccionesProveedor(supabase, {
    rif,
    correcciones: todas,
    origen: params.origen,
  });
}

export async function hintExtraccionParaPendiente(
  supabase: SupabaseClient,
  params: { pendingId?: string | null; chatId?: string | null; rif?: string | null },
): Promise<string> {
  let rif = claveRifPerfil(params.rif);

  if (!rif && params.pendingId) {
    const { data } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('extracted')
      .eq('id', params.pendingId)
      .maybeSingle();
    const ex = (data?.extracted ?? {}) as ExtractedCanalHeader;
    rif = claveRifPerfil(ex.supplier_rif);
  }

  if (!rif && params.chatId) {
    const { data } = await supabase
      .from('ci_facturas_canal_pendientes')
      .select('extracted')
      .eq('chat_id', params.chatId)
      .in('estado', ['confirmado', 'extraido'])
      .order('created_at', { ascending: false })
      .limit(3);
    const rifs = [
      ...new Set(
        ((data ?? []) as Array<{ extracted?: ExtractedCanalHeader | null }>)
          .map((r) => claveRifPerfil(r.extracted?.supplier_rif))
          .filter(Boolean),
      ),
    ];
    rif = rifs[0] ?? '';
    if (rifs.length > 1) {
      const hints: string[] = [];
      for (const r of rifs.slice(0, 3)) {
        const perfil = await cargarPerfilProveedor(supabase, r);
        const corr = await cargarCorreccionesProveedor(supabase, r);
        const h = construirHintProveedor(perfil, corr);
        if (h) hints.push(h);
      }
      return hints.join(' ').slice(0, 900);
    }
  }

  if (!rif) return '';
  const perfil = await cargarPerfilProveedor(supabase, rif);
  const correcciones = await cargarCorreccionesProveedor(supabase, rif);
  return construirHintProveedor(perfil, correcciones);
}

export async function enriquecerExtractedConMemoria(
  supabase: SupabaseClient,
  ocr: ExtractedCanalHeader,
): Promise<{ extracted: ExtractedCanalHeader; anomalias: AnomaliaFacturaCanal[] }> {
  let rif = claveRifPerfil(ocr.supplier_rif);
  const correccionesOcr = rif ? await cargarCorreccionesProveedor(supabase, rif) : [];
  const conRif = aplicarCorreccionesExtracted(ocr, correccionesOcr.filter((c) => c.campo === 'supplier_rif'));
  rif = claveRifPerfil(conRif.supplier_rif) || rif;

  const [perfil, correcciones] = await Promise.all([
    cargarPerfilProveedor(supabase, rif),
    cargarCorreccionesProveedor(supabase, rif),
  ]);
  const todas = [...correccionesOcr, ...correcciones];
  const extracted = enriquecerExtractedConMemoriaPuro({
    ocr: conRif,
    perfil,
    correcciones: todas,
  });
  const anomalias = extracted.anomalias ?? detectarAnomaliasFactura({ extracted, perfil });
  return { extracted: { ...extracted, anomalias }, anomalias };
}

export async function reevaluarAnomaliasExtracted(
  supabase: SupabaseClient,
  extracted: ExtractedCanalHeader,
): Promise<AnomaliaFacturaCanal[]> {
  const perfil = await cargarPerfilProveedor(supabase, extracted.supplier_rif);
  const { extracted: conPerfil } = prefillingDesdePerfil(extracted, perfil);
  return detectarAnomaliasFactura({ extracted: conPerfil, perfil });
}
