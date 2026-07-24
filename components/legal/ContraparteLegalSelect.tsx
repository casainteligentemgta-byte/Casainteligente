'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';

type ProyectoOpt = { id: string; nombre: string; entidad_id?: string | null };

type TrabajadorOpt = {
  key: string;
  empleadoId: string | null;
  nombre: string;
  cedula: string | null;
  oficio: string | null;
};

export type ContraparteLegalValue = {
  proyectoId: string;
  entidadId: string | null;
  empleadoId: string | null;
  nombre: string;
  cedula: string | null;
  modo: 'nomina' | 'manual';
};

type Props = {
  value: ContraparteLegalValue;
  onChange: (next: ContraparteLegalValue) => void;
  className?: string;
  /** Si false, solo texto libre (p. ej. plan abogado standalone). */
  permitirObra?: boolean;
};

const empty: ContraparteLegalValue = {
  proyectoId: '',
  entidadId: null,
  empleadoId: null,
  nombre: '',
  cedula: null,
  modo: 'manual',
};

function uniqueTrabajadores(rows: TrabajadorOpt[]): TrabajadorOpt[] {
  const seen = new Set<string>();
  const out: TrabajadorOpt[] = [];
  for (const r of rows) {
    const dedupe = (r.empleadoId || r.nombre).toLowerCase();
    if (!dedupe || seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(r);
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export default function ContraparteLegalSelect({
  value,
  onChange,
  className,
  permitirObra = true,
}: Props) {
  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [loadingProyectos, setLoadingProyectos] = useState(permitirObra);
  const [trabajadores, setTrabajadores] = useState<TrabajadorOpt[]>([]);
  const [loadingNomina, setLoadingNomina] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!permitirObra) {
      setLoadingProyectos(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingProyectos(true);
      try {
        const res = await fetch(apiUrl('/api/almacen/proyectos'), { cache: 'no-store' });
        const data = (await res.json()) as {
          proyectos?: ProyectoOpt[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setProyectos([]);
          setHint(data.error || 'No se pudieron cargar las obras');
          return;
        }
        setProyectos(data.proyectos ?? []);
        setHint(null);
      } catch {
        if (!cancelled) {
          setProyectos([]);
          setHint('Error de red al cargar obras');
        }
      } finally {
        if (!cancelled) setLoadingProyectos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permitirObra]);

  useEffect(() => {
    if (!permitirObra || !value.proyectoId) {
      setTrabajadores([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingNomina(true);
      setHint(null);
      try {
        const [nominaRes, egresoRes] = await Promise.all([
          fetch(apiUrl(`/api/proyectos/${encodeURIComponent(value.proyectoId)}/nomina`), {
            cache: 'no-store',
            credentials: 'include',
          }),
          fetch(
            apiUrl(
              `/api/almacen/empleados-egreso?proyecto_id=${encodeURIComponent(value.proyectoId)}`,
            ),
            { cache: 'no-store', credentials: 'include' },
          ),
        ]);

        const nominaJson = (await nominaRes.json()) as {
          filas?: Array<{
            id: string;
            empleado_id: string | null;
            nombre_display: string;
            cedula: string | null;
            cargo_nombre: string | null;
            activo: boolean;
          }>;
          error?: string;
        };
        const egresoJson = (await egresoRes.json()) as {
          empleados?: Array<{
            id: string;
            nombre_completo: string;
            oficio: string | null;
          }>;
          error?: string;
        };

        if (cancelled) return;

        const fromNomina: TrabajadorOpt[] = (nominaJson.filas ?? [])
          .filter((f) => f.activo !== false)
          .map((f) => ({
            key: `nomina:${f.id}`,
            empleadoId: f.empleado_id,
            nombre: (f.nombre_display || 'Sin nombre').trim() || 'Sin nombre',
            cedula: f.cedula,
            oficio: f.cargo_nombre,
          }));

        const fromEgreso: TrabajadorOpt[] = (egresoJson.empleados ?? []).map((e) => ({
          key: `emp:${e.id}`,
          empleadoId: e.id,
          nombre: (e.nombre_completo || 'Sin nombre').trim() || 'Sin nombre',
          cedula: null,
          oficio: e.oficio,
        }));

        const merged = uniqueTrabajadores([...fromNomina, ...fromEgreso]);
        setTrabajadores(merged);
        if (merged.length === 0) {
          setHint(
            nominaJson.error ||
              egresoJson.error ||
              'Sin trabajadores en la nómina de esta obra. Puede escribir el nombre manualmente.',
          );
        }
      } catch {
        if (!cancelled) {
          setTrabajadores([]);
          setHint('No se pudo cargar la nómina de la obra');
        }
      } finally {
        if (!cancelled) setLoadingNomina(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permitirObra, value.proyectoId]);

  const filtrados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return trabajadores;
    return trabajadores.filter(
      (t) =>
        t.nombre.toLowerCase().includes(needle) ||
        (t.cedula ?? '').toLowerCase().includes(needle) ||
        (t.oficio ?? '').toLowerCase().includes(needle),
    );
  }, [trabajadores, q]);

  if (!permitirObra) {
    return (
      <div>
        <label className="text-xs font-semibold uppercase text-zinc-500">Contraparte</label>
        <input
          className={className}
          value={value.nombre}
          onChange={(e) =>
            onChange({
              ...empty,
              modo: 'manual',
              nombre: e.target.value,
            })
          }
          placeholder="Nombre de la contraparte"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Contraparte
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              value.modo === 'nomina'
                ? 'bg-amber-500/15 text-amber-100'
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
            }`}
            onClick={() =>
              onChange({
                ...value,
                modo: 'nomina',
                nombre: '',
                cedula: null,
                empleadoId: null,
              })
            }
          >
            Nómina de la obra
          </button>
          <button
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              value.modo === 'manual'
                ? 'bg-amber-500/15 text-amber-100'
                : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
            }`}
            onClick={() =>
              onChange({
                ...value,
                modo: 'manual',
                empleadoId: null,
                cedula: null,
              })
            }
          >
            Texto libre
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase text-zinc-500">Obra</label>
        <select
          className={className}
          value={value.proyectoId}
          disabled={loadingProyectos}
          onChange={(e) => {
            const id = e.target.value;
            const p = proyectos.find((x) => x.id === id);
            onChange({
              ...value,
              proyectoId: id,
              entidadId: p?.entidad_id ?? null,
              empleadoId: null,
              nombre: value.modo === 'manual' ? value.nombre : '',
              cedula: null,
              modo: id ? value.modo : 'manual',
            });
          }}
        >
          <option value="">
            {loadingProyectos ? 'Cargando obras…' : 'Seleccionar obra'}
          </option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {value.modo === 'nomina' ? (
        <>
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              Buscar trabajador
            </label>
            <input
              type="search"
              className={className}
              value={q}
              disabled={!value.proyectoId || loadingNomina}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, cédula u oficio…"
            />
          </div>
          <div className="relative">
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              Trabajador de la nómina
            </label>
            <select
              className={className}
              value={value.empleadoId || (value.nombre ? `nombre:${value.nombre}` : '')}
              disabled={!value.proyectoId || loadingNomina}
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw) {
                  onChange({
                    ...value,
                    empleadoId: null,
                    nombre: '',
                    cedula: null,
                  });
                  return;
                }
                const t =
                  trabajadores.find((x) => x.empleadoId === raw) ||
                  trabajadores.find((x) => x.key === raw) ||
                  trabajadores.find((x) => `nombre:${x.nombre}` === raw);
                if (!t) return;
                onChange({
                  ...value,
                  modo: 'nomina',
                  empleadoId: t.empleadoId,
                  nombre: t.nombre,
                  cedula: t.cedula,
                });
              }}
            >
              <option value="">
                {!value.proyectoId
                  ? 'Elija una obra primero'
                  : loadingNomina
                    ? 'Cargando nómina…'
                    : 'Seleccionar trabajador'}
              </option>
              {filtrados.map((t) => (
                <option key={t.key} value={t.empleadoId || `nombre:${t.nombre}`}>
                  {t.nombre}
                  {t.cedula ? ` · CI ${t.cedula}` : ''}
                  {t.oficio ? ` · ${t.oficio}` : ''}
                </option>
              ))}
            </select>
            {loadingNomina ? (
              <Loader2 className="pointer-events-none absolute right-3 top-8 h-4 w-4 animate-spin text-zinc-500" />
            ) : null}
          </div>
        </>
      ) : (
        <div>
          <label className="text-[10px] font-semibold uppercase text-zinc-500">
            Nombre de la contraparte
          </label>
          <input
            className={className}
            value={value.nombre}
            onChange={(e) =>
              onChange({
                ...value,
                modo: 'manual',
                nombre: e.target.value,
                empleadoId: null,
                cedula: null,
              })
            }
            placeholder="Nombre completo"
          />
        </div>
      )}

      {hint ? <p className="text-[11px] text-amber-200/80">{hint}</p> : null}
    </div>
  );
}

export function contraparteLegalVacia(): ContraparteLegalValue {
  return { ...empty };
}
