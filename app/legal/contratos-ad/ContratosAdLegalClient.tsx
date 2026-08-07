'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  FileSignature,
  Loader2,
  Scale,
} from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import { useAccesoLegal } from '@/lib/legal/AccesoLegalContext';
import GenerarContratoDelegadoModal from '@/components/proyectos/GenerarContratoDelegadoModal';
import type { ContratoAdResumen } from '@/lib/proyectos/contratoAdministracionDelegada';

type ProyectoAdItem = {
  id: string;
  nombre: string;
  entidad_id: string | null;
  entidad_nombre: string | null;
  autorizado: boolean;
  contrato: ContratoAdResumen | null;
  created_at: string | null;
};

type Filtro = 'pendientes' | 'todos' | 'registrados';

export default function ContratosAdLegalClient() {
  const acceso = useAccesoLegal();
  const searchParams = useSearchParams();
  const proyectoQuery = searchParams?.get('proyectoId')?.trim() || '';

  const [items, setItems] = useState<ProyectoAdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const [modalProyectoId, setModalProyectoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/legal/contratos-ad'), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        proyectos?: ProyectoAdItem[];
        error?: string;
        code?: string;
      };
      if (res.status === 403) {
        setError(data.error || 'Sin acceso a Legal de la entidad.');
        setItems([]);
        return;
      }
      if (!res.ok) {
        setError(data.error || 'No se pudieron cargar los contratos AD.');
        setItems([]);
        return;
      }
      setItems(data.proyectos ?? []);
    } catch {
      setError('Error de red');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (acceso.loading || acceso.standalone) return;
    void cargar();
  }, [acceso.loading, acceso.standalone, cargar]);

  useEffect(() => {
    if (!proyectoQuery || loading || items.length === 0) return;
    const found = items.find((p) => p.id === proyectoQuery);
    if (found && !found.autorizado) {
      setModalProyectoId(found.id);
      setFiltro('todos');
    }
  }, [proyectoQuery, loading, items]);

  const visibles = useMemo(() => {
    if (filtro === 'pendientes') return items.filter((p) => !p.autorizado);
    if (filtro === 'registrados') return items.filter((p) => p.autorizado);
    return items;
  }, [items, filtro]);

  const pendientes = items.filter((p) => !p.autorizado).length;
  const modalProyecto = items.find((p) => p.id === modalProyectoId) ?? null;

  if (acceso.loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando acceso legal…
      </p>
    );
  }

  if (acceso.standalone) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-5 text-sm text-amber-100">
        <p className="font-semibold">Solo disponible en Legal de la entidad</p>
        <p className="mt-1 text-amber-200/80">
          Los contratos de administración delegada vinculan obras del CRM con la entidad
          ejecutora del grupo. Este módulo no aplica al plan solo-abogado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <Scale className="h-4 w-4" />
          Legal de la entidad
        </p>
        <h2 className="text-2xl font-bold text-white">Contratos de Administración Delegada</h2>
        <p className="max-w-2xl text-sm text-zinc-500">
          Genere el contrato AD por obra (entidad ejecutora + % de honorarios). Es el requisito
          legal del grupo para habilitar compras y despacho sin financiar la obra de bolsillo.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'pendientes' as const, label: `Pendientes (${pendientes})` },
            { id: 'todos' as const, label: `Todas (${items.length})` },
            {
              id: 'registrados' as const,
              label: `Registrados (${items.length - pendientes})`,
            },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={
              filtro === f.id
                ? 'rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100'
                : 'rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200'
            }
          >
            {f.label}
          </button>
        ))}
        <Link
          href="/configuracion/entidades"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
        >
          <Building2 className="h-3.5 w-3.5" />
          Entidades (patronos)
        </Link>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando obras…
        </p>
      ) : error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-5 text-sm text-emerald-100">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {filtro === 'pendientes'
              ? 'No hay obras pendientes de contrato AD.'
              : 'No hay obras en este filtro.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visibles.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{p.nombre}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {p.autorizado
                    ? `AD registrado${
                        p.contrato?.entidad?.nombre
                          ? ` · ${p.contrato.entidad.nombre}`
                          : ''
                      }${
                        p.contrato?.honorarios_admin_pct != null
                          ? ` · ${p.contrato.honorarios_admin_pct}%`
                          : ''
                      }`
                    : p.entidad_nombre
                      ? `Obra · patrono ficha: ${p.entidad_nombre}`
                      : 'Sin contrato AD — compras y despacho bloqueados'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/proyectos/modulo/${encodeURIComponent(p.id)}`}
                  className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/5"
                >
                  Ver obra
                </Link>
                {p.autorizado ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-950/35 px-3 py-2 text-xs font-bold text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Contrato AD ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModalProyectoId(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-2 text-xs font-black text-black"
                  >
                    <FileSignature className="h-3.5 w-3.5" />
                    Generar contrato AD
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalProyecto ? (
        <GenerarContratoDelegadoModal
          open
          onClose={() => setModalProyectoId(null)}
          proyectoId={modalProyecto.id}
          proyectoNombre={modalProyecto.nombre}
          onContratoGenerado={() => {
            setModalProyectoId(null);
            void cargar();
          }}
        />
      ) : null}
    </div>
  );
}
