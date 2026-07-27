'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Play,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { apiUrl } from '@/lib/http/apiUrl';

type AuditoriaResultado = {
  id: string;
  estado_cumplimiento: string;
  hallazgos: string;
  recomendacion: string;
  ci_legal_obligaciones: {
    titulo: string;
    categoria: string;
  };
};

type Auditoria = {
  id: string;
  fecha: string;
  estado: string;
  puntaje: number | null;
  resumen_ejecutivo: string | null;
  resultados?: AuditoriaResultado[];
};

export default function CumplimientoLegalClient() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const supabase = createClient();

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ci_legal_auditorias')
        .select(`
          id, fecha, estado, puntaje, resumen_ejecutivo,
          resultados:ci_legal_auditoria_resultados(
            id, estado_cumplimiento, hallazgos, recomendacion,
            ci_legal_obligaciones(titulo, categoria)
          )
        `)
        .order('fecha', { ascending: false });

      if (error) {
        toast.error(error.message);
        return;
      }
      setAuditorias(data || []);
      if (data && data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch {
      toast.error('Error al cargar auditorías');
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function ejecutarAuditoria() {
    setRunning(true);
    toast.loading('El agente de IA está analizando los datos...');
    try {
      const res = await fetch(apiUrl('/api/legal/auditor'), {
        method: 'POST',
        credentials: 'include'
      });
      
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error ejecutando auditoría');
        return;
      }
      toast.success('Auditoría completada exitosamente');
      setSelectedId(data.auditoriaId);
      void cargar();
    } catch {
      toast.error('Error de red al ejecutar auditoría');
    } finally {
      setRunning(false);
      toast.dismiss();
    }
  }

  const selected = auditorias.find((a) => a.id === selectedId);

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'cumple': return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      case 'advertencia': return <AlertTriangle className="h-5 w-5 text-amber-400" />;
      case 'no_cumple': return <XCircle className="h-5 w-5 text-red-400" />;
      default: return <HelpCircle className="h-5 w-5 text-zinc-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm text-amber-200/80">
            <Activity className="h-4 w-4" />
            Auditoría · Informes
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">Cumplimiento Legal</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Agente IA que cruza las Obligaciones del Patrono con datos de Recursos Humanos.
          </p>
        </div>
        <button
          onClick={() => void ejecutarAuditoria()}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Analizando...' : 'Ejecutar Nueva Auditoría'}
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de Auditorías (Izquierda) */}
        <div className="space-y-3 lg:col-span-1">
          <h3 className="text-lg font-bold text-white">Historial de Informes</h3>
          {loading ? (
            <p className="text-zinc-500 text-sm">Cargando...</p>
          ) : auditorias.length === 0 ? (
            <p className="text-sm text-zinc-500">Aún no se han ejecutado auditorías.</p>
          ) : (
            <div className="space-y-2">
              {auditorias.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full text-left p-4 rounded-xl border transition ${
                    selectedId === a.id 
                      ? 'border-amber-500/50 bg-amber-500/10' 
                      : 'border-white/10 bg-[#0c1018] hover:bg-white/5'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-zinc-200">
                      {new Date(a.fecha).toLocaleDateString('es-VE')}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      a.puntaje && a.puntaje >= 80 ? 'bg-emerald-500/20 text-emerald-300' :
                      a.puntaje && a.puntaje >= 50 ? 'bg-amber-500/20 text-amber-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {a.puntaje}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2">
                    {a.resumen_ejecutivo || 'Sin resumen'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalle de Auditoría (Derecha) */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <>
              <div className="rounded-2xl border border-amber-500/20 bg-[#0c1018] p-6 shadow-lg shadow-black/50">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Informe de Cumplimiento
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      Fecha: {new Date(selected.fecha).toLocaleString('es-VE')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-amber-400">{selected.puntaje}%</div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mt-1">Puntaje Global</p>
                  </div>
                </div>
                
                <div className="mt-6 rounded-xl bg-white/[0.03] p-4 border border-white/5">
                  <h4 className="text-sm font-bold text-amber-200/90 mb-2">Resumen Ejecutivo del Agente</h4>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {selected.resumen_ejecutivo}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-lg font-bold text-white pl-1">Evaluación por Obligación</h4>
                
                {(selected.resultados || []).length === 0 ? (
                  <p className="text-sm text-zinc-500">No se guardaron detalles de obligaciones en esta auditoría.</p>
                ) : (
                  <div className="grid gap-3">
                    {selected.resultados?.map((res) => (
                      <div key={res.id} className="rounded-xl border border-white/10 bg-[#0c1018] p-4 flex gap-4">
                        <div className="pt-0.5">
                          <StatusIcon status={res.estado_cumplimiento} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2 mb-1">
                            <h5 className="font-bold text-zinc-100">{res.ci_legal_obligaciones?.titulo}</h5>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">
                              {res.ci_legal_obligaciones?.categoria}
                            </span>
                          </div>
                          
                          <p className="text-sm text-zinc-300 mt-2 mb-1">
                            <strong className="text-zinc-500 font-semibold text-xs uppercase tracking-wide">Hallazgo:</strong>{' '}
                            {res.hallazgos}
                          </p>
                          
                          {res.recomendacion && (
                            <p className="text-sm text-amber-200/80 mt-2 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                              <strong className="text-amber-500 font-semibold text-xs uppercase tracking-wide">Acción Recomendada:</strong>{' '}
                              {res.recomendacion}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-white/10">
              <p className="text-sm text-zinc-500">Selecciona un informe para ver sus detalles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}