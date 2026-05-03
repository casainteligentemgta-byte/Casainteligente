'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function EmpleadoFichaPage() {
  const params = useParams();
  const id = String(params?.id ?? '').trim();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Identificador no válido.');
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('ci_empleados')
        .select('id,nombre_completo,estado,semaforo')
        .eq('id', id)
        .maybeSingle();
      if (!alive) return;
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      if (!data) {
        setError('Empleado no encontrado.');
        return;
      }
      const row = data as { nombre_completo?: string; estado?: string; semaforo?: string | null };
      setNombre(row.nombre_completo ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 pb-28 pt-6">
      <div className="mx-auto max-w-lg">
        <Link href="/reclutamiento/dashboard" className="text-sm font-medium text-sky-400 hover:underline">
          ← Reclutamiento
        </Link>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <h1 className="text-xl font-bold text-white">Ficha de empleado</h1>
          {loading ? <p className="mt-4 text-sm text-zinc-500">Cargando…</p> : null}
          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
          {!loading && !error && nombre ? (
            <p className="mt-4 text-sm text-zinc-200">
              <span className="font-semibold text-white">{nombre}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
