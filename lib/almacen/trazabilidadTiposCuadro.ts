import type { TipoMovimientoTrazabilidadFiltro } from '@/lib/almacen/trazabilidadCuadroShare';

export type TipoMovimientoTrazabilidad = Exclude<TipoMovimientoTrazabilidadFiltro, ''>;

export const ETIQUETAS_TIPO_TRAZABILIDAD: Record<TipoMovimientoTrazabilidad, string> = {
  entrada_manual: 'Entrada Manual',
  entrada_ocr: 'Entrada OCR (IA)',
  nota_entrega: 'Nota de Entrega',
  transferencia: 'Transferencia (A otro almacén)',
  despacho_obra: 'Despacho a Obra',
  prestamo: 'Préstamo',
  perdida_deterioro: 'Pérdida / Deterioro',
  ajuste: 'Ajuste de inventario',
  anulacion: 'Anulación',
};

export const BADGE_TIPO_TRAZABILIDAD: Record<TipoMovimientoTrazabilidad, string> = {
  entrada_manual: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  entrada_ocr: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40',
  nota_entrega: 'bg-emerald-600/15 text-emerald-100 border-emerald-500/45',
  transferencia: 'bg-sky-500/15 text-sky-200 border-sky-500/35',
  despacho_obra: 'bg-orange-500/15 text-orange-200 border-orange-500/40',
  prestamo: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  perdida_deterioro: 'bg-red-500/15 text-red-200 border-red-500/40',
  ajuste: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/35',
  anulacion: 'bg-rose-500/15 text-rose-200 border-rose-500/35',
};

export const OPCIONES_TIPO_TRAZABILIDAD: Array<{
  value: TipoMovimientoTrazabilidadFiltro;
  label: string;
}> = [
  { value: '', label: 'Todos los tipos' },
  { value: 'entrada_manual', label: ETIQUETAS_TIPO_TRAZABILIDAD.entrada_manual },
  { value: 'entrada_ocr', label: ETIQUETAS_TIPO_TRAZABILIDAD.entrada_ocr },
  { value: 'nota_entrega', label: ETIQUETAS_TIPO_TRAZABILIDAD.nota_entrega },
  { value: 'transferencia', label: ETIQUETAS_TIPO_TRAZABILIDAD.transferencia },
  { value: 'despacho_obra', label: ETIQUETAS_TIPO_TRAZABILIDAD.despacho_obra },
  { value: 'prestamo', label: ETIQUETAS_TIPO_TRAZABILIDAD.prestamo },
  { value: 'perdida_deterioro', label: ETIQUETAS_TIPO_TRAZABILIDAD.perdida_deterioro },
  { value: 'ajuste', label: ETIQUETAS_TIPO_TRAZABILIDAD.ajuste },
  { value: 'anulacion', label: ETIQUETAS_TIPO_TRAZABILIDAD.anulacion },
];

export type ContextoEnriquecimientoTrazabilidad = {
  comprasFactura: Map<
    string,
    {
      id: string;
      numero_factura: string | null;
      purchase_invoice_id: string | null;
      contabilidad_id: string | null;
    }
  >;
  recepcion: Map<
    string,
    {
      id: string;
      num_doc: string | null;
      tipo: string | null;
      observaciones: string | null;
      proyecto_nombre: string | null;
      forma_ingreso: string | null;
    }
  >;
  transferencia: Map<
    string,
    {
      id: string;
      codigo: string | null;
      tipo_movimiento: string | null;
      observaciones: string | null;
      origen_nombre: string | null;
      destino_nombre: string | null;
      proyecto_nombre: string | null;
    }
  >;
  contabilidadPorInvoice: Map<string, { id: string; invoice_number: string | null }>;
};

type MovBase = {
  id: string;
  tipo_movimiento: string;
  delta_disponible: number | null;
  delta_reservada: number | null;
  delta_transito_entrante: number | null;
  created_at: string;
  notas: string | null;
  referencia_tipo: string | null;
  referencia_id: string | null;
  documento_id: string | null;
};

function cantidadPrincipal(m: MovBase): number {
  const d = Number(m.delta_disponible) || 0;
  if (d !== 0) return d;
  const r = Number(m.delta_reservada) || 0;
  if (r !== 0) return r;
  return Number(m.delta_transito_entrante) || 0;
}

function textoLower(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => String(p ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function esPrestamo(texto: string): boolean {
  return /pr[eé]stamo|traspaso|\/traspaso|devoluci[oó]n pr[eé]stamo/.test(texto);
}

function esPerdida(texto: string): boolean {
  return /p[eé]rdida|deterioro|merma|robo|da[nñ]o|desecho|obsolesc/.test(texto);
}

function esNotaEntrega(texto: string, formaIngreso?: string | null): boolean {
  if (formaIngreso === 'con_nota') return true;
  return /nota de entrega|origen: nota|con_nota|frm/.test(texto);
}

function esEntradaOcr(texto: string, tipoRecepcion?: string | null): boolean {
  if (tipoRecepcion === 'factura_canal') return true;
  return /ocr|canal|ia|telegram.*factura|ingreso ocr|pendiente canal/.test(texto);
}

export function clasificarTipoMovimientoTrazabilidad(
  mov: MovBase,
  ctx: ContextoEnriquecimientoTrazabilidad,
): TipoMovimientoTrazabilidad {
  const refTipo = String(mov.referencia_tipo ?? '').trim().toLowerCase();
  const refId = String(mov.referencia_id ?? '').trim();
  const notas = String(mov.notas ?? '');
  const texto = textoLower(notas, refTipo);
  const qty = cantidadPrincipal(mov);
  const ledger = String(mov.tipo_movimiento ?? '').trim();

  if (ledger === 'anulacion') return 'anulacion';

  const trf = refId ? ctx.transferencia.get(refId) : undefined;
  if (trf || ledger === 'transferencia_salida' || ledger === 'transferencia_entrada') {
    const obsTrf = textoLower(trf?.observaciones, trf?.tipo_movimiento);
    if (trf?.tipo_movimiento === 'salida_obra') return 'despacho_obra';
    if (trf?.tipo_movimiento === 'retorno_merma') return 'perdida_deterioro';
    if (esPrestamo(textoLower(texto, obsTrf))) return 'prestamo';
    return 'transferencia';
  }

  if (ledger === 'salida_obra') return 'despacho_obra';

  const rec = refId ? ctx.recepcion.get(refId) : undefined;
  if (ledger === 'recepcion_campo' || refTipo.includes('recepcion') || rec) {
    const obsRec = textoLower(rec?.observaciones, rec?.tipo);
    if (esNotaEntrega(textoLower(texto, obsRec), rec?.forma_ingreso)) return 'nota_entrega';
    if (esEntradaOcr(textoLower(texto, obsRec), rec?.tipo)) return 'entrada_ocr';
    return 'entrada_manual';
  }

  if (
    ledger === 'ingreso_compra' ||
    refTipo.includes('compras_factura') ||
    refTipo.includes('quality_inspection') ||
    refTipo.includes('purchase_invoice')
  ) {
    return 'entrada_ocr';
  }

  if (ledger === 'ajuste') {
    if (qty < 0 && esPerdida(texto)) return 'perdida_deterioro';
    if (qty < 0 && /salida|obra|consumo|despacho/.test(texto)) return 'despacho_obra';
    if (qty > 0 && esNotaEntrega(texto)) return 'nota_entrega';
    if (qty > 0 && esEntradaOcr(texto)) return 'entrada_ocr';
    if (qty > 0 && /ingreso manual|recepci[oó]n campo/.test(texto)) return 'entrada_manual';
    if (qty < 0 && esPrestamo(texto)) return 'prestamo';
    if (qty < 0) return 'despacho_obra';
    if (qty > 0) return 'entrada_manual';
  }

  if (qty < 0 && esPerdida(texto)) return 'perdida_deterioro';
  if (qty < 0) return 'despacho_obra';
  if (qty > 0) return 'entrada_manual';
  return 'ajuste';
}

export function etiquetaTipoMovimientoTrazabilidad(tipo: TipoMovimientoTrazabilidad): string {
  return ETIQUETAS_TIPO_TRAZABILIDAD[tipo] ?? tipo;
}

export function badgeClasesTipoMovimientoTrazabilidad(tipo: TipoMovimientoTrazabilidad): string {
  return BADGE_TIPO_TRAZABILIDAD[tipo] ?? BADGE_TIPO_TRAZABILIDAD.ajuste;
}

export type OrigenDocumentoTrazabilidad = {
  texto: string;
  enlace: string | null;
};

export function resolverOrigenDocumentoTrazabilidad(
  mov: MovBase,
  ctx: ContextoEnriquecimientoTrazabilidad,
  ubicacionNombre: string,
  tipo: TipoMovimientoTrazabilidad,
): OrigenDocumentoTrazabilidad {
  const refTipo = String(mov.referencia_tipo ?? '').trim().toLowerCase();
  const refId = String(mov.referencia_id ?? '').trim();
  const qty = cantidadPrincipal(mov);

  if (qty >= 0) {
    const cf = refId ? ctx.comprasFactura.get(refId) : undefined;
    if (cf?.numero_factura) {
      const ccId =
        cf.contabilidad_id ??
        (cf.purchase_invoice_id ? ctx.contabilidadPorInvoice.get(cf.purchase_invoice_id)?.id : null);
      const enlace = ccId
        ? `/contabilidad/compras?q=${encodeURIComponent(cf.numero_factura ?? '')}`
        : `/contabilidad/compras?q=${encodeURIComponent(cf.numero_factura ?? '')}`;
      return { texto: `Factura ${cf.numero_factura}`, enlace };
    }

    const rec = refId ? ctx.recepcion.get(refId) : undefined;
    if (rec?.num_doc) {
      const doc = rec.num_doc.trim();
      if (tipo === 'nota_entrega') {
        return { texto: `Nota de entrega ${doc}`, enlace: null };
      }
      return { texto: `Recepción ${doc}`, enlace: null };
    }

    if (tipo === 'entrada_ocr') {
      return { texto: 'Factura / ingreso OCR', enlace: '/contabilidad/compras/canal' };
    }
    if (tipo === 'nota_entrega') {
      return { texto: 'Nota de entrega', enlace: null };
    }
    if (tipo === 'entrada_manual') {
      return { texto: 'Ingreso manual en campo', enlace: null };
    }
    if (refTipo.includes('quality_inspection')) {
      return { texto: 'Inspección de calidad / compra', enlace: '/contabilidad/compras' };
    }
    return { texto: 'Entrada a inventario', enlace: null };
  }

  const trf = refId ? ctx.transferencia.get(refId) : undefined;
  if (trf?.codigo) {
    return { texto: `Egreso desde ${trf.origen_nombre ?? ubicacionNombre} · ${trf.codigo}`, enlace: null };
  }

  return {
    texto: ubicacionNombre ? `Egreso desde ${ubicacionNombre}` : 'Egreso de almacén',
    enlace: null,
  };
}

export function resolverDestinoResponsableTrazabilidad(
  mov: MovBase,
  ctx: ContextoEnriquecimientoTrazabilidad,
  ubicacionNombre: string,
  proyectoNombre: string | null,
  tipo: TipoMovimientoTrazabilidad,
): string {
  const refId = String(mov.referencia_id ?? '').trim();
  const notas = String(mov.notas ?? '').trim();
  const trf = refId ? ctx.transferencia.get(refId) : undefined;
  const rec = refId ? ctx.recepcion.get(refId) : undefined;

  if (tipo === 'transferencia' || tipo === 'prestamo') {
    const dest = trf?.destino_nombre?.trim();
    if (dest) {
      return tipo === 'prestamo' ? `Préstamo → ${dest}` : dest;
    }
    if (notas) return notas.slice(0, 180);
    return proyectoNombre ?? ubicacionNombre ?? '—';
  }

  if (tipo === 'despacho_obra') {
    return trf?.proyecto_nombre?.trim() || proyectoNombre || notas.slice(0, 180) || 'Consumo en obra';
  }

  if (tipo === 'perdida_deterioro') {
    return notas.slice(0, 180) || trf?.observaciones?.slice(0, 180) || 'Pérdida / deterioro registrado';
  }

  if (tipo === 'entrada_manual' || tipo === 'entrada_ocr' || tipo === 'nota_entrega') {
    return rec?.proyecto_nombre?.trim() || proyectoNombre || ubicacionNombre || '—';
  }

  if (notas) return notas.slice(0, 180);
  return proyectoNombre ?? ubicacionNombre ?? '—';
}
