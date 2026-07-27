'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Calculator, FileText, Plus, RefreshCw, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';

type PeriodoRow = {
  id: string;
  descripcion: string;
  tipo_nomina: 'semanal' | 'quincenal' | 'mensual' | 'especial';
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'borrador' | 'aprobada' | 'pagada' | 'cerrada';
  total_neto: number;
  created_at: string;
};

type EntidadRow = {
  id: string;
  razon_social: string;
};

export default function RrhhNominaHubClient() {
  const supabase = useMemo(() => createClient(), []);
  const [periodos, setPeriodos] = useState<PeriodoRow[]>([]);
  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulario nuevo periodo
  const [desc, setDesc] = useState('');
  const [tipo, setTipo] = useState<'semanal' | 'quincenal' | 'mensual' | 'especial'>('quincenal');
  const [fechaIni, setFechaIni] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [entidadId, setEntidadId] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    const pRes = await supabase
      .from('ci_nomina_periodos')
      .select('*')
      .order('created_at', { ascending: false });

    if (!pRes.error && pRes.data) {
      setPeriodos(pRes.data as PeriodoRow[]);
    }

    const eRes = await supabase
      .from('ci_entidades')
      .select('id, razon_social')
      .eq('es_patrono', true)
      .order('razon_social');

    if (!eRes.error && eRes.data) {
      setEntidades(eRes.data as EntidadRow[]);
      if (eRes.data.length > 0) {
        setEntidadId(eRes.data[0].id);
      }
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !fechaIni || !fechaFin || !entidadId) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    setSaving(true);
    const { error, data } = await supabase.from('ci_nomina_periodos').insert({
      descripcion: desc.trim(),
      tipo_nomina: tipo,
      fecha_inicio: fechaIni,
      fecha_fin: fechaFin,
      entidad_id: entidadId,
    }).select('id').single();

    setSaving(false);

    if (error) {
      toast.error('Error al crear: ' + error.message);
    } else {
      toast.success('Periodo creado. Procedamos a calcular.');
      setShowModal(false);
      void cargar();
      // Opcional: Redirigir directamente al procesador
      // router.push(`/rrhh/nomina/procesar?id=${data.id}`);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'borrador': return 'border-amber-500/30 bg-amber-950/20 text-amber-300';
      case 'aprobada': return 'border-sky-500/30 bg-sky-950/20 text-sky-300';
      case 'pagada': return 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300';
      case 'cerrada': return 'border-zinc-500/30 bg-zinc-950/20 text-zinc-300';
      default: return 'border-zinc-500/30 bg-zinc-950/20 text-zinc-300';
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8">
      <header className="mb-8">
        <Link
          href="/rrhh"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Volver a RRHH
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Nómina</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Procesamiento de pagos, recibos, asignaciones y retenciones.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void cargar()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
              Nuevo Periodo
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-zinc-500">Cargando nóminas...</div>
      ) : periodos.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <Calculator className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <p className="text-zinc-400">No hay periodos de nómina creados aún.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {periodos.map(p => (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-black/40 p-5 hover:border-sky-500/30 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-white">{p.descripcion}</h3>
                <span className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${getEstadoColor(p.estado)}`}>
                  {p.estado}
                </span>
              </div>
              
              <div className="space-y-1 mb-4">
                <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">{p.tipo_nomina}</p>
                <p className="text-sm text-zinc-300">
                  {new Date(p.fecha_inicio).toLocaleDateString('es-VE')} - {new Date(p.fecha_fin).toLocaleDateString('es-VE')}
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  Total Neto: <strong className="text-emerald-400 text-sm">${Number(p.total_neto).toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/rrhh/nomina/procesar?id=${p.id}`}
                  className="flex-1 inline-flex justify-center items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  {p.estado === 'borrador' ? 'Procesar' : 'Ver Detalles'}
                </Link>
                {p.estado !== 'borrador' && (
                  <button title="Descargar Recibos (PDF)" className="inline-flex justify-center items-center rounded-lg border border-white/10 px-3 py-2 text-zinc-400 hover:text-white hover:bg-white/5">
                    <FileText className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo Periodo */}
      <Dialog.Root open={showModal} onOpenChange={setShowModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0A0A0F] p-6 shadow-2xl focus:outline-none">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <Dialog.Title className="text-xl font-bold text-white">Nuevo Periodo de Nómina</Dialog.Title>
              <Dialog.Close className="rounded-xl p-2 text-zinc-400 hover:bg-white/5 hover:text-white">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-400">Entidad (Patrono)</label>
                <select
                  value={entidadId}
                  onChange={(e) => setEntidadId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white"
                  required
                >
                  <option value="" disabled>Seleccione una empresa...</option>
                  {entidades.map(e => (
                    <option key={e.id} value={e.id}>{e.razon_social}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-zinc-400">Descripción</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white"
                  placeholder="Ej. Primera Quincena Octubre 2026"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-zinc-400">Tipo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="quincenal">Quincenal (Empleados)</option>
                    <option value="semanal">Semanal (Obreros)</option>
                    <option value="mensual">Mensual</option>
                    <option value="especial">Especial (Bonos/Utilidades)</option>
                  </select>
                </div>
                <div></div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-zinc-400">Fecha Inicio</label>
                  <input
                    type="date"
                    value={fechaIni}
                    onChange={(e) => setFechaIni(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-zinc-400">Fecha Fin</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white"
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
                <Dialog.Close className="rounded-xl px-4 py-2 font-semibold text-zinc-400 hover:bg-white/5">
                  Cancelar
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center rounded-xl bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {saving ? 'Creando...' : 'Crear Periodo'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}