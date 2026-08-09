'use client';

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Clock,
  Briefcase,
  MessageCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import {
  etiquetaEtapaPipeline,
  mensajeWhatsAppOfertaPlaza,
  puedeOfertarDesdeBanca,
} from '@/lib/rrhh/rrhhPipeline';

type EmpleadoBanca = {
  id: string;
  nombre_completo: string;
  documento: string | null;
  telefono: string | null;
  celular?: string | null;
  cargo_nombre?: string | null;
  rol_examen?: string | null;
  estado?: string | null;
  estatus: 'disponible' | 'asignado' | 'no_disponible' | 'vetado' | null;
  evaluacion_psico_status: 'pendiente' | 'aprobada' | 'rechazada' | 'no_requerida' | null;
  evaluacion_psico_fecha: string | null;
  status_evaluacion?: string | null;
  semaforo?: string | null;
  estado_proceso?: string | null;
};

function telWa(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  if (d.startsWith('58')) return d;
  if (d.startsWith('0') && d.length >= 11) return `58${d.slice(1)}`;
  if (d.length === 10) return `58${d}`;
  return d;
}

export default function BancaObrerosClient() {
  const supabase = useMemo(() => createClient(), []);
  const [empleados, setEmpleados] = useState<EmpleadoBanca[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstatus, setFiltroEstatus] = useState<string>('disponible');

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('ci_empleados')
        .select(
          'id, nombre_completo, documento, telefono, celular, cargo_nombre, rol_examen, estado, estatus, evaluacion_psico_status, evaluacion_psico_fecha, status_evaluacion, semaforo, estado_proceso',
        )
        .eq('rol_examen', 'obrero')
        .order('nombre_completo', { ascending: true });

      if (!alive) return;

      if (error) {
        toast.error('Error cargando la banca: ' + error.message);
      } else {
        setEmpleados((data ?? []) as EmpleadoBanca[]);
      }
      setLoading(false);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const filtrados = useMemo(() => {
    return empleados.filter((e) => {
      const matchSearch =
        e.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
        (e.documento || '').includes(search);
      const matchEstatus =
        filterEstatus === 'todos' || (e.estatus || 'no_disponible') === filterEstatus;
      return matchSearch && matchEstatus;
    });
  }, [empleados, search, filterEstatus]);

  const badgeEstatus = (estatus: string | null) => {
    switch (estatus) {
      case 'disponible':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            <UserCheck className="h-3 w-3" /> Disponible
          </span>
        );
      case 'asignado':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
            <Briefcase className="h-3 w-3" /> En obra
          </span>
        );
      case 'vetado':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400">
            <UserX className="h-3 w-3" /> Vetado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
            <Clock className="h-3 w-3" /> No disponible
          </span>
        );
    }
  };

  const ofertarWhatsApp = (emp: EmpleadoBanca) => {
    const oficio =
      window.prompt(
        'Oficio del tabulador a ofertar (ej. Albañil de 1ra.)',
        (emp.cargo_nombre ?? '').trim() || '',
      ) ?? '';
    if (!oficio.trim()) {
      toast.error('Indique el oficio a ofertar.');
      return;
    }
    const text = mensajeWhatsAppOfertaPlaza({
      nombreObrero: emp.nombre_completo,
      oficio: oficio.trim(),
    });
    const phone = telWa(emp.celular) || telWa(emp.telefono);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
            <Users className="h-6 w-6 text-violet-400" />
            Banca de obreros
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Puerta banca del flujo unificado: oferte plaza (WhatsApp SÍ/NO) y continúe en Gestión /
            Evaluación / Contrato.
          </p>
        </div>
        <Link
          href="/rrhh/gestion-personal"
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-50 hover:border-amber-300/50"
        >
          Ir a Gestión (plazas)
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-4 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <select
          value={filterEstatus}
          onChange={(e) => setFiltroEstatus(e.target.value)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="todos">Todos los estados</option>
          <option value="disponible">Disponibles en banca</option>
          <option value="asignado">Actualmente en obra</option>
          <option value="vetado">Vetados / no recontratar</option>
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500">Cargando talento…</div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50 md:block">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Trabajador</th>
                  <th className="px-6 py-4 font-medium">Oficio</th>
                  <th className="px-6 py-4 font-medium">Teléfono</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium">Etapa flujo</th>
                  <th className="px-6 py-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtrados.map((emp) => {
                  const etapa = etiquetaEtapaPipeline(emp);
                  const ofertar = puedeOfertarDesdeBanca(emp);
                  return (
                    <tr key={emp.id} className="transition-colors hover:bg-zinc-800/50">
                      <td className="px-6 py-4 font-medium text-zinc-100">
                        {emp.nombre_completo}
                        <p className="text-xs font-normal text-zinc-500">
                          {emp.documento || '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">{emp.cargo_nombre || '—'}</td>
                      <td className="px-6 py-4">{emp.celular || emp.telefono || '—'}</td>
                      <td className="px-6 py-4">{badgeEstatus(emp.estatus)}</td>
                      <td className="px-6 py-4 text-xs text-zinc-400">{etapa}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {ofertar ? (
                            <button
                              type="button"
                              onClick={() => ofertarWhatsApp(emp)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Ofertar plaza
                            </button>
                          ) : null}
                          <Link
                            href={`/rrhh/hojas-vida/archivo?q=${encodeURIComponent(emp.documento || emp.nombre_completo)}`}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-400/10"
                          >
                            Expediente
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      No se encontraron obreros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 md:hidden">
            {filtrados.map((emp) => {
              const ofertar = puedeOfertarDesdeBanca(emp);
              return (
                <div
                  key={emp.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-zinc-100">{emp.nombre_completo}</h3>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        CI: {emp.documento || '—'}
                        {emp.cargo_nombre ? ` · ${emp.cargo_nombre}` : ''}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">{etiquetaEtapaPipeline(emp)}</p>
                    </div>
                    {badgeEstatus(emp.estatus)}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-zinc-800/50 pt-3">
                    {ofertar ? (
                      <button
                        type="button"
                        onClick={() => ofertarWhatsApp(emp)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Ofertar plaza
                      </button>
                    ) : null}
                    <Link
                      href={`/rrhh/gestion-personal`}
                      className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100"
                    >
                      Ver plazas
                    </Link>
                  </div>
                </div>
              );
            })}
            {filtrados.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-zinc-500">
                No se encontraron obreros.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
