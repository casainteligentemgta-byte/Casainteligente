'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  Images,
  LayoutList,
  Loader2,
  ShieldCheck,
  Sparkles,
  Table2,
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
  pareceRutaONombreArchivo,
} from '@/lib/contabilidad/parseCsvTablaCompras';
import GuardadoCsvProgreso from '@/components/contabilidad/GuardadoCsvProgreso';
import {
  etiquetaRifCompra,
  normalizarRifVenezolano,
  resolverProveedorYRif,
  rifParaGuardarCompra,
} from '@/lib/contabilidad/rifVenezolano';

const MAX_FOTOS_EMPAREJE_LOTE = 12;

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
  /** Se llama tras guardar al menos una compra; recibe el `proyecto_id` usado. */
  onGuardado?: (proyectoId: string) => void;
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
  filas.forEach((f, rowIdx) => {
    let invoice = (f.invoice_number ?? '').trim();
    // LINK FACTURA / rutas PDF no son nº de factura → una fila = un registro
    if (pareceRutaONombreArchivo(invoice)) invoice = '';
    const resuelto = resolverProveedorYRif({
      proveedor: (f.supplier_name ?? '').trim(),
      rif: (f.supplier_rif ?? '').trim(),
    });
    const supplier = resuelto.supplier_name;
    const rif = resuelto.supplier_rif;
    // Sin nº de factura real: cada fila CSV es un registro distinto.
    const key = invoice
      ? claveFactura(invoice, rif, supplier)
      : `csv-fila-${rowIdx}`;
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
  });
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

/** Solo bloquea grupos vacíos; factura, proveedor y montos se completan al guardar. */
function motivoBloqueoGuardado(g: GrupoFactura): string | null {
  if (g.lineas.length === 0) return 'Sin líneas';
  return null;
}

function nombreProveedorGuardado(g: GrupoFactura): string {
  // No usar la descripción como proveedor (confundía TIPO/artículo con el proveedor).
  const n = g.supplier_name.trim();
  if (n && !normalizarRifVenezolano(n)) return n;
  return 'Proveedor pendiente';
}

function numeroFacturaGuardado(g: GrupoFactura): string {
  const inv = g.invoice_number.trim();
  if (inv) return inv;
  return `SIN-${g.key.slice(-8)}`;
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
  const [savePct, setSavePct] = useState(0);
  const [saveActual, setSaveActual] = useState(0);
  const [saveTotal, setSaveTotal] = useState(0);
  const [saveEtapa, setSaveEtapa] = useState('');
  const [tablaNombre, setTablaNombre] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoFactura[]>([]);
  const [fotos, setFotos] = useState<FotoAdjunto[]>([]);
  const [activoKey, setActivoKey] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchEtapa, setMatchEtapa] = useState('');
  /** Facturas marcadas para guardar sin certificar (todas o algunas). */
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  /** Vista del CSV cargado: cuadro tabular (como Excel) o detalle por factura. */
  const [vistaCsv, setVistaCsv] = useState<'cuadro' | 'detalle'>('cuadro');

  const resetAll = useCallback(() => {
    setExtracting(false);
    setExtractPct(0);
    setExtractEtapa('');
    setSaving(false);
    setSavePct(0);
    setSaveActual(0);
    setSaveTotal(0);
    setSaveEtapa('');
    setMatching(false);
    setMatchEtapa('');
    setTablaNombre(null);
    setVistaCsv('cuadro');
    setGrupos([]);
    setActivoKey(null);
    setSelectedKeys(new Set());
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
    const listos = grupos.filter((g) => !motivoBloqueoGuardado(g)).length;
    const seleccionados = grupos.filter(
      (g) => selectedKeys.has(g.key) && !motivoBloqueoGuardado(g),
    ).length;
    const todosSeleccionados =
      grupos.length > 0 && grupos.every((g) => selectedKeys.has(g.key));
    return {
      total: grupos.length,
      cert,
      conFoto,
      listos,
      seleccionados,
      todosSeleccionados,
    };
  }, [grupos, selectedKeys]);

  const toggleSeleccionado = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const seleccionarTodos = () => {
    setSelectedKeys(new Set(grupos.map((g) => g.key)));
  };

  const seleccionarNinguno = () => {
    setSelectedKeys(new Set());
  };

  const aplicarGruposCargados = (agrupados: GrupoFactura[]) => {
    setGrupos(agrupados);
    setActivoKey(agrupados[0]?.key ?? null);
    // Por defecto: todas seleccionadas para guardar sin certificar
    setSelectedKeys(new Set(agrupados.map((g) => g.key)));
  };

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
        aplicarGruposCargados(agrupados);
        toast.success(
          `${filas.length} filas → ${agrupados.length} factura(s). Seleccione cuáles guardar (sin certificar).`,
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
      aplicarGruposCargados(agrupados);
      toast.success(
        `${payload.total_filas ?? 0} filas → ${agrupados.length} factura(s). Seleccione cuáles guardar (sin certificar).`,
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
    toast.success(
      `${nuevas.length} foto(s) agregada(s). Pulse «Emparejar con IA» o asígnelas a mano.`,
    );
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
            return { ...g, fotoId: null };
          }
          return g;
        }
        // Foto independiente de «certificada»: se puede adjuntar antes o después.
        return { ...g, fotoId };
      }),
    );
  };

  /**
   * Gemini lee cada foto y la enlaza a la factura del cuadro (nº / RIF / proveedor).
   */
  const emparejarFotosConIa = async () => {
    if (grupos.length === 0) {
      toast.error('Primero cargue la tabla o el CSV');
      return;
    }
    if (fotos.length === 0) {
      toast.error('Suba fotos (o PDF) de las facturas');
      return;
    }

    setMatching(true);
    setMatchEtapa('Preparando emparejamiento…');
    try {
      const candidatas = grupos.map((g) => ({
        key: g.key,
        invoice_number: g.invoice_number,
        supplier_name: g.supplier_name,
        supplier_rif: g.supplier_rif,
        fecha: g.fecha,
        total: totalGrupo(g),
        moneda: g.moneda,
        lineas: g.lineas.length,
      }));

      // Solo fotos aún sin asignar (permite reintentar el resto)
      const fotosPendientes = fotos.filter((f) => !grupos.some((g) => g.fotoId === f.id));
      const lote = fotosPendientes.length > 0 ? fotosPendientes : fotos;

      let emparejadas = 0;
      let sinMatch = 0;
      const lotes: FotoAdjunto[][] = [];
      for (let i = 0; i < lote.length; i += MAX_FOTOS_EMPAREJE_LOTE) {
        lotes.push(lote.slice(i, i + MAX_FOTOS_EMPAREJE_LOTE));
      }

      for (let li = 0; li < lotes.length; li++) {
        const chunk = lotes[li]!;
        setMatchEtapa(
          lotes.length > 1
            ? `IA leyendo fotos ${li + 1}/${lotes.length}…`
            : `IA leyendo ${chunk.length} foto(s)…`,
        );

        const form = new FormData();
        form.append('facturas', JSON.stringify(candidatas));
        form.append('foto_ids', JSON.stringify(chunk.map((f) => f.id)));
        for (const f of chunk) {
          form.append('foto', f.file, f.file.name);
        }

        const res = await fetch('/api/contabilidad/compras/emparejar-fotos', {
          method: 'POST',
          body: form,
        });
        const ct = res.headers.get('content-type') ?? '';
        let data: {
          ok?: boolean;
          error?: string;
          matches?: Array<{
            fotoId: string;
            grupoKey: string | null;
            confianza: number;
            invoice_number_leido?: string;
            supplier_name_leido?: string;
            supplier_rif_leido?: string;
            motivo?: string;
          }>;
        } = {};
        if (ct.includes('application/json')) {
          data = (await res.json()) as typeof data;
        } else {
          throw new Error(
            (await res.text()).trim().slice(0, 180) || `Error HTTP ${res.status}`,
          );
        }
        if (!res.ok || !data.ok) {
          throw new Error(data.error || `No se pudo emparejar (HTTP ${res.status})`);
        }

        const matchesOk = (data.matches ?? []).filter(
          (m) => m.grupoKey && m.confianza >= 40,
        );
        sinMatch += (data.matches ?? []).length - matchesOk.length;
        emparejadas += matchesOk.length;

        if (matchesOk.length > 0) {
          setGrupos((prev) => {
            let next = prev.map((g) => ({ ...g }));
            for (const m of matchesOk) {
              const grupoKey = m.grupoKey!;
              next = next.map((g) => {
                if (g.fotoId === m.fotoId && g.key !== grupoKey) {
                  return { ...g, fotoId: null, certificada: false };
                }
                if (g.key !== grupoKey) return g;
                return {
                  ...g,
                  invoice_number: g.invoice_number.trim() || (m.invoice_number_leido ?? ''),
                  supplier_name: g.supplier_name.trim() || (m.supplier_name_leido ?? ''),
                  supplier_rif: g.supplier_rif.trim() || (m.supplier_rif_leido ?? ''),
                  fotoId: m.fotoId,
                  certificada: false,
                };
              });
            }
            return next;
          });
        }
      }

      if (emparejadas > 0) {
        toast.success(
          `${emparejadas} foto(s) enlazada(s) con IA. Revise y guarde en contabilidad.`,
        );
      } else {
        toast.error(
          'La IA no pudo emparejar con suficiente confianza. Asigne las fotos a mano.',
        );
      }
      if (sinMatch > 0 && emparejadas > 0) {
        toast.message(`${sinMatch} foto(s) sin match claro — asígnelas manualmente.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al emparejar con IA');
    } finally {
      setMatching(false);
      setMatchEtapa('');
    }
  };

  const toggleCertificar = (key: string) => {
    const g = grupos.find((x) => x.key === key);
    if (!g) return;
    if (!g.certificada) {
      // Foto opcional: se puede adjuntar después. Solo validamos datos mínimos.
      if (!g.invoice_number.trim() && !g.supplier_name.trim()) {
        toast.error('Indique al menos nº de factura o proveedor');
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
      if (!g.fotoId) {
        toast.message('Marcada como revisada. Puede adjuntar la foto más tarde.');
      }
    }
    updateGrupo(key, { certificada: !g.certificada });
  };

  const guardarGrupos = async (modo: 'seleccionadas' | 'listas' | 'certificadas') => {
    if (!proyectoId) {
      toast.error('Seleccione la obra para ver las compras en Contabilidad');
      return;
    }

    const candidatas =
      modo === 'certificadas'
        ? grupos.filter((g) => g.certificada)
        : modo === 'seleccionadas'
          ? grupos.filter((g) => selectedKeys.has(g.key) && !motivoBloqueoGuardado(g))
          : grupos.filter((g) => !motivoBloqueoGuardado(g));

    if (candidatas.length === 0) {
      toast.error(
        modo === 'certificadas'
          ? 'Marque al menos una factura como revisada, o guarde las seleccionadas'
            : modo === 'seleccionadas'
            ? 'Seleccione al menos una factura del CSV'
            : 'No hay facturas en el CSV.',
      );
      return;
    }

    const totalSave = candidatas.length;
    setSaving(true);
    setSavePct(1);
    setSaveActual(0);
    setSaveTotal(totalSave);
    setSaveEtapa('Preparando tasas BCV…');
    const supabase = createClient();
    let ok = 0;
    let fail = 0;
    const keysOk = new Set<string>();

    const marcarProgreso = (hecho: number, etapa: string) => {
      // 0–12% preparación; 12–100% por factura
      const pct =
        totalSave <= 0
          ? 100
          : Math.min(99, Math.round(12 + (hecho / totalSave) * 88));
      setSaveActual(hecho);
      setSavePct(pct);
      setSaveEtapa(etapa);
    };

    try {
      // Completar tasas BCV faltantes antes de insertar
      const porFecha = new Map<string, number>();
      for (const g of candidatas) {
        const fecha = fechaParaInputDate(g.fecha) || hoyIso();
        if (parseNum(g.tasaBcv) > 0) {
          porFecha.set(fecha, parseNum(g.tasaBcv));
          continue;
        }
        if (porFecha.has(fecha)) continue;
        try {
          const r = await resolverTasaBcvVesPorUsd(fecha);
          if (r.tasa_bcv_ves_por_usd > 0) porFecha.set(fecha, r.tasa_bcv_ves_por_usd);
        } catch {
          /* se pide tasa manual abajo */
        }
      }

      marcarProgreso(0, 'Guardando facturas…');

      for (let i = 0; i < candidatas.length; i++) {
        const g = candidatas[i]!;
        const etiqueta = g.invoice_number.trim() || `fila ${i + 1}`;
        marcarProgreso(i, `Guardando ${etiqueta}…`);
        try {
          const bloqueo = motivoBloqueoGuardado(g);
          if (bloqueo) throw new Error(bloqueo);

          const fecha = fechaParaInputDate(g.fecha) || hoyIso();
          let tasa = parseNum(g.tasaBcv);
          if (!(tasa > 0)) tasa = porFecha.get(fecha) ?? 0;
          if (!(tasa > 0)) {
            throw new Error('Indique tasa BCV (no se pudo obtener automáticamente)');
          }

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
          const montos = calcularGastoBimonetario(total, g.moneda, tasa);
          // Par coherente para el API: monto_ves = round(monto_usd × tasa, 2).
          // Evita fallos por redondeo VES→USD (p. ej. diferencia 1–3 Bs con tolerancia 0.05).
          const montoUsd = montos.montoUsd;
          const montoVes =
            Math.round(montoUsd * montos.tasaApplied * 100) / 100;
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

          const conFoto = Boolean(document_storage_path);
          const notas = conFoto
            ? 'Importación desde tabla histórica con foto de factura (solo contabilidad, sin stock).'
            : 'Importación desde CSV/tabla histórica (solo contabilidad, sin stock). Fotos opcionales.';

          const res = await fetch('/api/contabilidad/compras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proyecto_id: proyectoId,
              imputacion: 'obra',
              invoice_number: numeroFacturaGuardado(g),
              supplier_name: nombreProveedorGuardado(g),
              // Solo RIF con V/J/E/G/P; nunca un nombre de persona
              supplier_rif: rifParaGuardarCompra(g.supplier_rif),
              fecha,
              monto_ves: montoVes,
              monto_usd: montoUsd,
              tasa_bcv_fecha: montos.tasaApplied,
              moneda_original: g.moneda,
              origen: 'HISTORICO_TABLA',
              notas,
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
          keysOk.add(g.key);
        } catch (e) {
          fail += 1;
          console.error('[guardarGrupos]', g.invoice_number, e);
          toast.error(
            `Factura ${g.invoice_number || '?'}: ${e instanceof Error ? e.message : 'falló'}`,
          );
        }
        marcarProgreso(i + 1, `Listo ${i + 1}/${totalSave}`);
      }

      setSavePct(100);
      setSaveEtapa(ok > 0 ? '¡Listo!' : 'Sin guardados');

      if (ok > 0) {
        toast.success(
          `${ok} compra(s) en Contabilidad · obra seleccionada (sin stock)`,
        );
        onGuardado?.(proyectoId);
        setGrupos((prev) => prev.filter((g) => !keysOk.has(g.key)));
        setSelectedKeys((prev) => {
          const next = new Set(prev);
          Array.from(keysOk).forEach((k) => next.delete(k));
          return next;
        });
        if (fail === 0) {
          onClose();
        }
      } else {
        toast.error('No se pudo guardar ninguna compra en Contabilidad');
      }
    } finally {
      setSaving(false);
      setSavePct(0);
      setSaveActual(0);
      setSaveTotal(0);
      setSaveEtapa('');
    }
  };

  if (!open) return null;

  const busy = extracting || saving || matching;
  const fotosLibres = fotos.filter((f) => !grupos.some((g) => g.fotoId === f.id));

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/75">
      <div
        className="relative flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl border border-white/10 bg-[#141418] shadow-2xl"
        role="dialog"
        aria-labelledby="cargar-tabla-historica-title"
      >
        <GuardadoCsvProgreso
          open={saving}
          pct={savePct}
          actual={saveActual}
          total={saveTotal}
          etapa={saveEtapa}
        />
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div>
            <h2 id="cargar-tabla-historica-title" className="text-base font-bold text-white">
              Importar CSV / tabla histórica
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">
              1) Obra · 2) CSV/PDF · 3) Marque <b className="text-zinc-400">todas o algunas</b> · 4){' '}
              <b className="text-zinc-400">Guardar seleccionadas</b> (sin certificar). Fotos opcionales.
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
                  En Excel: Archivo → Guardar como → <b className="text-zinc-400">CSV UTF-8</b>. Las
                  fotos de factura son opcionales.
                </p>
              )}
              {tablaNombre && !extracting ? (
                <p className="mt-1 truncate text-[11px] text-zinc-400">{tablaNombre}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>Fotos (opcional, después OK)</label>
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
              <button
                type="button"
                disabled={busy || grupos.length === 0 || fotos.length === 0}
                onClick={() => void emparejarFotosConIa()}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400/45 bg-indigo-500/20 px-3 py-2.5 text-sm font-bold text-white hover:bg-indigo-500/30 disabled:opacity-50"
              >
                {matching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {matching ? matchEtapa || 'Emparejando…' : 'Emparejar con IA'}
              </button>
              <p className="mt-1 text-[11px] text-zinc-500">
                {fotos.length} foto(s) · {stats.conFoto}/{stats.total} con foto ·{' '}
                {stats.cert}/{stats.total} revisadas
              </p>
            </div>
          </div>

          {grupos.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setVistaCsv('cuadro')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold ${
                      vistaCsv === 'cuadro'
                        ? 'bg-indigo-500/30 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    Cuadro CSV
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setVistaCsv('detalle')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold ${
                      vistaCsv === 'detalle'
                        ? 'bg-indigo-500/30 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <LayoutList className="h-3.5 w-3.5" />
                    Detalle
                  </button>
                </div>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-white/30"
                    checked={stats.todosSeleccionados}
                    disabled={busy}
                    onChange={(e) => {
                      if (e.target.checked) seleccionarTodos();
                      else seleccionarNinguno();
                    }}
                  />
                  Todas
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={seleccionarNinguno}
                  className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                >
                  Ninguna
                </button>
                <span className="text-[10px] text-zinc-500 ml-auto">
                  {stats.seleccionados}/{stats.total} p/guardar · {tablaNombre ?? 'CSV'}
                </span>
              </div>

              {vistaCsv === 'cuadro' ? (
                <div className="max-h-[52vh] overflow-auto rounded-xl border border-white/10 bg-black/30">
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-[1] bg-[#1c1c22]">
                      <tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-zinc-400">
                        <th className="px-2 py-2 w-8">Sel</th>
                        <th className="px-2 py-2">Fecha</th>
                        <th className="px-2 py-2">Proveedor</th>
                        <th className="px-2 py-2">RIF</th>
                        <th className="px-2 py-2">Descripción</th>
                        <th className="px-2 py-2 text-right">Monto</th>
                        <th className="px-2 py-2">Moneda</th>
                        <th className="px-2 py-2">Factura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupos.map((g) => {
                        const marcada = selectedKeys.has(g.key);
                        const desc =
                          g.lineas.map((l) => l.descripcion).filter(Boolean).join(' · ') || '—';
                        const monto = totalGrupo(g);
                        return (
                          <tr
                            key={g.key}
                            className={`border-t border-white/5 cursor-pointer ${
                              activoKey === g.key
                                ? 'bg-indigo-500/15'
                                : marcada
                                  ? 'bg-emerald-500/10'
                                  : 'hover:bg-white/5'
                            }`}
                            onClick={() => setActivoKey(g.key)}
                          >
                            <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="rounded border-white/30"
                                checked={marcada}
                                disabled={busy}
                                aria-label={`Seleccionar ${g.supplier_name || g.key}`}
                                onChange={() => toggleSeleccionado(g.key)}
                              />
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap text-zinc-300">
                              {g.fecha || '—'}
                            </td>
                            <td className="px-2 py-1.5 max-w-[160px] truncate font-semibold text-white">
                              {g.supplier_name || '—'}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap font-mono text-zinc-400">
                              {etiquetaRifCompra(g.supplier_rif)}
                            </td>
                            <td className="px-2 py-1.5 max-w-[220px] truncate text-zinc-300" title={desc}>
                              {desc}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-bold text-amber-200">
                              {monto.toLocaleString('es-VE', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-2 py-1.5 text-zinc-400">{g.moneda}</td>
                            <td className="px-2 py-1.5 max-w-[120px] truncate font-mono text-zinc-500">
                              {g.invoice_number?.startsWith('SIN-') ? '—' : g.invoice_number || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5 min-h-[280px]">
              <div className="lg:col-span-2 space-y-1.5 max-h-[50vh] overflow-y-auto rounded-xl border border-white/10 p-2">
                {grupos.map((g) => {
                  const marcada = selectedKeys.has(g.key);
                  const bloqueo = motivoBloqueoGuardado(g);
                  return (
                    <div
                      key={g.key}
                      className={`flex gap-2 rounded-lg border px-2 py-2 text-xs transition-colors ${
                        activoKey === g.key
                          ? 'border-indigo-400/50 bg-indigo-500/20'
                          : marcada
                            ? 'border-emerald-400/30 bg-emerald-500/10'
                            : 'border-white/5 bg-black/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0 rounded border-white/30"
                        checked={marcada}
                        disabled={busy}
                        aria-label={`Seleccionar factura ${g.invoice_number || g.key}`}
                        onChange={() => toggleSeleccionado(g.key)}
                      />
                      <button
                        type="button"
                        onClick={() => setActivoKey(g.key)}
                        className="min-w-0 flex-1 text-left hover:opacity-90"
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
                          {bloqueo ? ` · ${bloqueo}` : ''}
                        </p>
                      </button>
                    </div>
                  );
                })}
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
                        <label className={labelClass}>RIF (V/J…)</label>
                        <input
                          className={inputClass}
                          value={activo.supplier_rif}
                          placeholder="V-12345678 o J-12345678-9"
                          disabled={busy || activo.certificada}
                          onChange={(e) =>
                            updateGrupo(activo.key, { supplier_rif: e.target.value, certificada: false })
                          }
                          onBlur={() => {
                            const n = normalizarRifVenezolano(activo.supplier_rif);
                            if (n) updateGrupo(activo.key, { supplier_rif: n });
                            else if (activo.supplier_rif.trim()) {
                              // Nombre u otro texto en RIF → mover a proveedor si está vacío
                              const r = resolverProveedorYRif({
                                proveedor: activo.supplier_name,
                                rif: activo.supplier_rif,
                              });
                              updateGrupo(activo.key, {
                                supplier_name: r.supplier_name || activo.supplier_name,
                                supplier_rif: r.supplier_rif,
                              });
                            }
                          }}
                        />
                        {activo.supplier_rif.trim() && !normalizarRifVenezolano(activo.supplier_rif) ? (
                          <p className="mt-1 text-[10px] text-amber-400/90">
                            El RIF debe empezar por V o J (ej. V-12345678). No use nombres aquí.
                          </p>
                        ) : null}
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
                            disabled={busy}
                            className="absolute right-2 top-2 rounded-md bg-black/70 p-1 text-zinc-300 hover:text-white"
                            onClick={() => asignarFoto(activo.key, null)}
                            aria-label="Quitar foto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="mb-2 text-[11px] text-zinc-400">
                          Sin foto (opcional). Puede guardar ya y adjuntar la imagen después, o elegir
                          una de abajo / usar Emparejar con IA.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {fotosLibres.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            disabled={busy}
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
                        ? activo.fotoId
                          ? 'Revisada — con foto adjunta'
                          : 'Revisada — puede adjuntar la foto después'
                        : 'Marcar como revisada (foto opcional)'}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">Seleccione una factura de la lista.</p>
                )}
              </div>
            </div>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
              1) Obra · 2) CSV/PDF · 3) Revise el cuadro CSV · 4) Guardar seleccionadas (sin
              certificar). Fotos opcionales.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[11px] text-zinc-500 leading-snug sm:max-w-[45%]">
            {proyectoId
              ? `${stats.seleccionados} seleccionada(s) de ${stats.total} · fotos ${stats.conFoto} (opcionales)`
              : 'Seleccione la obra para que las compras aparezcan filtradas en Contabilidad.'}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:bg-white/5 disabled:opacity-40"
            >
              Cancelar
            </button>
            {stats.cert > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void guardarGrupos('certificadas')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-sm font-bold text-amber-50 hover:bg-amber-500/25 disabled:opacity-40"
              >
                <ShieldCheck className="h-4 w-4" />
                Solo revisadas ({stats.cert})
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || stats.seleccionados === 0 || !proyectoId}
              onClick={() => void guardarGrupos('seleccionadas')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {saving
                ? `Guardando ${savePct}%`
                : `Guardar seleccionadas (${stats.seleccionados})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
