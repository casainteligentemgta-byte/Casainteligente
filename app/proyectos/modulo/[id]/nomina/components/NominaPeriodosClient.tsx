'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { 
  CalendarDays, 
  FileText, 
  Plus, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Download 
} from 'lucide-react';

type NominaPeriodo = {
  id: string;
  numero_semana: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'borrador' | 'revisada' | 'aprobada' | 'pagada';
  tasa_bcv_aplicada: number;
};

type Props = {
  proyectoId: string;
  proyectoNombre: string;
};

export default function NominaPeriodosClient({ proyectoId, proyectoNombre }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [periodos, setPeriodos] = useState<NominaPeriodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ci_nomina_periodos')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('numero_semana', { ascending: false });
      
    if (error) {
      toast.error('Error cargando períodos: ' + error.message);
    } else {
      setPeriodos(data as NominaPeriodo[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [supabase, proyectoId]);

  const handleGenerar = async () => {
    // Para el MVP usamos un prompt simple. En el futuro, será un Modal de configuración.
    const week = prompt("Introduce el número de semana a generar (Ej: 42):");
    if (!week) return;
    
    const rate = prompt("Introduce la tasa BCV del día (Ej: 55.40):");
    if (!rate) return;

    setGenerando(true);
    const toastId = toast.loading('Calculando nómina y deducciones de ley...');

    try {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(monday.getDate() - monday.getDay() + 1);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);

      const res = await fetch('/api/rrhh/nomina/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyectoId,
          numeroSemana: parseInt(week),
          tasaBcv: parseFloat(rate),
          fechaInicio: monday.toISOString().split('T')[0],
          fechaFin: friday.toISOString().split('T')[0]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Nómina generada para ${data.totalObreros} obreros`, { id: toastId });
      void load();
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setGenerando(false);
    }
  };

  const badgeEstado = (estado: string) => {
    switch(estado) {
      case 'pagada':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Pagada</span>;
      case 'aprobada':
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20"><CheckCircle2 className="w-3 h-3" /> Aprobada</span>;
      case 'revisada':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3" /> Revisada</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-zinc-400 border border-zinc-500/20"><Clock className="w-3 h-3" /> Borrador</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-violet-400" />
            Nómina de Obra
          </h1>
          <p className="text-zinc-400 text-sm mt-1">{proyectoNombre}</p>
        </div>
        <button 
          onClick={handleGenerar}
          disabled={generando}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {generando ? 'Generando...' : 'Generar Período'}
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500">Cargando nóminas...</div>
      ) : periodos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-zinc-600 mb-4" />
          <h3 className="text-lg font-medium text-zinc-300">No hay nóminas registradas</h3>
          <p className="text-zinc-500 mt-2 max-w-sm mx-auto">
            Genera el primer período para comenzar a controlar asistencia y emitir recibos de pago.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {periodos.map(p => (
            <div key={p.id} className="group flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:bg-zinc-800/50">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-bold text-zinc-100">Semana {p.numero_semana}</h3>
                  {badgeEstado(p.estado)}
                </div>
                <div className="space-y-2 text-sm text-zinc-400">
                  <div className="flex justify-between">
                    <span>Inicio:</span>
                    <span className="text-zinc-300">{p.fecha_inicio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fin:</span>
                    <span className="text-zinc-300">{p.fecha_fin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tasa BCV:</span>
                    <span className="text-zinc-300">Bs {p.tasa_bcv_aplicada}</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-zinc-800/50 pt-4">
                <button className="text-zinc-400 hover:text-violet-400 transition-colors p-2" title="Descargar Recibos Lote">
                  <Download className="w-4 h-4" />
                </button>
                <button className="inline-flex items-center gap-1 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300">
                  Ver detalle <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
