'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CheckCircle2,
  FolderOpen,
  HelpCircle,
  Loader2,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { adjuntarFacturaConOcr } from '@/lib/contabilidad/adjuntarFacturaConOcrClient';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';
import {
  MAX_SOPORTES_POR_REQUEST,
  type CandidatoScore,
  type DecisionMatch,
} from '@/lib/contabilidad/cco/emparejarSoportesEgresosScoring';

/** Respuesta del API de empareje (espejo tipado en cliente). */
type MatchSoporteEgreso = {
  archivoId: string;
  fileName: string;
  decision: DecisionMatch;
  egresoId: string | null;
  confianza: number;
  candidatos: CandidatoScore[];
  leido: {
    invoice_number: string;
    supplier_name: string;
    supplier_rif: string;
    fecha: string;
    total_amount: number | null;
  };
  motivo: string;
  error?: string;
  paginas?: number[];
  adjuntoBase64?: string;
  adjuntoMime?: string;
  adjuntoFileName?: string;
};

type FilaEgreso = CcoLibroFila & { _agrupada?: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  filas: FilaEgreso[];
  onAdjuntado: (compraId: string, fileName: string) => void;
};

type ArchivoLocal = {
  id: string;
  file: File;
};

type MatchUi = MatchSoporteEgreso & {
  file?: File;
  asignado?: boolean;
};

function fmtMonto(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('es-VE', { maximumFractionDigits: 2 });
}

function labelEgreso(f: FilaEgreso | undefined, id: string | null): string {
  if (!f) return id ? `Egreso ${id.slice(0, 8)}…` : '—';
  const fecha = f.fecha || 's/f';
  return `#${f.display_id} · ${f.proveedor} · ${fecha} · ${fmtMonto(f.monto_orig)} ${f.moneda}`;
}

function fileDesdeMatch(
  m: MatchSoporteEgreso,
  byId: Map<string, File>,
): File | undefined {
  if (m.adjuntoBase64 && m.adjuntoFileName) {
    try {
      const bin = Uint8Array.from(atob(m.adjuntoBase64), (c) => c.charCodeAt(0));
      return new File([bin], m.adjuntoFileName, {
        type: m.adjuntoMime || 'application/pdf',
      });
    } catch {
      /* fallback abajo */
    }
  }
  if (byId.has(m.archivoId)) return byId.get(m.archivoId);
  const origen = m.archivoId.split('#')[0];
  if (origen && byId.has(origen)) return byId.get(origen);
  return undefined;
}

/**
 * Agente: sube PDFs/imágenes (carpeta local o sincronizada de Drive),
 * OCR + match por proveedor/fecha/monto → auto o popup humano.
 */
export default function EgresoEmparejarSoportesModal({
  open,
  onClose,
  filas,
  onAdjuntado,
}: Props) {
  const inputFilesRef = useRef<HTMLInputElement>(null);
  const inputFolderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputFolderRef.current;
    if (!el) return;
    el.setAttribute('webkitdirectory', '');
    el.setAttribute('directory', '');
  }, [open]);

  const sinDoc = useMemo(
    () =>
      filas.filter(
        (f) => f.fuente === 'compra' && !f._agrupada && !f.tiene_documento,
      ),
    [filas],
  );
  const porId = useMemo(() => {
    const m = new Map<string, FilaEgreso>();
    for (const f of filas) {
      if (f.fuente === 'compra' && !f._agrupada) m.set(f.id, f);
    }
    return m;
  }, [filas]);

  const [archivos, setArchivos] = useState<ArchivoLocal[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [matches, setMatches] = useState<MatchUi[]>([]);
  const [resumen, setResumen] = useState<{
    auto: number;
    duda: number;
    sin_match: number;
  } | null>(null);
  const [dudaQueue, setDudaQueue] = useState<MatchUi[]>([]);
  const [dudaActual, setDudaActual] = useState<MatchUi | null>(null);
  const [egresoElegido, setEgresoElegido] = useState('');
  const [fase, setFase] = useState<'carga' | 'resultado'>('carga');

  if (!open) return null;

  const agregarFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next: ArchivoLocal[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i]!;
      const mime = (file.type || '').toLowerCase();
      const ok =
        mime === 'application/pdf' ||
        mime.startsWith('image/') ||
        /\.(pdf|jpe?g|png|webp|gif|heic)$/i.test(file.name);
      if (!ok) continue;
      next.push({ id: `local-${Date.now()}-${i}-${file.name}`, file });
    }
    if (next.length === 0) {
      toast.error('No hay PDF o imágenes válidas en la selección.');
      return;
    }
    setArchivos((prev) => {
      const merged = [...prev, ...next];
      if (merged.length > MAX_SOPORTES_POR_REQUEST) {
        toast.message(
          `Se tomarán los primeros ${MAX_SOPORTES_POR_REQUEST} (máx. por lote).`,
        );
        return merged.slice(0, MAX_SOPORTES_POR_REQUEST);
      }
      return merged;
    });
    setFase('carga');
    setMatches([]);
    setResumen(null);
  };

  const quitarArchivo = (id: string) => {
    setArchivos((prev) => prev.filter((a) => a.id !== id));
  };

  const adjuntarA = async (compraId: string, file: File): Promise<boolean> => {
    const data = await adjuntarFacturaConOcr(compraId, file, { ocr: false });
    if (!data.ok) {
      toast.error(data.error || `No se pudo adjuntar a ${compraId}`);
      return false;
    }
    onAdjuntado(compraId, data.fileName || file.name);
    return true;
  };

  const correrAgente = async () => {
    if (sinDoc.length === 0) {
      toast.error('No hay egresos sin factura en el cuadro filtrado.');
      return;
    }
    if (archivos.length === 0) {
      toast.error('Seleccione PDFs o imágenes (o una carpeta).');
      return;
    }

    setProcesando(true);
    setMatches([]);
    setResumen(null);
    setDudaQueue([]);
    setDudaActual(null);

    try {
      const form = new FormData();
      const egresosPayload = sinDoc.map((f) => ({
        id: f.id,
        proveedor: f.proveedor,
        fecha: f.fecha,
        moneda: f.moneda,
        monto_orig: f.monto_orig,
        monto_base_usd: f.monto_base_usd,
        tasa: f.tasa,
        invoice_number: f.invoice_number,
        display_id: f.display_id,
      }));
      form.append('egresos', JSON.stringify(egresosPayload));
      form.append(
        'soporte_ids',
        JSON.stringify(archivos.map((a) => a.id)),
      );
      for (const a of archivos) {
        form.append('soporte', a.file, a.file.name);
      }

      const res = await fetch('/api/contabilidad/cco/emparejar-soportes', {
        method: 'POST',
        body: form,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        matches?: MatchSoporteEgreso[];
        resumen?: { auto: number; duda: number; sin_match: number };
      };
      if (!res.ok || !json.ok || !json.matches) {
        throw new Error(json.error || 'No se pudo emparejar el lote.');
      }

      const byId = new Map(archivos.map((a) => [a.id, a.file]));
      const enriched: MatchUi[] = json.matches.map((m) => ({
        ...m,
        file: fileDesdeMatch(m, byId),
      }));
      setMatches(enriched);
      setResumen(json.resumen ?? null);
      setFase('resultado');

      // Auto-asignar matches claros (adjunta el PDF de la página/grupo, no el lote entero)
      setAsignando(true);
      let autoOk = 0;
      for (const m of enriched) {
        if (m.decision !== 'auto' || !m.egresoId || !m.file) continue;
        const ok = await adjuntarA(m.egresoId, m.file);
        if (ok) {
          autoOk += 1;
          m.asignado = true;
        }
      }
      setMatches([...enriched]);
      setAsignando(false);

      const dudas = enriched.filter((m) => m.decision === 'duda' && m.file);
      if (dudas.length > 0) {
        setDudaQueue(dudas.slice(1));
        setDudaActual(dudas[0]!);
        setEgresoElegido(dudas[0]!.egresoId || dudas[0]!.candidatos[0]?.egresoId || '');
        toast.message(
          `${autoOk} factura(s) auto-asignada(s). ${dudas.length} requieren su revisión.`,
        );
      } else {
        toast.success(
          autoOk > 0
            ? `${autoOk} factura(s) enlazada(s) automáticamente.`
            : 'Lote analizado. Sin matches automáticos.',
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error del agente');
    } finally {
      setProcesando(false);
      setAsignando(false);
    }
  };

  const cerrarDudaYSiguiente = () => {
    const next = dudaQueue[0];
    if (next) {
      setDudaQueue((q) => q.slice(1));
      setDudaActual(next);
      setEgresoElegido(next.egresoId || next.candidatos[0]?.egresoId || '');
    } else {
      setDudaActual(null);
    }
  };

  const confirmarDuda = async () => {
    if (!dudaActual?.file || !egresoElegido) {
      toast.error('Elija el egreso al que asignar la factura.');
      return;
    }
    setAsignando(true);
    try {
      const ok = await adjuntarA(egresoElegido, dudaActual.file);
      if (ok) {
        setMatches((prev) =>
          prev.map((m) =>
            m.archivoId === dudaActual.archivoId
              ? { ...m, asignado: true, egresoId: egresoElegido, decision: 'auto' as DecisionMatch }
              : m,
          ),
        );
        toast.success('Factura asignada.');
        cerrarDudaYSiguiente();
      }
    } finally {
      setAsignando(false);
    }
  };

  const saltarDuda = () => {
    toast.message(`Omitida: ${dudaActual?.fileName ?? 'factura'}`);
    cerrarDudaYSiguiente();
  };

  const cerrarTodo = () => {
    if (procesando || asignando) return;
    setArchivos([]);
    setMatches([]);
    setResumen(null);
    setDudaActual(null);
    setDudaQueue([]);
    setFase('carga');
    onClose();
  };

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="emparejar-soportes-title">
      <div style={panel}>
        <div style={headerRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={20} color="#1D4ED8" />
            <h2 id="emparejar-soportes-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              Agente: enlazar facturas a egresos
            </h2>
          </div>
          <button type="button" onClick={cerrarTodo} style={btnIcon} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p style={hint}>
          Suba PDFs o fotos (carpeta local o sincronizada de Drive). Si un PDF trae varias
          facturas, se parte por página, se agrupan las de la misma factura y cada una se
          empareja por proveedor, fecha y monto. Match claro → auto; duda → popup.
        </p>

        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#334155' }}>
          Egresos sin factura en vista: <strong>{sinDoc.length}</strong>
          {archivos.length > 0 ? (
            <>
              {' '}
              · Archivos en lote: <strong>{archivos.length}</strong> / {MAX_SOPORTES_POR_REQUEST}
            </>
          ) : null}
        </p>

        {fase === 'carga' || matches.length === 0 ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <input
                ref={inputFilesRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  agregarFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={inputFolderRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  agregarFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                style={btnPrimary}
                disabled={procesando}
                onClick={() => inputFilesRef.current?.click()}
              >
                Elegir PDFs / imágenes
              </button>
              <button
                type="button"
                style={btnSecondary}
                disabled={procesando}
                onClick={() => inputFolderRef.current?.click()}
              >
                <FolderOpen size={14} /> Carpeta (Drive sync)
              </button>
              <button
                type="button"
                style={btnAccent}
                disabled={procesando || archivos.length === 0 || sinDoc.length === 0}
                onClick={() => void correrAgente()}
              >
                {procesando ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Analizando…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Emparejar y asignar
                  </>
                )}
              </button>
            </div>

            {archivos.length > 0 ? (
              <ul style={listBox}>
                {archivos.map((a) => (
                  <li key={a.id} style={listItem}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.file.name}
                    </span>
                    <button type="button" style={btnIcon} onClick={() => quitarArchivo(a.id)}>
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={muted}>Ningún archivo aún. Puede arrastrar desde una carpeta de Drive ya sincronizada.</p>
            )}
          </>
        ) : null}

        {fase === 'resultado' && resumen ? (
          <div style={{ marginTop: 8 }}>
            <div style={kpiRow}>
              <Kpi label="Auto" value={resumen.auto} color="#166534" icon={<CheckCircle2 size={14} />} />
              <Kpi label="Duda (humano)" value={resumen.duda} color="#92400E" icon={<HelpCircle size={14} />} />
              <Kpi label="Sin match" value={resumen.sin_match} color="#64748B" icon={<XCircle size={14} />} />
            </div>
            {asignando ? (
              <p style={{ ...muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="animate-spin" /> Adjuntando facturas…
              </p>
            ) : null}
            <ul style={{ ...listBox, maxHeight: 280 }}>
              {matches.map((m) => (
                <li key={m.archivoId} style={{ ...listItem, flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{m.fileName}</strong>
                    <BadgeDecision decision={m.decision} asignado={m.asignado} />
                  </div>
                  {m.paginas && m.paginas.length > 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0F766E' }}>
                      Página{m.paginas.length > 1 ? 's' : ''} {m.paginas.join(', ')}
                    </span>
                  ) : null}
                  <span style={{ fontSize: 12, color: '#475569' }}>
                    OCR: {m.leido.supplier_name || '—'} · {m.leido.fecha || 's/f'} ·{' '}
                    {fmtMonto(m.leido.total_amount)}
                    {m.leido.invoice_number ? ` · Nº ${m.leido.invoice_number}` : ''}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    {m.motivo}
                    {m.egresoId ? ` → ${labelEgreso(porId.get(m.egresoId), m.egresoId)}` : ''}
                    {m.error ? ` · ${m.error}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => {
                  setFase('carga');
                  setMatches([]);
                  setResumen(null);
                  setArchivos([]);
                }}
              >
                Nuevo lote
              </button>
              <button type="button" style={btnPrimary} onClick={cerrarTodo}>
                Cerrar
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {dudaActual ? (
        <div style={popupOverlay}>
          <div style={popupPanel} role="alertdialog" aria-labelledby="duda-title">
            <h3 id="duda-title" style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>
              ¿Asignar esta factura?
            </h3>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#334155', lineHeight: 1.45 }}>
              El agente no está seguro. Revise el OCR y elija el egreso correcto, o omita.
            </p>
            <div style={ocrBox}>
              <div>
                <strong>Archivo:</strong> {dudaActual.fileName}
              </div>
              {dudaActual.paginas && dudaActual.paginas.length > 0 ? (
                <div>
                  <strong>Página(s):</strong> {dudaActual.paginas.join(', ')}
                </div>
              ) : null}
              <div>
                <strong>Proveedor leído:</strong> {dudaActual.leido.supplier_name || '—'}
              </div>
              <div>
                <strong>Fecha:</strong> {dudaActual.leido.fecha || '—'}
              </div>
              <div>
                <strong>Monto:</strong> {fmtMonto(dudaActual.leido.total_amount)}
              </div>
              <div>
                <strong>Nº:</strong> {dudaActual.leido.invoice_number || '—'}
              </div>
              <div style={{ marginTop: 6, color: '#64748B' }}>{dudaActual.motivo}</div>
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Egreso destino
            </label>
            <select
              value={egresoElegido}
              onChange={(e) => setEgresoElegido(e.target.value)}
              style={selectStyle}
            >
              <option value="">— Seleccione —</option>
              {candidatosOptions(dudaActual.candidatos, porId, sinDoc).map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.score})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                style={btnAccent}
                disabled={asignando || !egresoElegido}
                onClick={() => void confirmarDuda()}
              >
                {asignando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Sí, asignar
              </button>
              <button type="button" style={btnSecondary} disabled={asignando} onClick={saltarDuda}>
                Omitir
              </button>
            </div>
            {dudaQueue.length > 0 ? (
              <p style={{ ...muted, marginTop: 10 }}>
                Quedan {dudaQueue.length} factura(s) por revisar.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function candidatosOptions(
  candidatos: CandidatoScore[],
  porId: Map<string, FilaEgreso>,
  sinDoc: FilaEgreso[],
): { id: string; label: string; score: number }[] {
  const seen = new Set<string>();
  const out: { id: string; label: string; score: number }[] = [];
  for (const c of candidatos) {
    if (seen.has(c.egresoId)) continue;
    seen.add(c.egresoId);
    out.push({
      id: c.egresoId,
      label: labelEgreso(porId.get(c.egresoId), c.egresoId),
      score: c.score,
    });
  }
  for (const f of sinDoc) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push({ id: f.id, label: labelEgreso(f, f.id), score: 0 });
  }
  return out;
}

function BadgeDecision({
  decision,
  asignado,
}: {
  decision: DecisionMatch;
  asignado?: boolean;
}) {
  const map: Record<DecisionMatch, { bg: string; fg: string; t: string }> = {
    auto: { bg: '#DCFCE7', fg: '#166534', t: asignado ? 'Asignada' : 'Auto' },
    duda: { bg: '#FEF3C7', fg: '#92400E', t: asignado ? 'Asignada' : 'Duda' },
    sin_match: { bg: '#F1F5F9', fg: '#475569', t: 'Sin match' },
  };
  const s = map[decision];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        padding: '2px 8px',
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
      }}
    >
      {s.t}
    </span>
  );
}

function Kpi({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 100,
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '8px 10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, fontWeight: 800, fontSize: 12 }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{value}</div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const panel: CSSProperties = {
  width: 'min(720px, 100%)',
  maxHeight: '90vh',
  overflow: 'auto',
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 18,
  boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
};

const headerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 8,
};

const hint: CSSProperties = {
  margin: '0 0 12px',
  padding: '10px 12px',
  borderRadius: 10,
  background: '#EFF6FF',
  border: '1px solid #BFDBFE',
  fontSize: 13,
  color: '#1E3A8A',
  lineHeight: 1.45,
};

const muted: CSSProperties = { margin: 0, fontSize: 13, color: '#64748B' };

const listBox: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  maxHeight: 200,
  overflow: 'auto',
};

const listItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderBottom: '1px solid #F1F5F9',
  fontSize: 13,
};

const kpiRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 12,
};

const btnBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  border: '1px solid transparent',
};

const btnPrimary: CSSProperties = {
  ...btnBase,
  background: '#1D4ED8',
  color: '#fff',
};

const btnSecondary: CSSProperties = {
  ...btnBase,
  background: '#fff',
  color: '#1E40AF',
  border: '1px solid #BFDBFE',
};

const btnAccent: CSSProperties = {
  ...btnBase,
  background: '#0F766E',
  color: '#fff',
};

const btnIcon: CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 4,
  color: '#64748B',
};

const popupOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 90,
  background: 'rgba(15, 23, 42, 0.65)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const popupPanel: CSSProperties = {
  width: 'min(480px, 100%)',
  background: '#fff',
  borderRadius: 14,
  padding: 18,
  border: '1px solid #FDE68A',
  boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
};

const ocrBox: CSSProperties = {
  background: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderRadius: 10,
  padding: 12,
  fontSize: 13,
  marginBottom: 12,
  lineHeight: 1.5,
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 13,
};
