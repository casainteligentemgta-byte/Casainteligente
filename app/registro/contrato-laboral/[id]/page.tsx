'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/lib/http/apiUrl';

type DatoFaltante = { id: string; etiqueta: string; ayuda: string };

type Meta = {
  contrato_id: string;
  estado_contrato: string;
  obrero_aceptacion_contrato_at: string | null;
  nombre_completo: string;
  documento: string | null;
  datos_faltantes?: DatoFaltante[];
  tiene_datos_faltantes?: boolean;
  planilla_completar_url?: string | null;
};

function ContratoLaboralObreroInner() {
  const params = useParams();
  const sp = useSearchParams();
  const contratoId = String(params?.id ?? '').trim();
  const token = (sp.get('token') ?? '').trim();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aceptando, setAceptando] = useState(false);
  const [pdfTick, setPdfTick] = useState(0);

  const pdfSrc =
    contratoId && token
      ? apiUrl(
          `/api/registro/contrato-laboral/pdf?contrato_id=${encodeURIComponent(contratoId)}&token=${encodeURIComponent(token)}`,
        )
      : null;

  const cargar = useCallback(async () => {
    if (!contratoId || !token) {
      setError('Faltan el id del contrato en la URL o el token (?token=…).');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(
          `/api/registro/contrato-laboral/meta?contrato_id=${encodeURIComponent(contratoId)}&token=${encodeURIComponent(token)}`,
        ),
      );
      const j = (await res.json().catch(() => ({}))) as Meta & { error?: string };
      if (!res.ok) {
        setError(j.error ?? 'No se pudo cargar el contrato');
        setMeta(null);
        return;
      }
      setMeta({
        contrato_id: j.contrato_id,
        estado_contrato: j.estado_contrato,
        obrero_aceptacion_contrato_at: j.obrero_aceptacion_contrato_at,
        nombre_completo: j.nombre_completo,
        documento: j.documento,
        datos_faltantes: Array.isArray(j.datos_faltantes) ? j.datos_faltantes : [],
        tiene_datos_faltantes: Boolean(j.tiene_datos_faltantes),
        planilla_completar_url: j.planilla_completar_url ?? null,
      });
      setPdfTick((n) => n + 1);
    } catch {
      setError('Error de red');
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [contratoId, token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void cargar();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [cargar]);

  const aceptar = async () => {
    if (!contratoId || !token) return;
    setAceptando(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/registro/contrato-laboral/aceptar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato_id: contratoId, token }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; obrero_aceptacion_contrato_at?: string };
      if (!res.ok) {
        setError(j.error ?? 'No se pudo registrar la aceptación');
        return;
      }
      await cargar();
    } catch {
      setError('Error de red al aceptar');
    } finally {
      setAceptando(false);
    }
  };

  const aceptado = Boolean(meta?.obrero_aceptacion_contrato_at);

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/registro" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Registro
        </Link>
        <h1 className="mt-4 text-xl font-bold text-white">Contrato laboral</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Revisa el PDF. Si estás de acuerdo, acepta de forma electrónica; después podrás abrirlo para imprimirlo y firmarlo
          en físico (huella y firma autógrafa), según indicaciones de RRHH.
        </p>

        {loading ? <p className="mt-6 text-sm text-zinc-500">Cargando…</p> : null}
        {error ? (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200">{error}</p>
        ) : null}

        {meta && !loading ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
              <p>
                <span className="text-zinc-500">Trabajador:</span>{' '}
                <span className="font-medium text-white">{meta.nombre_completo}</span>
              </p>
              {meta.documento ? (
                <p className="mt-1">
                  <span className="text-zinc-500">Documento:</span>{' '}
                  <span className="text-zinc-200">{meta.documento}</span>
                </p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-500">
                Estado en sistema: <span className="text-zinc-300">{meta.estado_contrato}</span>
                {aceptado ? (
                  <span className="ml-2 text-emerald-400">· Aceptación registrada</span>
                ) : null}
              </p>
            </div>

            {meta.tiene_datos_faltantes && meta.datos_faltantes?.length ? (
              <div className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
                <p className="font-semibold text-amber-50">Faltan datos para completar el contrato</p>
                <p className="mt-1 text-xs text-amber-200/90">
                  El PDF mostrará temporalmente los campos pendientes. Actualiza la planilla de empleo y vuelve a esta
                  página (o pulsa «Recargar contrato»).
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-100/95">
                  {meta.datos_faltantes.slice(0, 12).map((d) => (
                    <li key={d.id}>
                      <span className="font-medium">{d.etiqueta}</span>
                      {d.ayuda ? <span className="text-amber-200/80"> — {d.ayuda}</span> : null}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {meta.planilla_completar_url ? (
                    <a
                      href={apiUrl(meta.planilla_completar_url)}
                      className="inline-flex rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400"
                    >
                      Completar planilla de empleo
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void cargar()}
                    className="inline-flex rounded-lg border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/10"
                  >
                    Recargar contrato
                  </button>
                </div>
              </div>
            ) : null}

            {pdfSrc ? (
              <iframe
                key={pdfTick}
                title="Contrato PDF"
                src={pdfSrc}
                className="h-[70vh] w-full rounded-xl border border-white/10 bg-zinc-950"
              />
            ) : null}

            {!aceptado ? (
              <button
                type="button"
                disabled={aceptando}
                onClick={() => void aceptar()}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {aceptando ? 'Registrando…' : 'He leído el contrato y acepto de forma electrónica'}
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/10 px-4 py-4">
                <p className="text-sm text-[#FFD60A]">
                  Siguiente paso: imprime el contrato, firma a mano y estampa huella donde corresponda. RRHH confirmará en
                  el sistema cuando reciba el documento físico.
                </p>
                {pdfSrc ? (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={pdfSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
                    >
                      Abrir PDF para imprimir
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        if (pdfSrc) window.open(pdfSrc, '_blank', 'noopener,noreferrer');
                      }}
                      className="inline-flex rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10"
                    >
                      Otra pestaña (impresión)
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ContratoLaboralObreroPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-sm text-zinc-500">Cargando…</div>
      }
    >
      <ContratoLaboralObreroInner />
    </Suspense>
  );
}
