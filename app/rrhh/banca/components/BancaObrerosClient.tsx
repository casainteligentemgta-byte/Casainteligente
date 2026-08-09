'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
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
  Check,
  X,
} from 'lucide-react';
import Link from 'next/link';
import {
  etiquetaEtapaPipeline,
  mensajeWhatsAppOfertaPlaza,
  puedeOfertarDesdeBanca,
} from '@/lib/rrhh/rrhhPipeline';
import { apiUrl } from '@/lib/http/apiUrl';
import type { OfertaPlazaRow } from '@/lib/rrhh/ofertasPlaza';

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
  const [ofertasByEmp, setOfertasByEmp] = useState<Map<string, OfertaPlazaRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstatus, setFiltroEstatus] = useState<string>('disponible');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ci_empleados')
      .select(
        'id, nombre_completo, documento, telefono, celular, cargo_nombre, rol_examen, estado, estatus, status_evaluacion, semaforo, estado_proceso',
      )
      .eq('rol_examen', 'obrero')
      .order('nombre_completo', { ascending: true });

    if (error) {
      toast.error('Error cargando la banca: ' + error.message);
      setEmpleados([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as EmpleadoBanca[];
    setEmpleados(list);

    const ids = list.map((e) => e.id);
    if (ids.length) {
      const { data: ofs, error: ofErr } = await supabase
        .from('ci_ofertas_plaza')
        .select('*')
        .in('empleado_id', ids)
        .in('estado', ['pendiente', 'aceptada'])
        .order('created_at', { ascending: false })
        .limit(500);
      if (!ofErr && ofs) {
        const map = new Map<string, OfertaPlazaRow>();
        for (const row of ofs as OfertaPlazaRow[]) {
          if (!map.has(row.empleado_id)) map.set(row.empleado_id, row);
        }
        setOfertasByEmp(map);
      } else if (ofErr && /ci_ofertas_plaza|schema cache|does not exist/i.test(ofErr.message)) {
        /* migración 319 pendiente */
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const ofertarWhatsApp = async (emp: EmpleadoBanca) => {
    const oficio =
      window.prompt(
        'Oficio del tabulador a ofertar (ej. Albañil de 1ra.)',
        (emp.cargo_nombre ?? '').trim() || '',
      ) ?? '';
    if (!oficio.trim()) {
      toast.error('Indique el oficio a ofertar.');
      return;
    }
    setBusyId(emp.id);
    try {
      const res = await fetch(apiUrl('/api/rrhh/ofertas-plaza'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: emp.id,
          oficio_nombre: oficio.trim(),
        }),
      });
      const j = (await res.json()) as { ok?: boolean; oferta?: OfertaPlazaRow; error?: string };
      if (!res.ok) throw new Error(j.error || 'No se pudo crear la oferta');

      if (j.oferta) {
        setOfertasByEmp((prev) => {
          const next = new Map(prev);
          next.set(emp.id, j.oferta!);
          return next;
        });
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
      toast.success('Oferta registrada. Complete el WhatsApp con el obrero.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al ofertar');
    } finally {
      setBusyId(null);
    }
  };

  const responder = async (empId: string, ofertaId: string, estado: 'aceptada' | 'rechazada') => {
    setBusyId(empId);
    try {
      const res = await fetch(apiUrl(`/api/rrhh/ofertas-plaza/${encodeURIComponent(ofertaId)}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error || 'No se pudo actualizar');
      toast.success(estado === 'aceptada' ? 'Plaza aceptada' : 'Oferta rechazada');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
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
            Oferte plaza (queda registrada) → el obrero acepta/rechaza → Gestión / Contrato → cargar
            firmado → carnet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/rrhh/gestion-personal"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-50 hover:border-amber-300/50"
          >
            Gestión (plazas)
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/rrhh/carnet"
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-50"
          >
            Carnet digital
          </Link>
        </div>
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
        <div className="space-y-3">
          {filtrados.map((emp) => {
            const oferta = ofertasByEmp.get(emp.id) ?? null;
            const ofertar = puedeOfertarDesdeBanca(emp) && (!oferta || oferta.estado !== 'pendiente');
            const pipelineInput = {
              ...emp,
              oferta_pendiente: oferta?.estado === 'pendiente',
              oferta_aceptada: oferta?.estado === 'aceptada',
            };
            return (
              <div
                key={emp.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-zinc-100">{emp.nombre_completo}</h3>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      CI: {emp.documento || '—'}
                      {emp.cargo_nombre ? ` · ${emp.cargo_nombre}` : ''}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {etiquetaEtapaPipeline(pipelineInput)}
                      {oferta ? ` · Oferta ${oferta.estado}: ${oferta.oficio_nombre}` : ''}
                    </p>
                  </div>
                  {badgeEstatus(emp.estatus)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800/60 pt-3">
                  {ofertar ? (
                    <button
                      type="button"
                      disabled={busyId === emp.id}
                      onClick={() => void ofertarWhatsApp(emp)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 disabled:opacity-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Ofertar plaza
                    </button>
                  ) : null}
                  {oferta?.estado === 'pendiente' ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === emp.id}
                        onClick={() => void responder(emp.id, oferta.id, 'aceptada')}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aceptó
                      </button>
                      <button
                        type="button"
                        disabled={busyId === emp.id}
                        onClick={() => void responder(emp.id, oferta.id, 'rechazada')}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200"
                      >
                        <X className="h-3.5 w-3.5" />
                        Rechazó
                      </button>
                    </>
                  ) : null}
                  {oferta?.estado === 'aceptada' ? (
                    <>
                      <Link
                        href="/rrhh/express"
                        className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-50"
                      >
                        Ir a contrato / firmado
                      </Link>
                      <Link
                        href={`/rrhh/carnet?empleado=${encodeURIComponent(emp.id)}`}
                        className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-100"
                      >
                        Carnet
                      </Link>
                    </>
                  ) : null}
                  <Link
                    href={`/rrhh/hojas-vida/archivo?q=${encodeURIComponent(emp.documento || emp.nombre_completo)}`}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                  >
                    Expediente
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
      )}
    </div>
  );
}
