'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Brain, Palette, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import PsiqueCargoPanel, {
  type PsiqueRecUi,
} from '@/components/rrhh/reclutamiento/PsiqueCargoPanel';
import { apiUrl } from '@/lib/http/apiUrl';
import { etiquetaRolExamenUI } from '@/lib/talento/exam';
import { createClient } from '@/lib/supabase/client';

type EmpleadoOpt = {
  id: string;
  nombre_completo: string | null;
  cedula: string | null;
  documento: string | null;
  perfil_color: string | null;
  status_evaluacion: string | null;
};

function docOf(e: EmpleadoOpt): string {
  return (e.cedula ?? e.documento ?? '').trim();
}

export default function RrhhEvaluacionesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [empleados, setEmpleados] = useState<EmpleadoOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [empleadoId, setEmpleadoId] = useState('');
  const [psique, setPsique] = useState<PsiqueRecUi | null>(null);
  const [busyPsique, setBusyPsique] = useState(false);
  const [busyColor, setBusyColor] = useState(false);
  const [linkPsique, setLinkPsique] = useState<string | null>(null);
  const [linkColor, setLinkColor] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ci_empleados')
      .select('id,nombre_completo,cedula,documento,perfil_color,status_evaluacion')
      .order('created_at', { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setEmpleados([]);
      return;
    }
    setEmpleados((data ?? []) as EmpleadoOpt[]);
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const seleccionado = empleados.find((e) => e.id === empleadoId) ?? null;

  const emitir = async (tipo: 'psique' | 'color') => {
    if (!seleccionado) {
      toast.error('Selecciona un empleado del archivo');
      return;
    }
    const doc = docOf(seleccionado);
    if (!doc) {
      toast.error('El expediente no tiene cédula');
      return;
    }
    if (tipo === 'psique') setBusyPsique(true);
    else setBusyColor(true);
    try {
      const rol =
        psique?.rol_examen_para_enlace ??
        psique?.rol_examen_sugerido ??
        'obrero';
      if (tipo === 'psique' && psique?.rol_examen_para_enlace) {
        await supabase
          .from('ci_empleados')
          .update({ rol_examen: rol } as never)
          .eq('id', seleccionado.id);
      }
      const res = await fetch(apiUrl('/api/registro/emitir-invitacion-examen'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empleadoId: seleccionado.id, cedula: doc }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        exam_url?: string;
        color_exam_url?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo generar el enlace');
        return;
      }
      if (tipo === 'psique') {
        const url = j.exam_url;
        if (!url) {
          toast.error('Respuesta sin URL de evaluación psicológica');
          return;
        }
        setLinkPsique(url);
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Enlace de evaluación psicológica copiado');
        } catch {
          toast.message('Enlace listo');
        }
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const url = j.color_exam_url;
        if (!url) {
          toast.error('Respuesta sin URL de evaluación de color');
          return;
        }
        setLinkColor(url);
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Enlace de evaluación de color copiado');
        } catch {
          toast.message('Enlace listo');
        }
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setBusyPsique(false);
      setBusyColor(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8">
      <header className="mb-8">
        <Link
          href="/rrhh/hojas-vida"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          RRHH
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Casa Inteligente
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Evaluaciones</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Emite la evaluación psicológica (banco del examen según cargo) y la evaluación de tipo
              de color (DISC: Rojo, Amarillo, Verde, Azul) para el personal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
          Empleado / expediente
        </label>
        <select
          value={empleadoId}
          onChange={(e) => {
            setEmpleadoId(e.target.value);
            setLinkPsique(null);
            setLinkColor(null);
          }}
          className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-sky-500/50"
        >
          <option value="">Seleccionar…</option>
          {empleados.map((e) => (
            <option key={e.id} value={e.id}>
              {(e.nombre_completo ?? 'Sin nombre').trim()} · {docOf(e) || 'sin cédula'}
              {e.perfil_color ? ` · ${e.perfil_color}` : ''}
            </option>
          ))}
        </select>
        {seleccionado ? (
          <p className="mt-2 text-xs text-zinc-500">
            Eval. actual: {seleccionado.status_evaluacion ?? '—'}
            {seleccionado.perfil_color ? ` · Color ${seleccionado.perfil_color}` : ''}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-300" aria-hidden />
            <h2 className="text-sm font-bold text-violet-100">Evaluación psicológica</h2>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-zinc-400">
            Según el cargo, Psique recomienda el banco (ABC obrero, trípode GMA/integridad, etc.) y
            el rol del examen. Luego emite el enlace para que el candidato lo complete.
          </p>
          <PsiqueCargoPanel onRecomendacion={setPsique} />
          {psique?.rol_examen_sugerido ? (
            <p className="mt-3 text-xs text-violet-200/90">
              Rol sugerido:{' '}
              <span className="font-semibold">
                {etiquetaRolExamenUI(psique.rol_examen_sugerido)}
              </span>
            </p>
          ) : null}
          <button
            type="button"
            disabled={!empleadoId || busyPsique}
            onClick={() => void emitir('psique')}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-violet-600/30 px-4 py-2.5 text-sm font-semibold text-violet-50 hover:bg-violet-600/45 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {busyPsique ? 'Generando…' : 'Emitir evaluación psicológica'}
          </button>
          {linkPsique ? (
            <p className="mt-2 break-all text-[11px] text-zinc-500">{linkPsique}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Palette className="h-5 w-5 text-amber-300" aria-hidden />
            <h2 className="text-sm font-bold text-amber-100">Evaluación tipo de color</h2>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-zinc-400">
            Perfil DISC simplificado para obra: <span className="text-red-400">Rojo</span>,{' '}
            <span className="text-amber-300">Amarillo</span>,{' '}
            <span className="text-emerald-400">Verde</span>,{' '}
            <span className="text-sky-400">Azul</span>, más razonamiento y confiabilidad
            operativa. El resultado queda en el expediente (`perfil_color`).
          </p>
          <ul className="mb-4 space-y-1.5 text-xs text-zinc-400">
            <li>· Pares forzados de color (personalidad operativa)</li>
            <li>· Preguntas de lógica de campo</li>
            <li>· Situaciones de integridad / protocolo</li>
          </ul>
          <button
            type="button"
            disabled={!empleadoId || busyColor}
            onClick={() => void emitir('color')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-600/25 px-4 py-2.5 text-sm font-semibold text-amber-50 hover:bg-amber-600/40 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {busyColor ? 'Generando…' : 'Emitir evaluación de color'}
          </button>
          {linkColor ? (
            <p className="mt-2 break-all text-[11px] text-zinc-500">{linkColor}</p>
          ) : null}
          <Link
            href="/rrhh/reclutamiento"
            className="mt-4 inline-block text-xs font-semibold text-amber-200/80 underline-offset-2 hover:underline"
          >
            Ver seguimiento en Reclutamiento →
          </Link>
        </section>
      </div>
    </div>
  );
}
