import type { SupabaseClient } from '@supabase/supabase-js';

export type AccionFacturaPendiente = 'confirmar' | 'ingreso_almacen';

export type OrigenFacturaPendiente = 'telegram' | 'whatsapp' | 'app';

export type FacturaPendienteIngreso = {
  key: string;
  origen: OrigenFacturaPendiente;
  origenLabel: string;
  invoice_number: string | null;
  supplier_name: string | null;
  fecha: string | null;
  estado: string;
  accion: AccionFacturaPendiente;
  pendienteId: string;
  purchase_invoice_id: string | null;
};

/** Estados con acción pendiente de ingreso / confirmación. */
const ESTADOS_TRANSITO = ['extraido', 'aprobado_sistema', 'confirmado'] as const;

export type IndiceContabilidadIngreso = {
  ingresadasClaves: Set<string>;
  ingresadasPi: Set<string>;
  /** Compras OpEx (imputacion entidad): no van a /ingreso ni recepción tránsito. */
  gastoEntidadPi: Set<string>;
  gastoEntidadClaves: Set<string>;
  abiertasPorClave: Map<
    string,
    { purchase_invoice_id: string; ubicacion_destino_id: string | null }
  >;
};

type FilaCanalPendiente = {
  id: string;
  canal?: string | null;
  chat_label?: string | null;
  estado?: string | null;
  purchase_invoice_id?: string | null;
  ubicacion_destino_id?: string | null;
  extracted?: Record<string, unknown> | null;
  created_at?: string | null;
};

function extraerNumero(extracted: Record<string, unknown> | null | undefined): string | null {
  if (!extracted) return null;
  const n = extracted.invoice_number ?? extracted.numero;
  const s = String(n ?? '').trim();
  return s || null;
}

function extraerProveedor(extracted: Record<string, unknown> | null | undefined): string | null {
  if (!extracted) return null;
  const n = extracted.supplier_name ?? extracted.proveedor;
  const s = String(n ?? '').trim();
  return s || null;
}

/** Clave estable proveedor + número para cruzar con contabilidad_compras. */
export function claveFacturaCompra(
  supplier: string | null | undefined,
  invoice: string | null | undefined,
): string | null {
  const prov = normalizarTextoFactura(supplier);
  const num = normalizarNumeroFactura(invoice);
  if (!prov || !num) return null;
  return `${prov}|${num}`;
}

function normalizarTextoFactura(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function normalizarNumeroFactura(value: string | null | undefined): string {
  const t = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!t) return '';
  const sinCeros = t.replace(/^0+/, '');
  return sinCeros || t;
}

function labelOrigen(canal: string): { origen: OrigenFacturaPendiente; label: string } {
  if (canal === 'telegram') return { origen: 'telegram', label: '📱 Telegram' };
  if (canal === 'whatsapp') return { origen: 'whatsapp', label: '💬 WhatsApp' };
  return { origen: 'app', label: '🌐 App' };
}

export async function cargarIndiceContabilidadIngreso(
  supabase: SupabaseClient,
): Promise<IndiceContabilidadIngreso> {
  const ingresadasClaves = new Set<string>();
  const ingresadasPi = new Set<string>();
  const gastoEntidadPi = new Set<string>();
  const gastoEntidadClaves = new Set<string>();
  const abiertasPorClave = new Map<
    string,
    { purchase_invoice_id: string; ubicacion_destino_id: string | null }
  >();

  const { data: compras, error: cErr } = await supabase
    .from('contabilidad_compras')
    .select(
      'purchase_invoice_id, invoice_number, supplier_name, ingresado_almacen_at, ubicacion_destino_id, imputacion',
    )
    .limit(2000);

  if (cErr && cErr.code !== '42P01') {
    if (!/ingresado_almacen_at|42703|does not exist/i.test(cErr.message ?? '')) {
      throw new Error(cErr.message);
    }
  }

  for (const row of compras ?? []) {
    const pi = String(row.purchase_invoice_id ?? '').trim();
    const clave = claveFacturaCompra(row.supplier_name, row.invoice_number);
    const ingresada = Boolean((row as { ingresado_almacen_at?: string | null }).ingresado_almacen_at);
    const imputacion = String((row as { imputacion?: string | null }).imputacion ?? 'obra').trim();

    if (imputacion === 'entidad') {
      if (pi) gastoEntidadPi.add(pi);
      if (clave) gastoEntidadClaves.add(clave);
      continue;
    }

    if (ingresada) {
      if (pi) ingresadasPi.add(pi);
      if (clave) ingresadasClaves.add(clave);
      continue;
    }

    if (pi && clave && !abiertasPorClave.has(clave)) {
      abiertasPorClave.set(clave, {
        purchase_invoice_id: pi,
        ubicacion_destino_id: String(row.ubicacion_destino_id ?? '').trim() || null,
      });
    }
  }

  if (!ingresadasPi.size) {
    const { data: facturas, error: fErr } = await supabase
      .from('compras_facturas')
      .select('purchase_invoice_id, numero_factura, proveedor_nombre, estado, registrada_at')
      .not('purchase_invoice_id', 'is', null)
      .limit(2000);

    if (fErr && fErr.code !== '42P01') throw new Error(fErr.message);

    for (const row of facturas ?? []) {
      const pi = String(row.purchase_invoice_id ?? '').trim();
      if (!pi) continue;
      const estado = String(row.estado ?? '');
      const registrada = Boolean((row as { registrada_at?: string | null }).registrada_at);
      if (estado !== 'registrada' && !registrada) continue;

      ingresadasPi.add(pi);
      const clave = claveFacturaCompra(row.proveedor_nombre, row.numero_factura);
      if (clave) ingresadasClaves.add(clave);
    }
  }

  return { ingresadasClaves, ingresadasPi, gastoEntidadPi, gastoEntidadClaves, abiertasPorClave };
}

/** Compra OpEx (gasto entidad): excluida de ingreso físico y tránsito. */
export function compraEsGastoEntidadIndice(
  row: Pick<FilaCanalPendiente, 'purchase_invoice_id' | 'extracted'>,
  indice: IndiceContabilidadIngreso,
): boolean {
  const pi = resolverPiEfectivo(row, indice);
  if (pi && indice.gastoEntidadPi.has(pi)) return true;
  const clave = claveFacturaCompra(
    extraerProveedor(row.extracted ?? null),
    extraerNumero(row.extracted ?? null),
  );
  return Boolean(clave && indice.gastoEntidadClaves.has(clave));
}

function resolverPiEfectivo(
  row: Pick<FilaCanalPendiente, 'purchase_invoice_id' | 'extracted'>,
  indice: IndiceContabilidadIngreso,
): string | null {
  const piDirecto = String(row.purchase_invoice_id ?? '').trim();
  if (piDirecto) return piDirecto;

  const clave = claveFacturaCompra(
    extraerProveedor(row.extracted ?? null),
    extraerNumero(row.extracted ?? null),
  );
  if (!clave) return null;
  return indice.abiertasPorClave.get(clave)?.purchase_invoice_id ?? null;
}

function resolverUbicacionEfectiva(
  row: Pick<FilaCanalPendiente, 'ubicacion_destino_id' | 'extracted'>,
  indice: IndiceContabilidadIngreso,
  piEfectivo: string | null,
): string | null {
  const ubiDirecta = String(row.ubicacion_destino_id ?? '').trim();
  if (ubiDirecta) return ubiDirecta;

  const clave = claveFacturaCompra(
    extraerProveedor(row.extracted ?? null),
    extraerNumero(row.extracted ?? null),
  );
  if (!clave) return null;

  const abierta = indice.abiertasPorClave.get(clave);
  if (abierta?.ubicacion_destino_id) return abierta.ubicacion_destino_id;

  if (piEfectivo && abierta?.purchase_invoice_id === piEfectivo) {
    return abierta.ubicacion_destino_id;
  }

  return null;
}

export function resolverAccionIngresoFactura(
  row: {
    estado: string;
    purchase_invoice_id: string | null;
    ubicacion_destino_id: string | null;
  },
  indice: IndiceContabilidadIngreso,
  extracted?: Record<string, unknown> | null,
): AccionFacturaPendiente | null {
  const estado = String(row.estado ?? '');
  if (!ESTADOS_TRANSITO.includes(estado as (typeof ESTADOS_TRANSITO)[number])) return null;

  const piEfectivo = resolverPiEfectivo({ purchase_invoice_id: row.purchase_invoice_id, extracted }, indice);
  const ubiEfectiva =
    resolverUbicacionEfectiva(
      { ubicacion_destino_id: row.ubicacion_destino_id, extracted },
      indice,
      piEfectivo,
    ) ?? (String(row.ubicacion_destino_id ?? '').trim() || null);

  if (piEfectivo && ubiEfectiva) {
    return 'ingreso_almacen';
  }

  if (estado === 'aprobado_sistema') {
    // Fast-track incompleto o registro huérfano: no accionable desde Telegram.
    return null;
  }

  if (estado === 'extraido') {
    return 'confirmar';
  }

  return null;
}

export function facturaCanalYaIngresada(
  row: Pick<FilaCanalPendiente, 'purchase_invoice_id' | 'extracted'>,
  indice: IndiceContabilidadIngreso,
): boolean {
  const pi = resolverPiEfectivo(row, indice);
  if (pi && indice.ingresadasPi.has(pi)) return true;

  const clave = claveFacturaCompra(
    extraerProveedor(row.extracted ?? null),
    extraerNumero(row.extracted ?? null),
  );
  return Boolean(clave && indice.ingresadasClaves.has(clave));
}

type FilaCompraContabilidad = {
  id: string;
  purchase_invoice_id?: string | null;
  invoice_number?: string | null;
  supplier_name?: string | null;
  fecha?: string | null;
  ubicacion_destino_id?: string | null;
  origen?: string | null;
  created_at?: string | null;
  proyecto_id?: string | null;
  imputacion?: string | null;
};

function labelOrigenContabilidad(
  origen: string | null | undefined,
): { origen: OrigenFacturaPendiente; label: string } {
  const o = String(origen ?? '').toUpperCase();
  if (o === 'TELEGRAM') return { origen: 'telegram', label: '📱 Telegram' };
  if (o === 'WHATSAPP') return { origen: 'whatsapp', label: '💬 WhatsApp' };
  return { origen: 'app', label: '📊 Contabilidad' };
}

function mapCompraContabilidadAFactura(
  row: FilaCompraContabilidad,
  indice: IndiceContabilidadIngreso,
  pisEnLista: Set<string>,
): FacturaPendienteIngreso | null {
  const pi = String(row.purchase_invoice_id ?? '').trim();
  if (!pi) return null;
  if (indice.ingresadasPi.has(pi)) return null;
  if (indice.gastoEntidadPi.has(pi)) return null;
  if (pisEnLista.has(pi)) return null;

  const clave = claveFacturaCompra(row.supplier_name, row.invoice_number);
  if (clave && indice.ingresadasClaves.has(clave)) return null;
  if (clave && indice.gastoEntidadClaves.has(clave)) return null;

  const imputacion = String(row.imputacion ?? 'obra').trim();
  if (imputacion === 'entidad') return null;

  const proveedor = String(row.supplier_name ?? '').trim() || null;
  const numero = String(row.invoice_number ?? '').trim() || null;
  if (!proveedor && !numero) return null;

  const ubi = String(row.ubicacion_destino_id ?? '').trim() || null;
  const accion: AccionFacturaPendiente = ubi ? 'ingreso_almacen' : 'confirmar';
  const { origen, label } = labelOrigenContabilidad(row.origen);

  return {
    key: `cc:${row.id}`,
    origen,
    origenLabel: label,
    invoice_number: numero,
    supplier_name: proveedor,
    fecha:
      (row.fecha ? String(row.fecha).slice(0, 10) : null) ??
      (String(row.created_at ?? '').slice(0, 10) || null),
    estado: 'confirmado',
    accion,
    pendienteId: String(row.id),
    purchase_invoice_id: pi,
  };
}

function mapFilaCanalAFactura(
  row: FilaCanalPendiente,
  indice: IndiceContabilidadIngreso,
): FacturaPendienteIngreso | null {
  const extracted = (row.extracted ?? null) as Record<string, unknown> | null;
  const proveedor = extraerProveedor(extracted);
  const numero = extraerNumero(extracted);
  if (!proveedor && !numero) return null;

  if (facturaCanalYaIngresada(row, indice)) return null;
  if (compraEsGastoEntidadIndice(row, indice)) return null;

  const accion = resolverAccionIngresoFactura(
    {
      estado: String(row.estado ?? ''),
      purchase_invoice_id: row.purchase_invoice_id ?? null,
      ubicacion_destino_id: row.ubicacion_destino_id ?? null,
    },
    indice,
    extracted,
  );
  if (!accion) return null;

  const piEfectivo = resolverPiEfectivo(row, indice);
  const { origen, label } = labelOrigen(String(row.canal ?? 'telegram'));

  return {
    key: `cp:${row.id}`,
    origen,
    origenLabel: label,
    invoice_number: numero,
    supplier_name: proveedor,
    fecha:
      (extracted?.date ? String(extracted.date).slice(0, 10) : null) ??
      (String(row.created_at ?? '').slice(0, 10) || null),
    estado: String(row.estado ?? ''),
    accion,
    pendienteId: String(row.id),
    purchase_invoice_id: piEfectivo,
  };
}

/**
 * Facturas precargadas visibles en Recepción → tránsito, /ingreso y /ingresofactura (Telegram).
 * Incluye canal (Telegram/WhatsApp) y compras abiertas en contabilidad sin ingreso a almacén.
 */
export async function listarFacturasPendientesIngreso(
  supabase: SupabaseClient,
): Promise<FacturaPendienteIngreso[]> {
  const indice = await cargarIndiceContabilidadIngreso(supabase);

  const { data: canalRows, error: canalErr } = await supabase
    .from('ci_facturas_canal_pendientes')
    .select(
      'id, canal, chat_label, estado, purchase_invoice_id, ubicacion_destino_id, extracted, created_at',
    )
    .in('estado', [...ESTADOS_TRANSITO])
    .order('created_at', { ascending: false })
    .limit(100);

  if (canalErr && canalErr.code !== '42P01') throw new Error(canalErr.message);

  const items: FacturaPendienteIngreso[] = [];

  const pisEnLista = new Set<string>();

  for (const row of canalRows ?? []) {
    const mapped = mapFilaCanalAFactura(row as FilaCanalPendiente, indice);
    if (mapped) {
      items.push(mapped);
      const pi = mapped.purchase_invoice_id?.trim();
      if (pi) pisEnLista.add(pi);
    }
  }

  const { data: comprasAbiertas, error: comprasErr } = await supabase
    .from('contabilidad_compras')
    .select(
      'id, purchase_invoice_id, invoice_number, supplier_name, fecha, ubicacion_destino_id, origen, created_at, proyecto_id, imputacion',
    )
    .not('purchase_invoice_id', 'is', null)
    .is('ingresado_almacen_at', null)
    .neq('imputacion', 'entidad')
    .order('fecha', { ascending: false })
    .limit(200);

  if (comprasErr && comprasErr.code !== '42P01') {
    if (!/ingresado_almacen_at|42703|does not exist/i.test(comprasErr.message ?? '')) {
      throw new Error(comprasErr.message);
    }
  }

  for (const row of comprasAbiertas ?? []) {
    const mapped = mapCompraContabilidadAFactura(row as FilaCompraContabilidad, indice, pisEnLista);
    if (mapped) {
      items.push(mapped);
      const pi = mapped.purchase_invoice_id?.trim();
      if (pi) pisEnLista.add(pi);
    }
  }

  return items.sort((a, b) => {
    const pa = (a.supplier_name ?? '').localeCompare(b.supplier_name ?? '', 'es');
    if (pa !== 0) return pa;
    return (b.fecha ?? '').localeCompare(a.fecha ?? '');
  });
}

/** Misma regla que /ingresofactura, aplicada a filas completas del panel de recepción. */
export function filtrarCanalPendientesParaIngreso<T extends FilaCanalPendiente>(
  rows: T[],
  indice: IndiceContabilidadIngreso,
): T[] {
  return rows.filter((row) => mapFilaCanalAFactura(row, indice) !== null);
}

export type PendienteCanalRecepcion = {
  id: string;
  canal?: string | null;
  estado: string;
  chat_label: string | null;
  proyecto_id: string | null;
  ubicacion_destino_id: string | null;
  purchase_invoice_id: string | null;
  document_file_name: string | null;
  extracted: Record<string, unknown> | null;
  created_at: string;
};

/** Añade compras registradas solo en contabilidad al panel Recepción → tránsito. */
export async function ampliarPendientesCanalConContabilidad(
  supabase: SupabaseClient,
  pendientesCanal: PendienteCanalRecepcion[],
): Promise<PendienteCanalRecepcion[]> {
  const indice = await cargarIndiceContabilidadIngreso(supabase);
  const pisEnLista = new Set(
    pendientesCanal.map((p) => String(p.purchase_invoice_id ?? '').trim()).filter(Boolean),
  );

  const { data: comprasAbiertas, error } = await supabase
    .from('contabilidad_compras')
    .select(
      'id, purchase_invoice_id, invoice_number, supplier_name, fecha, ubicacion_destino_id, origen, created_at, proyecto_id, imputacion',
    )
    .not('purchase_invoice_id', 'is', null)
    .is('ingresado_almacen_at', null)
    .neq('imputacion', 'entidad')
    .order('fecha', { ascending: false })
    .limit(200);

  if (error && error.code !== '42P01') {
    if (!/ingresado_almacen_at|42703|does not exist/i.test(error.message ?? '')) {
      throw new Error(error.message);
    }
  }

  const extra: PendienteCanalRecepcion[] = [];

  for (const row of comprasAbiertas ?? []) {
    const mapped = mapCompraContabilidadAFactura(row as FilaCompraContabilidad, indice, pisEnLista);
    if (!mapped || mapped.accion !== 'ingreso_almacen') continue;

    extra.push({
      id: mapped.pendienteId,
      canal: 'app',
      estado: 'confirmado',
      chat_label: mapped.origenLabel,
      proyecto_id: String(row.proyecto_id ?? '').trim() || null,
      ubicacion_destino_id: String(row.ubicacion_destino_id ?? '').trim() || null,
      purchase_invoice_id: mapped.purchase_invoice_id,
      document_file_name: null,
      extracted: {
        supplier_name: mapped.supplier_name,
        invoice_number: mapped.invoice_number,
        date: mapped.fecha,
      },
      created_at: String(row.fecha ?? new Date().toISOString()),
    });

    const pi = mapped.purchase_invoice_id?.trim();
    if (pi) pisEnLista.add(pi);
  }

  return [...pendientesCanal, ...extra];
}
