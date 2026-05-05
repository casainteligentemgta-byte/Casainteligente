'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type ObraOpt = { id: string; nombre: string; estado: string };

export default function CierreObraPage() {
  const supabase = createClient();
  const [obras, setObras] = useState<ObraOpt[]>([]);
  const [obraId, setObraId] = useState('');
  const [data, setData] = useState<{
    margen_neto_usd: number;
    precio_venta_usd: number;
    suma_materiales_usd: number;
    honorarios_empleados_usd: number;
    multas_acumuladas_usd: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = true;
    (async () => {
      const { data: rows } = await supabase
        .from('ci_proyectos')
        .select('id,nombre,obra_estado_legacy')
        .eq('tipo_proyecto', 'talento')
        .order('nombre');
      if (!c) return;
      setObras(
        ((rows ?? []) as { id: string; nombre: string; obra_estado_legacy: string | null }[]).map((r) => ({
          id: r.id,
          nombre: r.nombre,
          estado: (r.obra_estado_legacy ?? '—').trim() || '—',
        })),
      );
    })();
    return () => {
      c = false;
    };
  }, [supabase]);

  async function calcular() {
    if (!obraId) return;
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const res = await fetch(`/api/talento/cierre/${obraId}`);
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || 'Error');
        return;
      }
      setData(j);
    } catch {
      setErr('Error de red');
    } finally {
      setLoading(false);
    }
  }

  async function cerrarObra() {
    if (!obraId) return;
    if (!confirm('¿Marcar esta obra como cerrada?')) return;
    const cierreAt = new Date().toISOString();
    const { error } = await supabase
      .from('ci_proyectos')
      .update({
        estado: 'cerrado',
        obra_estado_legacy: 'cerrada',
        obra_fecha_cierre: cierreAt,
        updated_at: cierreAt,
      })
      .eq('id', obraId)
      .eq('tipo_proyecto', 'talento');
    if (error) {
      alert(error.message);
      return;
    }
    setObras((prev) => prev.map((o) => (o.id === obraId ? { ...o, estado: 'cerrada' } : o)));
    alert('Obra cerrada.');
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 pb-28">
      <Link href="/talento" className="text-xs text-zinc-500 hover:text-zinc-300 mb-6 inline-block">
        ← Talento
      </Link>
      <h1 className="text-2xl font-bold text-white mb-2">Cierre y rentabilidad</h1>
      <p className="text-sm text-zinc-400 mb-6">
        <strong className="text-zinc-300">Margen neto</strong> = precio de venta − materiales − (honorarios al talento −
        multas). Las multas reducen el pago al empleado y mejoran el margen.
      </p>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Obra</label>
          <select
            className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} ({o.estado})
              </option>
            ))}
          </select>
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="button"
          disabled={loading || !obraId}
          onClick={() => void calcular()}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-3 text-sm"
        >
          {loading ? 'Calculando…' : 'Calcular margen neto'}
        </button>
        <button
          type="button"
          disabled={!obraId}
          onClick={() => void cerrarObra()}
          className="w-full rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-900 py-3 text-sm"
        >
          Cerrar obra (estado)
        </button>
      </div>

      {data && (
        <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-6 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-emerald-500/80">Resultado</p>
          <p className="text-3xl font-bold text-emerald-400">${data.margen_neto_usd.toFixed(2)}</p>
          <p className="text-xs text-zinc-500">Margen neto del proyecto (USD)</p>
          <dl className="grid grid-cols-2 gap-2 text-sm pt-4 border-t border-zinc-800">
            <dt className="text-zinc-500">Precio venta</dt>
            <dd className="text-zinc-200 text-right">${data.precio_venta_usd.toFixed(2)}</dd>
            <dt className="text-zinc-500">Materiales</dt>
            <dd className="text-zinc-200 text-right">−${data.suma_materiales_usd.toFixed(2)}</dd>
            <dt className="text-zinc-500">Honorarios talento</dt>
            <dd className="text-zinc-200 text-right">−${data.honorarios_empleados_usd.toFixed(2)}</dd>
            <dt className="text-zinc-500">Multas (descuento)</dt>
            <dd className="text-emerald-400 text-right">+${data.multas_acumuladas_usd.toFixed(2)}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
