'use client';

import { CheckCircle2, Circle, Download, Loader2, MessageCircle, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  normalizarEstadoContrato,
  paso1Completado,
  paso2Completado,
  paso3Completado,
} from '@/lib/contratos/rrhhContratoEstados';
import { createClient } from '@/lib/supabase/client';

type ContratoRow = {
  id: string;
  estado_contrato: string | null;
  token_aceptacion: string | null;
  aceptado_digital_at: string | null;
  obrero_aceptacion_contrato_at: string | null;
  whatsapp_enviado_at: string | null;
  storage_path_borrador: string | null;
  laboral_pdf_storage_path: string | null;
  ubicacion_archivo_real: string | null;
  archivado_at: string | null;
  copia_digital_indexada: boolean | null;
};

type Props = {
  empleadoId: string;
  proyectoId: string | null;
  nombreObrero: string;
  cedula: string;
  contratoId?: string | null;
  onActualizado?: () => void;
};

function PasoItem({
  done,
  active,
  title,
  children,
}: {
  done: boolean;
  active?: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li
      className={`rounded-xl border p-3 ${
        done
          ? 'border-emerald-500/35 bg-emerald-950/25'
          : active
            ? 'border-amber-500/35 bg-amber-950/20'
            : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start gap-2">
        {done ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${done ? 'text-emerald-100' : 'text-zinc-200'}`}>{title}</p>
          {children ? <div className="mt-2 space-y-2">{children}</div> : null}
        </div>
      </div>
    </li>
  );
}

export default function ExpedienteContratoChecklist({
  empleadoId,
  proyectoId,
  nombreObrero,
  cedula,
  contratoId: contratoIdProp,
  onActualizado,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [contrato, setContrato] = useState<ContratoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const [ubicacion, setUbicacion] = useState('');
  const [copiaIndexada, setCopiaIndexada] = useState(false);
  const [mensajeWa, setMensajeWa] = useState<string | null>(null);
  const [motivoBypass, setMotivoBypass] = useState(
    'Aceptación verbal en oficina / Pruebas de sistema',
  );
  const [bypassando, setBypassando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const cols =
      'id,estado_contrato,token_aceptacion,aceptado_digital_at,obrero_aceptacion_contrato_at,whatsapp_enviado_at,storage_path_borrador,laboral_pdf_storage_path,ubicacion_archivo_real,archivado_at,copia_digital_indexada';
    const { data, error } = contratoIdProp
      ? await supabase.from('ci_contratos_empleado_obra').select(cols).eq('id', contratoIdProp).maybeSingle()
      : await supabase
          .from('ci_contratos_empleado_obra')
          .select(cols)
          .eq('empleado_id', empleadoId)
          .order('created_at', { ascending: false })
          .limit(1);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as ContratoRow | undefined;
    setContrato(row ?? null);
    setUbicacion((row?.ubicacion_archivo_real ?? '').trim());
    setCopiaIndexada(Boolean(row?.copia_digital_indexada));
  }, [contratoIdProp, empleadoId, supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const p1 = contrato
    ? paso1Completado(contrato.estado_contrato, contrato.whatsapp_enviado_at)
    : false;
  const p2 = contrato
    ? paso2Completado(
        contrato.estado_contrato,
        contrato.aceptado_digital_at ?? contrato.obrero_aceptacion_contrato_at,
      )
    : false;
  const p3 = contrato ? paso3Completado(contrato.estado_contrato, contrato.archivado_at) : false;

  async function generarYEnviar() {
    const pid = (proyectoId ?? '').trim();
    if (!pid) {
      toast.error('Asigne un proyecto al obrero antes de generar el contrato');
      return;
    }
    setGenerando(true);
    try {
      const res = await fetch(apiUrl('/api/contratos/generar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          empleadoId,
          proyectoId: pid,
          marcar_whatsapp_enviado: true,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        mensajeWhatsapp?: string;
        urlAceptacion?: string;
        contratoId?: string;
      };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo generar el contrato');
        return;
      }
      setMensajeWa(j.mensajeWhatsapp ?? null);
      toast.success('Contrato generado. Use WhatsApp para enviar el enlace al obrero.');
      await cargar();
      onActualizado?.();
    } catch {
      toast.error('Error de red');
    } finally {
      setGenerando(false);
    }
  }

  async function registrarAceptacionAdmin() {
    if (!contrato?.id) {
      toast.error('Primero genere el contrato');
      return;
    }
    const motivo = motivoBypass.trim();
    if (!motivo) {
      toast.error('Indique el motivo del registro');
      return;
    }
    setBypassando(true);
    try {
      const res = await fetch(apiUrl('/api/contratos/aceptar-admin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contrato_id: contrato.id,
          bypass_by_admin: true,
          motivo,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        ya_aceptado?: boolean;
      };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo registrar la aceptación');
        return;
      }
      toast.success(
        j.ya_aceptado ? 'El contrato ya estaba aceptado digitalmente' : 'Aceptación registrada por RRHH',
      );
      await cargar();
      onActualizado?.();
    } catch {
      toast.error('Error de red');
    } finally {
      setBypassando(false);
    }
  }

  async function archivarEscaneo(file: File) {
    if (!contrato?.id) {
      toast.error('Primero genere el contrato');
      return;
    }
    if (!ubicacion.trim()) {
      toast.error('Indique la ubicación del archivo físico');
      return;
    }
    if (!copiaIndexada) {
      toast.error('Confirme que la copia digital está indexada');
      return;
    }
    setArchivando(true);
    try {
      const fd = new FormData();
      fd.set('contrato_id', contrato.id);
      fd.set('archivo', file);
      fd.set('ubicacion_archivo_real', ubicacion.trim());
      fd.set('copia_digital_indexada', 'true');
      if (proyectoId) fd.set('proyecto_id', proyectoId);
      fd.set('cedula', cedula);
      const res = await fetch(apiUrl('/api/contratos/archivar'), {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo archivar');
        return;
      }
      toast.success('Contrato archivado. Obrero en nómina activa.');
      await cargar();
      onActualizado?.();
    } catch {
      toast.error('Error de red al archivar');
    } finally {
      setArchivando(false);
    }
  }

  const estadoLabel = contrato ? normalizarEstadoContrato(contrato.estado_contrato) : '—';

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando expediente de contrato…</p>;
  }

  return (
    <section className="rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4">
      <h3 className="text-sm font-bold text-violet-100">Control de contrato — {nombreObrero}</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Estado: <span className="font-mono text-zinc-300">{estadoLabel}</span>
        {contrato?.id ? (
          <span className="text-zinc-600"> · {contrato.id.slice(0, 8)}…</span>
        ) : null}
      </p>

      <ol className="mt-4 space-y-3">
        <PasoItem done={p1} active={!p1} title="Paso 1 — Generado y enviado">
          <button
            type="button"
            disabled={generando}
            onClick={() => void generarYEnviar()}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-600/25 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-600/40 disabled:opacity-50"
          >
            {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Generar PDF y preparar WhatsApp
          </button>
          {mensajeWa ? (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensajeWa)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-200"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Abrir WhatsApp con mensaje
            </a>
          ) : null}
          {contrato?.token_aceptacion ? (
            <p className="text-[10px] text-zinc-500 break-all">
              Enlace obrero:{' '}
              <span className="text-zinc-400">
                /registro/contrato-laboral/{contrato.id}?token=…
              </span>
            </p>
          ) : null}
        </PasoItem>

        <PasoItem
          done={p2}
          active={p1 && !p2}
          title="Paso 2 — Aceptación digital del obrero"
        >
          {contrato?.aceptado_digital_at || contrato?.obrero_aceptacion_contrato_at ? (
            <p className="text-xs text-emerald-200/90">
              Aceptado:{' '}
              {new Date(
                contrato.aceptado_digital_at ?? contrato.obrero_aceptacion_contrato_at ?? '',
              ).toLocaleString('es-VE')}
            </p>
          ) : (
            <>
              <p className="text-xs text-zinc-500">Pendiente de que el obrero abra el enlace y acepte.</p>
              {p1 ? (
                <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-950/15 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/80">
                    Registro RRHH (aceptación verbal / pruebas)
                  </p>
                  <label className="block text-[10px] text-zinc-500">
                    Motivo (auditoría)
                    <input
                      value={motivoBypass}
                      onChange={(e) => setMotivoBypass(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={bypassando}
                    onClick={() => void registrarAceptacionAdmin()}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-900/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/50 disabled:opacity-50"
                  >
                    {bypassando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Registrar aceptación por admin
                  </button>
                </div>
              ) : null}
            </>
          )}
        </PasoItem>

        <PasoItem done={p3} active={p2 && !p3} title="Paso 3 — Escaneo firmado y archivo físico">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void archivarEscaneo(f);
              e.target.value = '';
            }}
          />
          <label className="block text-[10px] font-bold uppercase text-zinc-500">
            Ubicación en archivo físico real
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder='Ej. Carpeta RRHH 2026, Estante B, Gaveta 2'
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="flex items-start gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={copiaIndexada}
              onChange={(e) => setCopiaIndexada(e.target.checked)}
              className="mt-0.5"
            />
            Copia digital guardada e indexada con éxito
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={archivando || !p2}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50"
            >
              {archivando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Subir PDF firmado escaneado
            </button>
            {contrato?.id ? (
              <a
                href={apiUrl(
                  `/api/registro/contrato-laboral/pdf?contrato_id=${encodeURIComponent(contrato.id)}`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar borrador
              </a>
            ) : null}
          </div>
        </PasoItem>
      </ol>
    </section>
  );
}
