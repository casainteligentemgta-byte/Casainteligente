'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

type TestRow = {
  id: string;
  empleado_id: string;
  tipo_test: string;
  resultado_general: string;
  fecha_aplicacion: string;
  puntaje: number | null;
  observaciones: string | null;
  evaluador: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  empleadoId: string | null;
  empleadoNombre: string | null;
  onClose: () => void;
};

export default function ModalTestsPsicologicos({ open, empleadoId, empleadoNombre, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Formulario nuevo test
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState('cleaver');
  const [resultado, setResultado] = useState('apto');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [puntaje, setPuntaje] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [evaluador, setEvaluador] = useState('');

  useEffect(() => {
    if (open && empleadoId) {
      cargarTests();
      setShowForm(false);
      resetForm();
    }
  }, [open, empleadoId]);

  const cargarTests = async () => {
    if (!empleadoId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('ci_postulantes_tests')
      .select('*')
      .eq('empleado_id', empleadoId)
      .order('fecha_aplicacion', { ascending: false });
    
    if (error) {
      // Ignorar si la tabla no existe aún (para que no rompa antes de la migración)
      if (!error.message.includes('does not exist')) {
        toast.error('Error al cargar tests: ' + error.message);
      }
      setTests([]);
    } else {
      setTests(data as TestRow[]);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTipo('cleaver');
    setResultado('apto');
    setFecha(new Date().toISOString().split('T')[0]);
    setPuntaje('');
    setObservaciones('');
    setEvaluador('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empleadoId) return;
    
    setSaving(true);
    const payload = {
      empleado_id: empleadoId,
      tipo_test: tipo,
      resultado_general: resultado,
      fecha_aplicacion: fecha,
      puntaje: puntaje ? Number(puntaje) : null,
      observaciones: observaciones.trim() || null,
      evaluador: evaluador.trim() || null,
    };

    const { error } = await supabase.from('ci_postulantes_tests').insert(payload);
    
    setSaving(false);
    if (error) {
      toast.error('Error al guardar: ' + error.message);
    } else {
      toast.success('Test registrado correctamente');
      setShowForm(false);
      resetForm();
      cargarTests();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este test?')) return;
    
    const { error } = await supabase.from('ci_postulantes_tests').delete().eq('id', id);
    if (error) {
      toast.error('Error al eliminar: ' + error.message);
    } else {
      toast.success('Test eliminado');
      cargarTests();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(val) => !val && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0A0A0F] p-6 shadow-2xl focus:outline-none max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between border-b border-white/10 pb-4">
            <div>
              <Dialog.Title className="text-xl font-bold text-white">
                Tests Psicológicos y Psicotécnicos
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-zinc-400">
                Expediente: <span className="font-semibold text-violet-300">{empleadoNombre || 'Sin nombre'}</span>
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-xl p-2 text-zinc-400 hover:bg-white/5 hover:text-white">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="mt-6">
            {!showForm ? (
              <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  <Plus className="h-4 w-4" />
                  Registrar Test
                </button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="mb-4 text-sm font-bold text-zinc-200">Nuevo Test Psicológico</h3>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-400">Tipo de Test</label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
                      required
                    >
                      <option value="cleaver">Cleaver</option>
                      <option value="machover">Machover</option>
                      <option value="wartegg">Wartegg</option>
                      <option value="disc">DISC</option>
                      <option value="raven">Test de Raven</option>
                      <option value="16pf">16 PF</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-400">Fecha de Aplicación</label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-400">Resultado General</label>
                    <select
                      value={resultado}
                      onChange={(e) => setResultado(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
                      required
                    >
                      <option value="apto">Apto</option>
                      <option value="apto_con_reservas">Apto con reservas</option>
                      <option value="no_apto">No apto</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-400">Puntaje (Opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={puntaje}
                      onChange={(e) => setPuntaje(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
                      placeholder="Ej. 85.50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-zinc-400">Evaluador (Analista/Psicólogo)</label>
                    <input
                      type="text"
                      value={evaluador}
                      onChange={(e) => setEvaluador(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
                      placeholder="Nombre del especialista"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-zinc-400">Observaciones</label>
                    <textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white"
                      rows={3}
                      placeholder="Conclusiones del perfil, áreas de mejora..."
                    />
                  </div>
                </div>
                
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Guardar Test
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : tests.length === 0 ? (
              <div className="rounded-xl border border-white/10 px-4 py-10 text-center text-zinc-500">
                No hay tests psicológicos registrados para este candidato.
              </div>
            ) : (
              <div className="space-y-3">
                {tests.map(t => (
                  <div key={t.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white uppercase">{t.tipo_test}</h4>
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                            t.resultado_general === 'apto' ? 'bg-emerald-500/20 text-emerald-300' :
                            t.resultado_general === 'apto_con_reservas' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-red-500/20 text-red-300'
                          }`}>
                            {t.resultado_general.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">
                          Aplicado el {new Date(t.fecha_aplicacion).toLocaleDateString('es-VE')} 
                          {t.evaluador && ` · Evaluador: ${t.evaluador}`}
                          {t.puntaje !== null && ` · Puntaje: ${t.puntaje}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-zinc-500 hover:text-red-400 p-1"
                        title="Eliminar test"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {t.observaciones && (
                      <div className="mt-3 rounded border border-white/5 bg-black/20 p-3 text-sm text-zinc-300">
                        {t.observaciones}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
