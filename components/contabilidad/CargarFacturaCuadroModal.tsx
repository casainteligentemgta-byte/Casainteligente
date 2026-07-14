'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  Images,
  Loader2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadProcurementDocument } from '@/lib/almacen/procurementDocumentStorage';
import { calcularGastoBimonetario } from '@/lib/finanzas/currency-converter';
import { resolverTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';
import { createClient } from '@/lib/supabase/client';
import type { ProyectoCatalogo } from '@/lib/proyectos/proyectosUnificados';
import {
  esArchivoCsvTabla,
  parseCsvTablaCompras,
} from '@/lib/contabilidad/parseCsvTablaCompras';

type FilaApi = {
  invoice_number?: string;
  supplier_name?: string;
  supplier_rif?: string;
  date?: string;
  descripcion?: string;
  item_code?: string;
  unidad?: string;
  cantidad?: number;
  precio_unitario?: number;
  subtotal?: number;
  moneda?: string;
};

type LineaGrupo = {
  key: string;
  descripcion: string;
  item_code: string;
  unidad: string;
  cantidad: string;
  precio_unitario: string;
  subtotal: string;
};

type FotoAdjunto = {
  id: string;
  file: File;
  previewUrl: string;
};

/** Una factura del cuadro (puede agrupar varias filas de la tabla). */
type GrupoFactura = {
  key: string;
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  fecha: string;
  moneda: 'VES' | 'USD';
  lineas: LineaGrupo[];
  fotoId: string | null;
  certificada: boolean;
  tasaBcv: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onGuardado?: () => void;
  proyectos: ProyectoCatalogo[];
  proyectoIdInicial?: string | null;
};

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500';
const labelClass =
  'mb-1 block text-[10px] font-bold uppercase tracking-wide text-zinc-500';

function nuevoKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseNum(raw: string): number {
  const n = Number(String(raw).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function fechaParaInputDate(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return '';
  }
  return s;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function claveFactura(invoice: string, rif: string, proveedor: string): string {
  const a = invoice.trim().toUpperCase() || 'SIN-NUM';
  const b = rif.trim().toUpperCase() || proveedor.trim().toUpperCase() || 'SIN-PROV';
  return `${a}::${b}`;
}

function agruparFilas(filas: FilaApi[]): GrupoFactura[] {
  const map = new Map<string, GrupoFactura>();
  for (const f of filas) {
    const invoice = (f.invoice_number ?? '').trim();
    const supplier = (f.supplier_name ?? '').trim();
    const rif = (f.supplier_rif ?? '').trim();
    const key = claveFactura(invoice, rif, supplier);
    const moneda = String(f.moneda ?? 'VES').toUpperCase() === 'USD' ? 'USD' : 'VES';
    const linea: LineaGrupo = {
      key: nuevoKey(),
      descripcion: (f.descripcion ?? '').trim() || 'Ítem',
      item_code: (f.item_code ?? '').trim(),
      unidad: (f.unidad ?? 'UND').trim() || 'UND',
      cantidad: String(f.cantidad ?? 1),
      precio_unitario: String(f.precio_unitario ?? 0),
      subtotal: String(f.subtotal ?? 0),
    };
    const existing = map.get(key);
    if (existing) {
      existing.lineas.push(linea);
      if (!existing.fecha && f.date) existing.fecha = String(f.date).slice(0, 10);
      if (!existing.supplier_rif && rif) existing.supplier_rif = rif;
      if (!existing.supplier_name && supplier) existing.supplier_name = supplier;
    } else {
      map.set(key, {
        key,
        invoice_number: invoice || `SIN-${map.size + 1}`,
        supplier_name: supplier,
        supplier_rif: rif,
        fecha: fechaParaInputDate(f.date) || hoyIso(),
        moneda,
        lineas: [linea],
        fotoId: null,
        certificada: false,
        tasaBcv: '',
      });
    }
  }
  return Array.from(map.values());
}

function totalGrupo(g: GrupoFactura): number {
  const suma = g.lineas.reduce((acc, l) => {
    const st = parseNum(l.subtotal);
    if (st > 0) return acc + st;
    return acc + parseNum(l.cantidad) * parseNum(l.precio_unitario);
  }, 0);
  return Math.round(suma * 100) / 100;
}

/**
 * Sube el archivo con progreso real de upload (0–28%) y luego estima el
 * análisis IA (28–95%) hasta recibir la respuesta.
 */
function mensajeErrorAmigable(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error al leer la tabla';
  if (/did not match the expected pattern/i.test(raw) || /JSON Parse error/i.test(raw)) {
    return (
      'No se pudo interpretar la respuesta del servidor. ' +
      'Pruebe: 1) Chrome, 2) CSV desde Excel, 3) captura PNG de la tabla.'
    );
  }
  return raw || 'Error al leer la tabla';
}

function parseRespuestaExtractTabla(raw: string, status: number): {
  error?: string;
  filas?: FilaApi[];
  total_filas?: number;
} {
  const t = (raw ?? '').trim();
  if (!t) {
    throw new Error(
      status === 413 || status === 502 || status === 504
        ? `El servidor cortó la carga (HTTP ${status}). Exporte la tabla a CSV desde Excel y súbala aquí.`
        : `Respuesta vacía del servidor (HTTP ${status}). Use CSV desde Excel (más fiable que PDF).`,
    );
  }
  // Vercel a veces devuelve HTML en timeout — no intentar parsear como JSON “a ciegas”
  if (/^<!DOCTYPE|^<html/i.test(t) || (status >= 500 && !t.startsWith('{'))) {
    throw new Error(
      `El servidor no respondió a tiempo (HTTP ${status}). Exporte la tabla a CSV: en Excel → Archivo → Guardar como → CSV UTF-8.`,
    );
  }
  const tryParse = (s: string) =>
    JSON.parse(s) as {
      error?: string;
      filas?: FilaApi[];
      total_filas?: number;
    };
  try {
    return tryParse(t);
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return tryParse(t.slice(start, end + 1));
      } catch {
        /* fallthrough */
      }
    }
    throw new Error(
      `No se pudo leer la respuesta (HTTP ${status}). Solución recomendada: Excel → Guardar como CSV UTF-8 → subir el .csv.`,
    );
  }
}

function postExtractTablaWithProgress(
  file: File,
  onProgress: (pct: number, etapa: string) => void,
): Promise<{
  ok: boolean;
  status: number;
  payload: { error?: string; filas?: FilaApi[]; total_filas?: number };
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    let tick: ReturnType<typeof setInterval> | null = null;
    let analysisPct = 28;

    const clearTick = () => {
      if (tick) {
        clearInterval(tick);
        tick = null;
      }
    };

    const startAnalysisEstimate = () => {
      analysisPct = 28;
      onProgress(28, 'Analizando tabla con IA…');
      clearTick();
      tick = setInterval(() => {
        analysisPct = Math.min(95, analysisPct + (analysisPct < 60 ? 1.2 : analysisPct < 80 ? 0.6 : 0.25));
        onProgress(Math.round(analysisPct), 'Extrayendo filas de la tabla…');
      }, 900);
    };

    xhr.upload.addEventListener('progress', (ev) => {
      if (!ev.lengthComputable) {
        onProgress(12, 'Subiendo archivo…');
        return;
      }
      const uploaded = Math.round((ev.loaded / ev.total) * 28);
      onProgress(Math.max(2, uploaded), 'Subiendo archivo…');
    });

    xhr.upload.addEventListener('load', () => {
      startAnalysisEstimate();
    });

    xhr.addEventListener('load', () => {
      clearTick();
      try {
        const payload = parseRespuestaExtractTabla(xhr.responseText ?? '', xhr.status);
        onProgress(100, 'Listo');
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          payload,
        });
      } catch (e) {
        reject(new Error(mensajeErrorAmigable(e)));
      }
    });

    xhr.addEventListener('error', () => {
      clearTick();
      reject(new Error('No se pudo conectar con el servidor al leer la tabla.'));
    });

    xhr.addEventListener('abort', () => {
      clearTick();
      reject(new Error('Lectura de tabla cancelada.'));
    });

    xhr.addEventListener('timeout', () => {
      clearTick();
      reject(
        new Error(
          'La lectura de la tabla tardó demasiado. Pruebe un CSV o una captura PNG de la tabla.',
        ),
      );
    });

    onProgress(1, 'Preparando archivo…');
    xhr.open('POST', '/api/contabilidad/compras/extract-tabla');
    xhr.timeout = 180_000;
    xhr.responseType = 'text';
    xhr.send(form);
  });
}

export default function CargarFacturaCuadroModal({
  open,
  onClose,
  onGuardado,
  proyectos,
  proyectoIdInicial,
}: Props) {
  const tablaRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef<HTMLInputElement>(null);
  const [proyectoId, setProyectoId] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractPct, setExtractPct] = useState(0);
  const [extractEtapa, setExtractEtapa] = useState('');
  const [saving, setSaving] = useState(false);
  const [tablaNombre, setTablaNombre] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoFactura[]>([]);
  const [fotos, setFotos] = useState<FotoAdjunto[]>([]);
  const [activoKey, setActivoKey] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setExtracting(false);
    setExtractPct(0);
    setExtractEtapa('');
    setSaving(false);
    setTablaNombre(null);
    setGrupos([]);
    setActivoKey(null);
    setFotos((prev) => {
      for (const f of prev) URL.revokeObjectURL(f.previewUrl);
      return [];
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    resetAll();
    setProyectoId('');
    const inicial = proyectoIdInicial?.trim();
    if (inicial && proyectos.some((p) => p.id === inicial)) {
      setProyectoId(inicial);
    }
  }, [open, proyectoIdInicial, proyectos, resetAll]);

  useEffect(() => {
    if (!open || grupos.length === 0) return;
    let cancelled = false;
    const fechas = Array.from(new Set(grupos.map((g) => g.fecha).filter(Boolean)));
    void (async () => {
      const tasas = new Map<string, number>();
      await Promise.all(
        fechas.map(async (fecha) => {
          try {
            const r = await resolverTasaBcvVesPorUsd(fecha);
            if (r.tasa_bcv_ves_por_usd > 0) tasas.set(fecha, r.tasa_bcv_ves_por_usd);
          } catch {
            /* manual */
          }
        }),
      );
      if (cancelled) return;
      setGrupos((prev) =>
        prev.map((g) => {
          if (g.tasaBcv.trim()) return g;
          const t = tasas.get(g.fecha);
          return t ? { ...g, tasaBcv: String(t) } : g;
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, grupos.length]); // eslint-disable-line react-hooks/exhaustive-deps -- solo al cargar tabla

  const activo = useMemo(
    () => grupos.find((g) => g.key === activoKey) ?? null,
    [grupos, activoKey],
  );

  const fotoActiva = useMemo(() => {
    if (!activo?.fotoId) return null;
    return fotos.find((f) => f.id === activo.fotoId) ?? null;
  }, [activo, fotos]);

  const stats = useMemo(() => {
    const cert = grupos.filter((g) => g.certificada).length;
    const conFoto = grupos.filter((g) => g.fotoId).length;
    return { total: grupos.length, cert, conFoto };
  }, [grupos]);

  const onPickTabla = async (file: File) => {
    setExtracting(true);
    setExtractPct(0);
    setExtractEtapa('Preparando…');
    try {
      // CSV/TSV: parseo local (sin IA) — evita el fallo Safari/Gemini en PDF grandes
      if (esArchivoCsvTabla(file)) {
        setExtractPct(20);
        setExtractEtapa('Leyendo CSV…');
        const text = await file.text();
        setExtractPct(70);
        setExtractEtapa('Procesando filas…');
        const filas = parseCsvTablaCompras(text);
        const agrupados = agruparFilas(filas);
        setExtractPct(100);
        setExtractEtapa('Completado');
        setTablaNombre(file.name);
        setGrupos(agrupados);
        setActivoKey(agrupados[0]?.key ?? null);
        toast.success(
          `${filas.length} filas → ${agrupados.length} factura(s) desde CSV. Adjunte fotos y certifique.`,
        );
        return;
      }

      const { ok, status, payload } = await postExtractTablaWithProgress(file, (pct, etapa) => {
        setExtractPct(pct);
        setExtractEtapa(etapa);
      });

      if (!ok) {
        throw new Error(
          mensajeErrorAmigable(payload.error || `No se pudo leer la tabla (HTTP ${status})`),
        );
      }
      const agrupados = agruparFilas(payload.filas ?? []);
      if (agrupados.length === 0) {
        throw new Error('La tabla no devolvió filas utilizables');
      }
      setExtractPct(100);
      setExtractEtapa('Completado');
      setTablaNombre(file.name);
      setGrupos(agrupados);
      setActivoKey(agrupados[0]?.key ?? null);
      toast.success(
        `${payload.total_filas ?? 0} filas → ${agrupados.length} factura(s). Adjunte fotos y certifique.`,
      );
    } catch (e) {
      toast.error(mensajeErrorAmigable(e));
    } finally {
      setExtracting(false);
      setExtractPct(0);
      setExtractEtapa('');
    }
  };

  const onPickFotos = (list: FileList | null) => {
    if (!list?.length) return;
    const nuevas: FotoAdjunto[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`Omitido (no es imagen/PDF): ${file.name}`);
        continue;
      }
      nuevas.push({
        id: nuevoKey(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (nuevas.length === 0) return;
    setFotos((prev) => [...prev, ...nuevas]);
    toast.success(`${nuevas.length} foto(s) agregada(s). Asigne cada una a una factura.`);
  };

  const updateGrupo = (key: string, patch: Partial<GrupoFactura>) => {
    setGrupos((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  };

  const asignarFoto = (grupoKey: string, fotoId: string | null) => {
    setGrupos((prev) =>
      prev.map((g) => {
        if (g.key !== grupoKey) {
          // una foto solo en una factura
          if (fotoId && g.fotoId === fotoId) {
            return { ...g, fotoId: null, certificada: false };
          }
          return g;
        }
        return {
          ...g,
          fotoId,
          certificada: fotoId ? g.certificada : false,
        };
      }),
    );
  };

  const toggleCertificar = (key: string) => {
    const g = grupos.find((x) => x.key === key);
    if (!g) return;
    if (!g.certificada) {
      if (!g.fotoId) {
        toast.error('Adjunte la foto de la factura antes de certificar');
        return;
      }
      if (!g.invoice_number.trim() || !g.supplier_name.trim() || !g.supplier_rif.trim()) {
        toast.error('Complete nº factura, proveedor y RIF antes de certificar');
        return;
      }
      if (!(parseNum(g.tasaBcv) > 0)) {
        toast.error('Indique la tasa BCV de la fecha de esa factura');
        return;
      }
      if (!(totalGrupo(g) > 0)) {
        toast.error('El total de la factura debe ser mayor a cero');
        return;
      }
    }
    updateGrupo(key, { certificada: !g.certificada });
  };

  const guardarCertificadas = async () => {
    if (!proyectoId) {
      toast.error('Seleccione la obra');
      return;
    }
    const listas = grupos.filter((g) => g.certificada);
    if (listas.length === 0) {
      toast.error('Certifique al menos una factura (con su foto)');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    let ok = 0;
    let fail = 0;

    try {
      for (const g of listas) {
        try {
          const foto = fotos.find((f) => f.id === g.fotoId);
          let document_storage_path: string | null = null;
          let document_file_name: string | null = null;
          if (foto) {
            const uploaded = await uploadProcurementDocument(
              supabase,
              `libro-${crypto.randomUUID()}`,
              foto.file,
            );
            document_storage_path = uploaded.path;
            document_file_name = uploaded.fileName;
          }

          const total = totalGrupo(g);
          const tasa = parseNum(g.tasaBcv);
          const montos = calcularGastoBimonetario(total, g.moneda, tasa);
          const lineas = g.lineas.map((l) => {
            const cantidad = parseNum(l.cantidad) || 1;
            const precio = parseNum(l.precio_unitario);
            const sub =
              parseNum(l.subtotal) || Math.round(cantidad * precio * 100) / 100;
            return {
              descripcion: l.descripcion.trim() || 'Ítem',
              item_code: l.item_code.trim() || null,
              unidad: l.unidad.trim() || 'UND',
              cantidad,
              precio_unitario: precio > 0 ? precio : sub / cantidad,
              subtotal: sub,
            };
          });

          const res = await fetch('/api/contabilidad/compras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proyecto_id: proyectoId,
              imputacion: 'obra',
              invoice_number: g.invoice_number.trim(),
              supplier_name: g.supplier_name.trim(),
              supplier_rif: g.supplier_rif.trim(),
              fecha: fechaParaInputDate(g.fecha) || hoyIso(),
              monto_ves: montos.montoVes,
              monto_usd: montos.montoUsd,
              tasa_bcv_fecha: montos.tasaApplied,
              moneda_original: g.moneda,
              origen: 'HISTORICO_TABLA',
              notas:
                'Importación desde tabla histórica certificada con foto de factura (solo contabilidad, sin stock).',
              document_storage_path,
              document_file_name,
              lineas,
            }),
          });
          const ct = res.headers.get('content-type') ?? '';
          let data: { error?: string; hint?: string } = {};
          if (ct.includes('application/json')) {
            data = (await res.json()) as typeof data;
          } else {
            const t = (await res.text()).trim();
            throw new Error(t.slice(0, 200) || `Error HTTP ${res.status}`);
          }
          if (!res.ok) {
            throw new Error(data.hint ? `${data.error} (${data.hint})` : data.error || 'Error');
          }
          ok += 1;
        } catch (e) {
          fail += 1;
          console.error('[guardarCertificadas]', g.invoice_number, e);
          toast.error(
            `Factura ${g.invoice_number}: ${e instanceof Error ? e.message : 'falló'}`,
          );
        }
      }

      if (ok > 0) {
        toast.success(`${ok} compra(s) certificada(s) en el cuadro (sin stock)`);
        onGuardado?.();
        setGrupos((prev) => prev.filter((g) => !g.certificada));
        if (ok === listas.length && fail === 0) {
          onClose();
        }
      } else {
        toast.error('No se pudo guardar ninguna compra');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const busy = extracting || saving;
  const fotosLibres = fotos.filter((f) => !grupos.some((g) => g.fotoId === f.id));

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/75">
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl border border-white/10 bg-[#141418] shadow-2xl"
        role="dialog"
        aria-labelledby="cargar-tabla-historica-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div>
            <h2 id="cargar-tabla-historica-title" className="text-base font-bold text-white">
              Tabla histórica + fotos
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">
              El PDF es el cuadro con datos ya extractados. Suba también las fotos de cada factura,
              revise y marque Certificar solo si coinciden. Solo contabilidad (sin stock).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className={labelClass}>Obra</label>
              <select
                className={inputClass}
                value={proyectoId}
                disabled={busy}
                onChange={(e) => setProyectoId(e.target.value)}
              >
                <option value="">Seleccione obra…</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>1. Tabla de compras</label>
              <input
                ref={csvRef}
                type="file"
                className="hidden"
                accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void onPickTabla(f);
                }}
              />
              <input
                ref={tablaRef}
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void onPickTabla(f);
                }}
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => csvRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/25 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-500/35 disabled:opacity-50"
                >
                  {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  {extracting ? `Leyendo… ${extractPct}%` : 'Subir CSV (recomendado)'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => tablaRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                >
                  PDF / imagen (lento, máx. 4 MB)
                </button>
              </div>
              {extracting ? (
                <div className="mt-2 space-y-1" aria-live="polite">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-indigo-200/90">
                    <span className="truncate">{extractEtapa || 'Procesando…'}</span>
                    <span className="shrink-0 tabular-nums">{extractPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/50 border border-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, extractPct))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-[10px] text-zinc-500 leading-snug">
                  En Excel: Archivo → Guardar como → <b className="text-zinc-400">CSV UTF-8</b>. Luego
                  adjunte las fotos de cada factura.
                </p>
              )}
              {tablaNombre && !extracting ? (
                <p className="mt-1 truncate text-[11px] text-zinc-400">{tablaNombre}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>2. Fotos de facturas</label>
              <input
                ref={fotosRef}
                type="file"
                className="hidden"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*,application/pdf"
                disabled={busy || grupos.length === 0}
                onChange={(e) => {
                  onPickFotos(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={busy || grupos.length === 0}
                onClick={() => fotosRef.current?.click()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-500/25 disabled:opacity-50"
              >
                <Images className="h-4 w-4" />
                Subir fotos
              </button>
              <p className="mt-1 text-[11px] text-zinc-500">
                {fotos.length} foto(s) · {stats.conFoto}/{stats.total} con foto ·{' '}
                {stats.cert}/{stats.total} certificadas
              </p>
            </div>
          </div>

          {grupos.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5 min-h-[280px]">
              <div className="lg:col-span-2 space-y-1.5 max-h-[50vh] overflow-y-auto rounded-xl border border-white/10 p-2">
                {grupos.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setActivoKey(g.key)}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                      activoKey === g.key
                        ? 'border-indigo-400/50 bg-indigo-500/20'
                        : 'border-white/5 bg-black/30 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white truncate">
                        {g.invoice_number || 'Sin nº'}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        {g.fotoId ? (
                          <Images className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Images className="h-3.5 w-3.5 text-zinc-600" />
                        )}
                        {g.certificada ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : null}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-zinc-400">{g.supplier_name || '—'}</p>
                    <p className="text-[10px] text-zinc-500">
                      {g.fecha} · {g.lineas.length} línea(s) · {totalGrupo(g)} {g.moneda}
                    </p>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-3 space-y-3 rounded-xl border border-white/10 p-3">
                {activo ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelClass}>Nº factura</label>
                        <input
                          className={inputClass}
                          value={activo.invoice_number}
                          disabled={busy || activo.certificada}
                          onChange={(e) =>
                            updateGrupo(activo.key, { invoice_number: e.target.value, certificada: false })
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Fecha (AAAA-MM-DD)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="2024-03-15"
                          className={inputClass}
                          value={activo.fecha}
                          disabled={busy || activo.certificada}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            // Permitir escribir libre; al blur/guardar se sanea
                            updateGrupo(activo.key, {
                              fecha: raw,
                              certificada: false,
                            });
                          }}
                          onBlur={(e) => {
                            const iso = fechaParaInputDate(e.target.value);
                            updateGrupo(activo.key, {
                              fecha: iso || hoyIso(),
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Proveedor</label>
                        <input
                          className={inputClass}
                          value={activo.supplier_name}
                          disabled={busy || activo.certificada}
                          onChange={(e) =>
                            updateGrupo(activo.key, { supplier_name: e.target.value, certificada: false })
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>RIF</label>
                        <input
                          className={inputClass}
                          value={activo.supplier_rif}
                          disabled={busy || activo.certificada}
                          onChange={(e) =>
                            updateGrupo(activo.key, { supplier_rif: e.target.value, certificada: false })
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Moneda</label>
                        <select
                          className={inputClass}
                          value={activo.moneda}
                          disabled={busy || activo.certificada}
                          onChange={(e) =>
                            updateGrupo(activo.key, {
                              moneda: e.target.value === 'USD' ? 'USD' : 'VES',
                              certificada: false,
                            })
                          }
                        >
                          <option value="VES">Bs</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Tasa BCV</label>
                        <input
                          className={inputClass}
                          inputMode="decimal"
                          value={activo.tasaBcv}
                          disabled={busy || activo.certificada}
                          onChange={(e) =>
                            updateGrupo(activo.key, { tasaBcv: e.target.value, certificada: false })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Foto de esta factura</label>
                      {fotoActiva ? (
                        <div className="relative mb-2 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                          {fotoActiva.file.type.startsWith('image/') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={fotoActiva.previewUrl}
                              alt={fotoActiva.file.name}
                              className="max-h-48 w-full object-contain"
                            />
                          ) : (
                            <p className="p-3 text-xs text-zinc-400">{fotoActiva.file.name}</p>
                          )}
                          <button
                            type="button"
                            disabled={busy || activo.certificada}
                            className="absolute right-2 top-2 rounded-md bg-black/70 p-1 text-zinc-300 hover:text-white"
                            onClick={() => asignarFoto(activo.key, null)}
                            aria-label="Quitar foto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="mb-2 text-[11px] text-amber-200/80">
                          Sin foto. Elija una de abajo para contrastar con los datos de la tabla.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {fotosLibres.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            disabled={busy || activo.certificada}
                            onClick={() => asignarFoto(activo.key, f.id)}
                            className="h-14 w-14 overflow-hidden rounded-lg border border-white/15 hover:border-emerald-400/50"
                            title={f.file.name}
                          >
                            {f.file.type.startsWith('image/') ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={f.previewUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full items-center justify-center text-[9px] text-zinc-400">
                                PDF
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>
                        Líneas de la tabla ({activo.lineas.length}) · total {totalGrupo(activo)}{' '}
                        {activo.moneda}
                      </label>
                      <div className="max-h-36 space-y-1 overflow-y-auto text-[11px] text-zinc-300">
                        {activo.lineas.map((l) => (
                          <div
                            key={l.key}
                            className="flex justify-between gap-2 rounded border border-white/5 bg-black/25 px-2 py-1"
                          >
                            <span className="truncate">{l.descripcion}</span>
                            <span className="shrink-0 text-zinc-500">
                              {l.cantidad} × {l.precio_unitario}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleCertificar(activo.key)}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${
                        activo.certificada
                          ? 'border border-emerald-400/50 bg-emerald-500/25 text-emerald-100'
                          : 'border border-amber-400/40 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25'
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {activo.certificada
                        ? 'Certificada — datos coinciden con la foto'
                        : 'Certificar: datos de la tabla son correctos'}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">Seleccione una factura de la lista.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
              Suba primero el PDF de la tabla. Luego las fotos de facturas para contrastar y
              certificar cada una.
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-white/10 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:bg-white/5 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || stats.cert === 0}
            onClick={() => void guardarCertificadas()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {saving
              ? 'Guardando…'
              : `Guardar certificadas (${stats.cert})`}
          </button>
        </div>
      </div>
    </div>
  );
}
