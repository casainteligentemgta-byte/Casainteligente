'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cargoPorCodigo } from '@/lib/constants/cargosObreros';

function uuidOk(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

type NeedRow = {
  id: string;
  title: string | null;
  cargo_nombre: string | null;
  cargo_codigo: string | null;
  protocol_active: boolean | null;
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Código tabulador tipo 1.2, 10.5 (coma → punto, sin espacios). */
function normCodigoTabulador(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
}

function matchesRole(row: NeedRow, role: string): boolean {
  const r = norm(role);
  if (!r) return false;

  const codRaw = (row.cargo_codigo ?? '').trim();
  const cod = norm(codRaw);
  const codTab = normCodigoTabulador(codRaw);
  const rTab = normCodigoTabulador(role);

  if (cod && cod === r) return true;
  if (cod && r.replace(/\s/g, '') === cod.replace(/\s/g, '')) return true;
  if (codTab && rTab && codTab === rTab) return true;

  const cat = rTab ? cargoPorCodigo(rTab) : undefined;
  if (cat) {
    const nomRow = norm(row.cargo_nombre ?? '');
    const nomCat = norm(cat.nombre);
    if (nomRow && nomCat && (nomRow === nomCat || nomRow.includes(nomCat) || nomCat.includes(nomRow))) return true;
    const title = norm(row.title ?? '');
    if (nomCat && title && (title.includes(nomCat) || title.includes(rTab))) return true;
  }

  const nombre = norm(row.cargo_nombre ?? '');
  const title = norm(row.title ?? '');
  return (nombre && nombre.includes(r)) || (title && title.includes(r)) || nombre === r || title === r;
}

function RegistroInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const prj = (searchParams.get('prj') ?? '').trim();
  const role = (searchParams.get('role') ?? '').trim();

  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<NeedRow[]>([]);
  const [allProject, setAllProject] = useState<NeedRow[]>([]);

  useEffect(() => {
    if (!prj || !role) {
      setPhase('error');
      setError('Falta el proyecto o el cargo en el enlace (parámetros prj y role).');
      return;
    }
    if (!uuidOk(prj)) {
      setPhase('error');
      setError('El identificador de proyecto no es válido.');
      return;
    }

    let alive = true;
    (async () => {
      setPhase('loading');
      setError(null);

      const { data: rows, error: err } = await supabase
        .from('recruitment_needs')
        .select('id,title,cargo_nombre,cargo_codigo,protocol_active,proyecto_modulo_id')
        .eq('proyecto_modulo_id', prj)
        .order('created_at', { ascending: false });

      if (!alive) return;

      if (err) {
        setPhase('error');
        setError(err.message || 'No se pudieron cargar las vacantes.');
        return;
      }

      const list = (rows ?? []) as NeedRow[];
      const active = list.filter((r) => r.protocol_active !== false);
      const pool = active.length ? active : list;

      const direct = pool.filter((r) => matchesRole(r, role));
      setMatches(direct);
      setAllProject(pool);

      if (direct.length === 1) {
        router.replace(`/reclutamiento?need=${encodeURIComponent(direct[0].id)}`);
        return;
      }
      /** Una sola vacante en el proyecto: el enlace siempre lleva a ella (evita «no encontrada» por título vs código). */
      if (pool.length === 1) {
        router.replace(`/reclutamiento?need=${encodeURIComponent(pool[0].id)}`);
        return;
      }

      setPhase('ready');
    })();

    return () => {
      alive = false;
    };
  }, [prj, role, router, supabase]);

  if (phase === 'loading' || (phase === 'idle' && prj && role && uuidOk(prj))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
        <p className="text-sm text-zinc-300">Buscando vacante y abriendo postulación…</p>
      </div>
    );
  }

  if (phase === 'error' || !prj || !role) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-lg font-bold text-white">Enlace de registro</h1>
          <p className="mt-2 text-sm text-red-300">{error ?? 'Este enlace no es válido o está incompleto.'}</p>
          <p className="mt-4 text-xs text-zinc-500">
            Si el problema continúa, pide a RRHH un enlace nuevo desde el proyecto (WhatsApp o copiar link).
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold text-amber-400 hover:underline">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-bold text-white">Casa Inteligente — Postulación</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Proyecto vinculado. Elige la vacante que coincide con el cargo que te indicaron ({role}).
        </p>

        {matches.length > 1 ? (
          <ul className="mt-6 space-y-2">
            {matches.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/reclutamiento?need=${encodeURIComponent(n.id)}`}
                  className="block rounded-xl border border-emerald-500/35 bg-emerald-950/40 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/50"
                >
                  {n.cargo_nombre?.trim() || n.title?.trim() || 'Vacante'}{' '}
                  {n.cargo_codigo ? (
                    <span className="block text-xs font-normal text-emerald-200/80">Código {n.cargo_codigo}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : matches.length === 0 && allProject.length > 0 ? (
          <>
            <p className="mt-4 text-sm text-amber-200/90">
              No encontramos una vacante con el código exacto «{role}». Vacantes abiertas en este proyecto:
            </p>
            <ul className="mt-4 space-y-2">
              {allProject.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/reclutamiento?need=${encodeURIComponent(n.id)}`}
                    className="block rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-zinc-100 hover:bg-white/10"
                  >
                    {n.cargo_nombre?.trim() || n.title?.trim() || 'Vacante'}
                    {n.cargo_codigo ? (
                      <span className="block text-xs text-zinc-500">Código {n.cargo_codigo}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            No hay vacantes registradas para este proyecto. RRHH debe crear la necesidad en el módulo de proyectos.
          </p>
        )}

        <Link href="/reclutamiento" className="mt-8 inline-block text-sm text-sky-400 hover:underline">
          Abrir reclutamiento sin vacante
        </Link>
      </div>
    </div>
  );
}

export default function RegistroPublicoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-zinc-400 text-sm">
          Cargando…
        </div>
      }
    >
      <RegistroInner />
    </Suspense>
  );
}
