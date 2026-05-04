'use client';

import dynamic from 'next/dynamic';
import { ExternalLink, MessageSquare, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { publicRegistroOrigin } from '@/lib/registro/publicRegistroOrigin';
import { emptyHojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';

const HojaVidaObreroVista = dynamic(() => import('@/components/talento/HojaVidaObreroVista'), {
  ssr: false,
  loading: () => <p className="mt-2 text-xs text-zinc-500">Cargando vista de campos…</p>,
});

export type GestionRRHHLocalProps = {
  /** UUID de `ci_proyectos` (módulo integral). */
  proyectoModuloId: string;
  /** Incrementar desde el padre para volver a cargar `recruitment_needs` (p. ej. tras nueva vacante). */
  listaRefresco?: number;
  /** Nombre de la obra / proyecto (mensaje WhatsApp captación automática). */
  nombreProyecto?: string | null;
  /** Datos del patrono en cabecera de la planilla (vista previa). */
  planillaPatrono?: PlanillaPatronoCampos | null;
  /** Si es true (p. ej. `?tab=rrhh`), la hoja de vida se muestra expandida arriba; si no, queda en un desplegable. */
  vistaHojaVidaDestacada?: boolean;
};

type NeedRow = {
  id: string;
  title: string;
  cargo_nombre: string | null;
  cargo_codigo: string | null;
  protocol_active: boolean;
  created_at: string;
  cantidad_requerida?: number | null;
  conteo_clics?: number | null;
  captacion_token?: string | null;
};

function etiquetaCargo(row: NeedRow): string {
  const n = (row.cargo_nombre ?? '').trim();
  if (n) return n;
  const t = (row.title ?? '').trim();
  return t || 'Vacante';
}

function urlRegistroConToken(row: NeedRow): string | null {
  const t = (row.captacion_token ?? '').trim();
  if (!t) return null;
  const base = publicRegistroOrigin().replace(/\/$/, '');
  return `${base}/registro/${encodeURIComponent(t)}`;
}

function mensajeCaptacionWhatsApp(cargo: string, nombreObra: string, link: string): string {
  const obra = nombreObra.trim() || 'la obra vinculada al proyecto';
  return `Hola, Casa Inteligente te invita a postularte para ${cargo} en la obra ${obra}. Completa tu planilla aquí: ${link}`;
}

function cantidadMostrada(row: NeedRow): number {
  const raw = row.cantidad_requerida;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
  return 1;
}

function clicsMostrados(row: NeedRow): number {
  const raw = row.conteo_clics;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return 0;
}

export default function GestionRRHHLocal({
  proyectoModuloId,
  listaRefresco = 0,
  nombreProyecto = null,
  planillaPatrono = null,
  vistaHojaVidaDestacada = false,
}: GestionRRHHLocalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** Al volver a esta pestaña tras registrar vacantes en otra ruta, se vuelve a leer `recruitment_needs`. */
  const [viewportTick, setViewportTick] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') setViewportTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const id = proyectoModuloId.trim();
    if (!id) {
      setLoading(false);
      setNeeds([]);
      setError('Proyecto no válido.');
      return;
    }

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);

      const full = await supabase
        .from('recruitment_needs')
        .select(
          'id,title,cargo_nombre,cargo_codigo,protocol_active,created_at,cantidad_requerida,conteo_clics,captacion_token',
        )
        .eq('proyecto_modulo_id', id)
        .order('created_at', { ascending: false });

      if (!alive) return;

      if (!full.error) {
        setNeeds((full.data ?? []) as NeedRow[]);
        setLoading(false);
        return;
      }

      const msg = full.error.message || 'No se pudieron cargar las necesidades.';
      const mid = await supabase
        .from('recruitment_needs')
        .select('id,title,cargo_nombre,cargo_codigo,protocol_active,created_at,cantidad_requerida,captacion_token')
        .eq('proyecto_modulo_id', id)
        .order('created_at', { ascending: false });

      if (!alive) return;

      if (!mid.error) {
        setNeeds(
          ((mid.data ?? []) as Omit<NeedRow, 'conteo_clics'>[]).map((r) => ({ ...r, conteo_clics: null })),
        );
        setLoading(false);
        return;
      }

      const bare = await supabase
        .from('recruitment_needs')
        .select('id,title,cargo_nombre,cargo_codigo,protocol_active,created_at,captacion_token')
        .eq('proyecto_modulo_id', id)
        .order('created_at', { ascending: false });

      if (!alive) return;
      setLoading(false);

      if (!bare.error) {
        setNeeds(
          ((bare.data ?? []) as Omit<NeedRow, 'cantidad_requerida' | 'conteo_clics'>[]).map((r) => ({
            ...r,
            cantidad_requerida: null,
            conteo_clics: null,
            captacion_token: null,
          })),
        );
        return;
      }

      setNeeds([]);
      setError(bare.error.message ?? msg);
    })();

    return () => {
      alive = false;
    };
  }, [proyectoModuloId, supabase, listaRefresco, viewportTick]);

  async function emitirCaptacionToken(row: NeedRow): Promise<{ url?: string; token?: string; error?: string }> {
    const res = await fetch('/api/reclutamiento/captacion-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recruitment_need_id: row.id,
        public_base_url: typeof window !== 'undefined' ? window.location.origin : '',
      }),
    });
    const j = (await res.json()) as { error?: string; url?: string; token?: string; hint?: string };
    if (!res.ok) {
      return { error: j.hint ?? j.error ?? 'No se pudo generar el enlace de captación.' };
    }
    return { url: j.url, token: j.token };
  }

  const abrirWhatsApp = useCallback(
    async (row: NeedRow) => {
      let url = urlRegistroConToken(row);
      let nuevoToken: string | undefined;
      if (!url) {
        const r = await emitirCaptacionToken(row);
        if (r.error || !r.url) {
          setError(r.error ?? 'No se pudo obtener el enlace.');
          showToast(r.error ?? 'Error al generar enlace');
          return;
        }
        url = r.url;
        nuevoToken = r.token;
        if (nuevoToken) {
          setNeeds((prev) => prev.map((n) => (n.id === row.id ? { ...n, captacion_token: nuevoToken } : n)));
        }
      }
      const cargo = etiquetaCargo(row);
      const obra = (nombreProyecto ?? '').trim();
      const text = encodeURIComponent(mensajeCaptacionWhatsApp(cargo, obra, url));
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    },
    [nombreProyecto, showToast],
  );

  const copiarLink = useCallback(
    async (row: NeedRow) => {
      let url = urlRegistroConToken(row);
      if (!url) {
        const r = await emitirCaptacionToken(row);
        if (r.error || !r.url) {
          showToast(r.error ?? 'No se pudo generar el enlace.');
          return;
        }
        url = r.url;
        if (r.token) {
          setNeeds((prev) => prev.map((n) => (n.id === row.id ? { ...n, captacion_token: r.token } : n)));
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        showToast('Enlace de planilla copiado al portapapeles.');
      } catch {
        showToast('No se pudo copiar. Copia manualmente el enlace.');
      }
    },
    [showToast],
  );

  const pid = proyectoModuloId.trim();

  const borrarSolicitud = useCallback(
    async (row: NeedRow) => {
      if (!window.confirm('¿Eliminar esta solicitud de personal? No se puede deshacer.')) return;
      setDeletingId(row.id);
      setError(null);
      try {
        const { error: delErr } = await supabase
          .from('recruitment_needs')
          .delete()
          .eq('id', row.id)
          .eq('proyecto_modulo_id', pid);
        if (delErr) {
          setError(delErr.message ?? 'No se pudo eliminar la solicitud.');
          return;
        }
        setNeeds((prev) => prev.filter((n) => n.id !== row.id));
        showToast('Solicitud eliminada.');
      } finally {
        setDeletingId(null);
      }
    },
    [pid, showToast, supabase],
  );

  return (
    <section
      className="mt-6 rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl"
      aria-labelledby="rrhh-proyecto-titulo"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#FF9500]/35 bg-[#FF9500]/10">
          <Users className="h-5 w-5 text-[#FF9500]" aria-hidden />
        </div>
        <div>
          <h2 id="rrhh-proyecto-titulo" className="text-base font-bold tracking-tight text-white">
            RRHH — Personal solicitado
          </h2>
          <p className="text-[11px] text-zinc-500">
            Lista de vacantes del proyecto · Enlace de registro por WhatsApp o copiar al portapapeles
          </p>
        </div>
      </div>

      {vistaHojaVidaDestacada ? (
        <div className="mt-4 rounded-xl border border-[#FF9500]/30 bg-[rgba(255,149,0,0.07)] p-4 backdrop-blur-xl">
          <h3 className="text-sm font-bold text-[#FFD60A]">Planilla de empleo del obrero (vista previa)</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
            Mismo esquema que completará el postulante por el enlace de registro: identificación, contratación, salud,
            familiares, experiencia y datos del patrono. Los campos en blanco se llenan al enviar la planilla.
          </p>
          <div className="mt-3 max-h-[min(78vh,1200px)] overflow-y-auto overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-2 sm:p-3">
            <HojaVidaObreroVista
              hojaVidaLegal={emptyHojaVidaObreroCompleta()}
              planillaPatrono={planillaPatrono ?? undefined}
            />
          </div>
        </div>
      ) : (
        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur-xl open:pb-4">
          <summary className="cursor-pointer py-2 text-sm font-bold text-zinc-200">
            Visualizar planilla de empleo (patrono, obra y trabajador)
          </summary>
          <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">
            Formato legal I. Identificación del trabajador (datos personales, contratación, antecedentes penales,
            instrucción, gremial, médicos, peso/medidas, dependientes y trabajos previos), alineado al PDF y al onboarding.
          </p>
          <HojaVidaObreroVista
            hojaVidaLegal={emptyHojaVidaObreroCompleta()}
            planillaPatrono={planillaPatrono ?? undefined}
          />
        </details>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Cargando requerimientos…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">{error}</p>
      ) : needs.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No hay solicitudes vinculadas. Usa «Nueva vacante» o el flujo de Reclutamiento.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2.5">Cargo</th>
                <th className="px-3 py-2.5">Plazas</th>
                <th className="px-3 py-2.5">Interesados</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {needs.map((row) => {
                const activa = row.protocol_active !== false;
                const sol = cantidadMostrada(row);
                const clics = clicsMostrados(row);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-white/[0.06] transition-colors hover:bg-white/5"
                  >
                    <td className="px-3 py-3 font-medium text-zinc-100">{etiquetaCargo(row)}</td>
                    <td className="px-3 py-3 tabular-nums text-zinc-200">{sol}</td>
                    <td className="px-3 py-3 tabular-nums text-zinc-400">{clics}</td>
                    <td className="px-3 py-3">
                      {activa ? (
                        <span className="inline-flex rounded-full border border-[#FF9500]/50 bg-[#FF9500]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#FF9500]">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-zinc-500">
                          Cerrada
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void borrarSolicitud(row)}
                          disabled={deletingId === row.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/35 px-2.5 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-950/55 disabled:opacity-50"
                          title="Eliminar solicitud"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          {deletingId === row.id ? '…' : 'Eliminar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirWhatsApp(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 shadow-sm transition duration-200 hover:scale-105 hover:bg-emerald-500/25"
                          title="WhatsApp"
                        >
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                          WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => void copiarLink(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/45 bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-100 shadow-sm transition duration-200 hover:scale-105 hover:bg-amber-500/25"
                          title="Copiar enlace de registro"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Copiar link
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[#FF9500]/40 bg-[#0A0A0F]/95 px-4 py-2.5 text-sm font-medium text-[#FF9500] shadow-lg shadow-black/50 backdrop-blur-xl"
        >
          {toast}
        </div>
      ) : null}
    </section>
  );
}
