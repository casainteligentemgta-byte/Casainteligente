'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type VistaRrhh = 'personal' | 'reclutamiento';

type FilaPersonal = {
  id: string;
  nombre_completo: string;
  oficio: string | null;
  estatus: string | null;
  cedula: string | null;
  celular: string | null;
  created_at: string;
};

type FilaPostulante = {
  id: string;
  nombre_completo: string;
  cedula: string | null;
  oficio: string | null;
  estado: string | null;
  created_at: string;
};

function parseVista(raw: string | null): VistaRrhh {
  return raw === 'reclutamiento' ? 'reclutamiento' : 'personal';
}

function RrhhHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vista = parseVista(searchParams.get('vista'));
  const supabase = useMemo(() => createClient(), []);
  const [filasPersonal, setFilasPersonal] = useState<FilaPersonal[]>([]);
  const [filasPostulantes, setFilasPostulantes] = useState<FilaPostulante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (vista === 'personal') {
      const { data, error: err } = await supabase
        .from('ci_personal_activos')
        .select('id,nombre_completo,oficio,estatus,cedula,celular,created_at')
        .order('nombre_completo')
        .limit(500);
      if (err) {
        const fallback = await supabase
          .from('ci_empleados')
          .select('id,nombre_completo,oficio,estatus,cedula,celular,created_at')
          .order('nombre_completo')
          .limit(500);
        if (fallback.error) {
          setError(fallback.error.message);
          setFilasPersonal([]);
        } else {
          setFilasPersonal((fallback.data ?? []) as FilaPersonal[]);
        }
      } else {
        setFilasPersonal((data ?? []) as FilaPersonal[]);
      }
    } else {
      const { data, error: err } = await supabase
        .from('ci_postulantes_reclutamiento')
        .select('id,nombre_completo,cedula,oficio,estado,created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (err) {
        setError(err.message);
        setFilasPostulantes([]);
      } else {
        setFilasPostulantes((data ?? []) as FilaPostulante[]);
      }
    }
    setLoading(false);
  }, [supabase, vista]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const setVista = (v: VistaRrhh) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set('vista', v);
    router.replace(`/rrhh?${qs.toString()}`);
  };

  const glassTab = (active: boolean) =>
    `px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${
      active
        ? 'bg-[#FF9500]/20 border-[#FF9500]/40 text-[#FF9500]'
        : 'bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-4 py-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Recursos Humanos</h1>
            <p className="text-sm text-zinc-500 mt-1">Personal activo y pipeline de reclutamiento</p>
          </div>
          <Link
            href="/rrhh/registro"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF9500] text-black text-xs font-black uppercase"
          >
            <UserPlus size={14} />
            Alta rápida
          </Link>
        </div>

        <nav className="flex flex-wrap gap-2 p-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.04]">
          <button type="button" className={glassTab(vista === 'personal')} onClick={() => setVista('personal')}>
            <span className="inline-flex items-center gap-2">
              <Users size={14} />
              Personal
            </span>
          </button>
          <button
            type="button"
            className={glassTab(vista === 'reclutamiento')}
            onClick={() => setVista('reclutamiento')}
          >
            Reclutamiento
          </button>
        </nav>

        {error ? <p className="text-sm text-amber-400">{error}</p> : null}

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
              <Loader2 className="animate-spin text-[#FF9500]" size={20} />
              Cargando…
            </div>
          ) : vista === 'personal' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="text-left p-3">Nombre</th>
                  <th className="text-left p-3">Cédula</th>
                  <th className="text-left p-3">Oficio</th>
                  <th className="text-left p-3">Estatus</th>
                  <th className="text-left p-3">Celular</th>
                </tr>
              </thead>
              <tbody>
                {filasPersonal.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500">
                      Sin personal activo.
                    </td>
                  </tr>
                ) : (
                  filasPersonal.map((f) => (
                    <tr key={f.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="p-3 font-medium">{f.nombre_completo}</td>
                      <td className="p-3 text-zinc-400">{f.cedula ?? '—'}</td>
                      <td className="p-3 text-zinc-400">{f.oficio ?? '—'}</td>
                      <td className="p-3 text-zinc-400">{f.estatus ?? '—'}</td>
                      <td className="p-3 text-zinc-400">{f.celular ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="text-left p-3">Nombre</th>
                  <th className="text-left p-3">Cédula</th>
                  <th className="text-left p-3">Oficio</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-left p-3">Registro</th>
                </tr>
              </thead>
              <tbody>
                {filasPostulantes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500">
                      Sin postulantes en pipeline.
                    </td>
                  </tr>
                ) : (
                  filasPostulantes.map((f) => (
                    <tr key={f.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="p-3 font-medium">{f.nombre_completo}</td>
                      <td className="p-3 text-zinc-400">{f.cedula ?? '—'}</td>
                      <td className="p-3 text-zinc-400">{f.oficio ?? '—'}</td>
                      <td className="p-3 text-zinc-400">{f.estado ?? '—'}</td>
                      <td className="p-3 text-zinc-500 text-xs">
                        {new Date(f.created_at).toLocaleDateString('es-VE')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-zinc-600">
          Rutas legacy:{' '}
          <Link href="/rrhh/gestion-personal" className="text-[#FF9500] hover:underline">
            gestión personal
          </Link>
          {' · '}
          <Link href="/rrhh/hojas-vida" className="text-[#FF9500] hover:underline">
            hojas de vida
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RrhhPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-zinc-500">
          <Loader2 className="animate-spin text-[#FF9500]" size={22} />
        </div>
      }
    >
      <RrhhHubInner />
    </Suspense>
  );
}
