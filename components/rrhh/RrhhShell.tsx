'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, HardHat, Users } from 'lucide-react';
import ModuloPageTitle from '@/components/ui/ModuloPageTitle';
import {
  etiquetaRrhhAlcanceMode,
  guardarRrhhAlcanceEnStorage,
  queryRrhhAlcance,
  resolverRrhhAlcanceDesdeUrl,
  type RrhhAlcanceMode,
  type RrhhAlcanceState,
} from '@/lib/rrhh/rrhhAlcance';
import {
  RRHH_HUB_HREF,
  RRHH_NAV_SECTIONS,
  filtrarNavPorAlcance,
  hrefRrhhConAlcance,
  rrhhNavItemActivo,
  rrhhPathSinShell,
} from '@/lib/rrhh/rrhhNav';
import {
  loadProyectosSmartRrhhHojasVida,
  type ProyectoModuloIntegral,
} from '@/lib/proyectos/proyectosUnificados';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type EntidadOpt = { id: string; nombre: string };

type Props = {
  children: React.ReactNode;
};

/**
 * Shell RRHH: título + selector Dirección/Obra + nav filtrada por alcance.
 */
export default function RrhhShell({ children }: Props) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [alcance, setAlcance] = useState<RrhhAlcanceState>(() =>
    resolverRrhhAlcanceDesdeUrl(searchParams),
  );
  const [entidades, setEntidades] = useState<EntidadOpt[]>([]);
  const [obras, setObras] = useState<ProyectoModuloIntegral[]>([]);
  const [metaReady, setMetaReady] = useState(false);

  useEffect(() => {
    setAlcance(resolverRrhhAlcanceDesdeUrl(searchParams));
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [entRes, proyRes] = await Promise.all([
        supabase
          .from('ci_entidades')
          .select('id,nombre,es_patrono')
          .order('nombre')
          .limit(200),
        loadProyectosSmartRrhhHojasVida(supabase),
      ]);
      if (!alive) return;

      const ents = ((entRes.data ?? []) as { id: string; nombre?: string | null; es_patrono?: boolean | null }[])
        .filter((e) => e.es_patrono !== false)
        .map((e) => ({ id: e.id, nombre: (e.nombre ?? '').trim() || e.id.slice(0, 8) }));
      setEntidades(ents);
      setObras(proyRes.proyectos);

      setAlcance((prev) => {
        let next = { ...prev };
        if (!next.entidadId && ents[0]) next = { ...next, entidadId: ents[0].id };
        if (next.mode === 'obra' && !next.proyectoModuloId && proyRes.proyectos[0]) {
          next = { ...next, proyectoModuloId: proyRes.proyectos[0].id };
          const entObra = (proyRes.proyectos[0].entidad_id ?? '').trim();
          if (entObra) next = { ...next, entidadId: entObra };
        }
        if (next.mode === 'obra' && next.proyectoModuloId) {
          const obra = proyRes.proyectos.find((p) => p.id === next.proyectoModuloId);
          const entObra = (obra?.entidad_id ?? '').trim();
          if (entObra) next = { ...next, entidadId: entObra };
        }
        return next;
      });
      setMetaReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const aplicarAlcance = useCallback(
    (next: RrhhAlcanceState, opts?: { replacePath?: boolean }) => {
      setAlcance(next);
      guardarRrhhAlcanceEnStorage(next);
      const q = queryRrhhAlcance(next);
      const path = opts?.replacePath ? RRHH_HUB_HREF : pathname.split('?')[0] || RRHH_HUB_HREF;
      router.replace(`${path}${q}`, { scroll: false });
    },
    [pathname, router],
  );

  const onChangeMode = (mode: RrhhAlcanceMode) => {
    const next: RrhhAlcanceState = {
      ...alcance,
      mode,
      proyectoModuloId:
        mode === 'obra'
          ? alcance.proyectoModuloId || obras[0]?.id || null
          : alcance.proyectoModuloId,
    };
    if (mode === 'obra' && next.proyectoModuloId) {
      const obra = obras.find((p) => p.id === next.proyectoModuloId);
      const ent = (obra?.entidad_id ?? '').trim();
      if (ent) next.entidadId = ent;
    }
    aplicarAlcance(next, { replacePath: pathname === RRHH_HUB_HREF || pathname === '/rrhh' });
  };

  const onChangeEntidad = (entidadId: string) => {
    const id = entidadId.trim() || null;
    const obrasEnt = id ? obras.filter((o) => (o.entidad_id ?? '') === id) : obras;
    const next: RrhhAlcanceState = {
      ...alcance,
      entidadId: id,
      proyectoModuloId:
        alcance.mode === 'obra'
          ? obrasEnt.find((o) => o.id === alcance.proyectoModuloId)?.id ??
            obrasEnt[0]?.id ??
            null
          : alcance.proyectoModuloId,
    };
    aplicarAlcance(next);
  };

  const onChangeObra = (proyectoId: string) => {
    const id = proyectoId.trim() || null;
    const obra = obras.find((p) => p.id === id);
    const next: RrhhAlcanceState = {
      ...alcance,
      mode: 'obra',
      proyectoModuloId: id,
      entidadId: (obra?.entidad_id ?? '').trim() || alcance.entidadId,
    };
    aplicarAlcance(next);
  };

  if (rrhhPathSinShell(pathname)) {
    return <>{children}</>;
  }

  const sections = filtrarNavPorAlcance(RRHH_NAV_SECTIONS, alcance.mode);
  const obrasFiltradas = alcance.entidadId
    ? obras.filter((o) => !o.entidad_id || o.entidad_id === alcance.entidadId)
    : obras;

  const selectClass =
    'rounded-lg border border-white/15 bg-zinc-950/80 px-2.5 py-1.5 text-xs font-medium text-zinc-100 outline-none focus:border-pink-400/50';

  return (
    <div className="min-h-screen text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Casa Inteligente
              </p>
              <ModuloPageTitle
                title="RRHH"
                icon={Users}
                iconClassName="text-pink-400"
                hrefInicio={hrefRrhhConAlcance(RRHH_HUB_HREF, alcance)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5"
                role="group"
                aria-label="Alcance RRHH"
              >
                <button
                  type="button"
                  onClick={() => onChangeMode('entidad')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition',
                    alcance.mode === 'entidad'
                      ? 'bg-pink-500/25 text-pink-50'
                      : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  <Building2 className="size-3.5" aria-hidden />
                  Dirección
                </button>
                <button
                  type="button"
                  onClick={() => onChangeMode('obra')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition',
                    alcance.mode === 'obra'
                      ? 'bg-amber-500/25 text-amber-50'
                      : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  <HardHat className="size-3.5" aria-hidden />
                  Obra
                </button>
              </div>

              {metaReady ? (
                <>
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Entidad
                    <select
                      className={selectClass}
                      value={alcance.entidadId ?? ''}
                      onChange={(e) => onChangeEntidad(e.target.value)}
                    >
                      <option value="">—</option>
                      {entidades.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  {alcance.mode === 'obra' ? (
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Obra
                      <select
                        className={cn(selectClass, 'max-w-[14rem]')}
                        value={alcance.proyectoModuloId ?? ''}
                        onChange={(e) => onChangeObra(e.target.value)}
                      >
                        <option value="">—</option>
                        {obrasFiltradas.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : (
                <span className="text-[11px] text-zinc-600">Cargando alcance…</span>
              )}
            </div>
          </div>

          <p className="mt-2 text-[11px] text-zinc-500">
            Vista: <span className="font-semibold text-zinc-300">{etiquetaRrhhAlcanceMode(alcance.mode)}</span>
            {alcance.mode === 'entidad'
              ? ' · políticas, banca, expedientes y nómina de la entidad'
              : ' · solicitud, gestión y contratos express de la obra'}
          </p>

          <nav className="mt-3 flex flex-col gap-2.5" aria-label="Módulo RRHH">
            {sections.map((section) => (
              <div
                key={section.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
              >
                <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:w-24">
                  {section.label}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {section.items.map((item) => {
                    const active = rrhhNavItemActivo(pathname, item);
                    const href = hrefRrhhConAlcance(item.href, alcance);
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                          active
                            ? alcance.mode === 'entidad'
                              ? 'border-pink-400/50 bg-pink-500/20 text-pink-50'
                              : 'border-amber-400/50 bg-amber-500/20 text-amber-50'
                            : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06] hover:text-white',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}
