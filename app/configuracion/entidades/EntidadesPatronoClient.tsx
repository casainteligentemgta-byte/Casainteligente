'use client';

import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { CiEntidad } from '@/types/ci-entidad';
import FormularioEntidad from './FormularioEntidad';

const SELECT_ENTIDADES =
  'id,nombre,nombre_comercial,rif,direccion_fiscal,rep_legal_nombre,rep_legal_cedula,rep_legal_cargo,registro_mercantil,permisologia,logo_url,sello_url,notas,created_at,updated_at';

export default function EntidadesPatronoClient() {
  const supabase = useMemo(() => createClient(), []);
  const [filas, setFilas] = useState<CiEntidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CiEntidad | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const full = await supabase.from('ci_entidades').select(SELECT_ENTIDADES).order('nombre');

    if (full.error) {
      const msg = full.error.message ?? '';
      const schemaMismatch =
        msg.toLowerCase().includes('column') || msg.includes('schema cache');
      if (schemaMismatch) {
        const minimal = await supabase
          .from('ci_entidades')
          .select('id,nombre,rif,notas,created_at,updated_at')
          .order('nombre');
        if (minimal.error) {
          const m = minimal.error.message ?? 'Error al cargar entidades.';
          setError(`${m}${m.toLowerCase().includes('relation') ? ' — Ejecuta migración 063 (ci_entidades).' : ''}`);
          setFilas([]);
        } else {
          setFilas((minimal.data ?? []) as CiEntidad[]);
          setError(null);
        }
      } else {
        setError(
          `${msg}${msg.toLowerCase().includes('relation') ? ' — Ejecuta migración 063 (ci_entidades).' : ''}`,
        );
        setFilas([]);
      }
    } else {
      setFilas((full.data ?? []) as CiEntidad[]);
      setError(null);
    }
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function borrar(row: CiEntidad) {
    if (!window.confirm(`¿Eliminar la entidad «${row.nombre}»? No se puede deshacer.`)) return;
    setBorrandoId(row.id);
    const { error: delErr } = await supabase.from('ci_entidades').delete().eq('id', row.id);
    setBorrandoId(null);
    if (delErr) {
      toast.error(delErr.message ?? 'No se pudo eliminar (puede estar vinculada a un proyecto).');
      return;
    }
    toast.success('Entidad eliminada.');
    void cargar();
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-28 pt-4 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-xs font-semibold text-sky-400/90 hover:text-sky-300">
              ← Inicio
            </Link>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF9500]/35 bg-[#FF9500]/10 backdrop-blur-xl">
                <Building2 className="h-6 w-6 text-[#FFD60A]" aria-hidden />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Patronos / entidades legales</h1>
                <p className="mt-1 max-w-xl text-sm text-zinc-500">
                  Gestión centralizada para contratos de obreros y planillas. RIF, representante, registro mercantil y
                  permisología.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditando(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-900/25 transition hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            Nueva entidad
          </button>
        </div>

        {cargando ? (
          <p className="text-sm text-zinc-500">Cargando entidades…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200 backdrop-blur-xl">
            {error}
          </div>
        ) : filas.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-10 text-center backdrop-blur-xl">
            <p className="text-sm text-zinc-400">No hay entidades registradas.</p>
            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setFormOpen(true);
              }}
              className="mt-4 text-sm font-semibold text-[#FFD60A] underline hover:text-[#FF9500]"
            >
              Crear la primera
            </button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {filas.map((row) => (
              <li
                key={row.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl transition hover:border-[#FF9500]/25"
              >
                <div className="flex gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                    {row.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.logo_url}
                        alt=""
                        className="h-full w-full object-contain p-1"
                        onError={(ev) => {
                          (ev.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-600">
                        <Building2 className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-white">{row.nombre}</p>
                    {row.nombre_comercial?.trim() ? (
                      <p className="truncate text-xs text-zinc-500">{row.nombre_comercial}</p>
                    ) : null}
                    <p className="mt-1 font-mono text-sm text-[#FFD60A]/90">{row.rif?.trim() || '— sin RIF —'}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(row);
                      setFormOpen(true);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 sm:flex-none"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={borrandoId === row.id}
                    onClick={() => void borrar(row)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/35 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-950/50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {borrandoId === row.id ? '…' : 'Eliminar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FormularioEntidad
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditando(null);
        }}
        entidad={editando}
        onGuardado={() => void cargar()}
      />
    </div>
  );
}
