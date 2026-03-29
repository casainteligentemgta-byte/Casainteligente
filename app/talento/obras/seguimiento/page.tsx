'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { diasRetraso, penalizacionRetrasoUsd } from '@/lib/talento/obra-math';

type ObraRow = {
  id: string;
  codigo: string | null;
  nombre: string;
  fecha_entrega_prometida: string;
  avance_porcentaje: number;
  penalizacion_diaria_usd: number;
  estado: string;
};

export default function SeguimientoObraPage() {
  const supabase = createClient();
  const [obras, setObras] = useState<ObraRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = true;
    (async () => {
      const { data, error } = await supabase
        .from('ci_obras')
        .select('id,codigo,nombre,fecha_entrega_prometida,avance_porcentaje,penalizacion_diaria_usd,estado')
        .eq('estado', 'activa')
        .order('fecha_entrega_prometida');
      if (!c) return;
      if (!error && data) setObras(data as ObraRow[]);
      setLoading(false);
    })();
    return () => {
      c = false;
    };
  }, [supabase]);

  const hoy = new Date();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 pb-28">
      <Link href="/talento" className="text-xs text-zinc-500 hover:text-zinc-300 mb-6 inline-block">
        ← Talento
      </Link>
      <h1 className="text-2xl font-bold text-white mb-2">Seguimiento de obra</h1>
      <p className="text-sm text-zinc-400 mb-8">
        Compara la fecha actual con la entrega prometida. La penalización estimada usa la tarifa diaria configurada en la
        obra.
      </p>

      {loading ? (
        <p className="text-zinc-500">Cargando…</p>
      ) : obras.length === 0 ? (
        <p className="text-zinc-500 text-sm">No hay obras activas. Inserta registros en <code className="text-zinc-400">ci_obras</code>.</p>
      ) : (
        <div className="space-y-4">
          {obras.map((o) => {
            const entrega = new Date(o.fecha_entrega_prometida);
            const dias = diasRetraso(entrega, hoy);
            const penal = penalizacionRetrasoUsd(entrega, Number(o.penalizacion_diaria_usd || 0), hoy);
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500">{o.codigo ?? 'Sin código'}</p>
                  <h2 className="text-lg font-semibold text-white">{o.nombre}</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Entrega prometida:{' '}
                    <span className="text-zinc-300">{entrega.toLocaleDateString('es-VE')}</span>
                  </p>
                  <p className="text-sm text-sky-400 mt-2">Avance: {Number(o.avance_porcentaje).toFixed(0)}%</p>
                </div>
                <div className="text-right sm:min-w-[200px]">
                  {dias > 0 ? (
                    <>
                      <p className="text-sm text-red-400 font-medium">{dias} día(s) de retraso</p>
                      <p className="text-xs text-zinc-500 mt-1">Penalización acumulada (est.)</p>
                      <p className="text-lg font-mono text-amber-400">${penal.toFixed(2)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-emerald-400 font-medium">En plazo o adelantado</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
