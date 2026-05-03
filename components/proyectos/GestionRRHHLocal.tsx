'use client';

import { ExternalLink, MessageSquare, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const REGISTRO_PUBLICO = 'https://casa-inteligente.app/registro';
const REGISTRO_ORIGEN =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_REGISTRO_ORIGEN?.trim()) ||
  'https://casa-inteligente.app';

export type GestionRRHHLocalProps = {
  /** UUID de `ci_proyectos` (módulo integral). */
  proyectoModuloId: string;
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
};

function etiquetaCargo(row: NeedRow): string {
  const n = (row.cargo_nombre ?? '').trim();
  if (n) return n;
  const t = (row.title ?? '').trim();
  return t || 'Vacante';
}

function roleParam(row: NeedRow): string {
  const cod = (row.cargo_codigo ?? '').trim();
  if (cod) return cod;
  return etiquetaCargo(row).slice(0, 120);
}

/** URL usada en WhatsApp (dominio fijo del enunciado) y al copiar si no hay override en env. */
function urlRegistroPublica(proyectoModuloId: string, row: NeedRow): string {
  const prj = encodeURIComponent(proyectoModuloId.trim());
  const role = encodeURIComponent(roleParam(row));
  return `${REGISTRO_PUBLICO}?prj=${prj}&role=${role}`;
}

function urlRegistroCopiar(proyectoModuloId: string, row: NeedRow): string {
  const base = REGISTRO_ORIGEN.replace(/\/$/, '');
  if (base === 'https://casa-inteligente.app') {
    return urlRegistroPublica(proyectoModuloId, row);
  }
  const prj = encodeURIComponent(proyectoModuloId.trim());
  const role = encodeURIComponent(roleParam(row));
  return `${base}/registro?prj=${prj}&role=${role}`;
}

function mensajeWhatsApp(proyectoModuloId: string, row: NeedRow): string {
  const cargo = etiquetaCargo(row);
  const link = urlRegistroPublica(proyectoModuloId, row);
  return `Hola, Casa Inteligente te invita a postularte para el cargo de ${cargo}. Completa tu perfil aquí: ${link}`;
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

export default function GestionRRHHLocal({ proyectoModuloId }: GestionRRHHLocalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
          'id,title,cargo_nombre,cargo_codigo,protocol_active,created_at,cantidad_requerida,conteo_clics',
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
        .select('id,title,cargo_nombre,cargo_codigo,protocol_active,created_at,cantidad_requerida')
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
        .select('id,title,cargo_nombre,cargo_codigo,protocol_active,created_at')
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
  }, [proyectoModuloId, supabase]);

  const abrirWhatsApp = useCallback(
    (row: NeedRow) => {
      const text = encodeURIComponent(mensajeWhatsApp(proyectoModuloId.trim(), row));
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    },
    [proyectoModuloId],
  );

  const copiarLink = useCallback(
    async (row: NeedRow) => {
      const url = urlRegistroCopiar(proyectoModuloId.trim(), row);
      try {
        await navigator.clipboard.writeText(url);
        showToast('Enlace copiado al portapapeles.');
      } catch {
        showToast('No se pudo copiar. Copia manualmente el enlace.');
      }
    },
    [proyectoModuloId, showToast],
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
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2.5">Cargo</th>
                <th className="px-3 py-2.5">Solicitados / interesados</th>
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
                    <td className="px-3 py-3 tabular-nums text-zinc-300">
                      <span className="font-semibold text-white">{sol}</span>
                      <span className="text-zinc-600"> · </span>
                      <span className="text-zinc-400">{clics}</span>
                    </td>
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
