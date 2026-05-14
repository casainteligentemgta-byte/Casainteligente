'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContratosExpressListaTalento } from './fast-list/ContratosExpressListaTalento';
import { FileText, PlusCircle, List, Settings2 } from 'lucide-react';

type Emp = { id: string; nombre_completo: string; estado: string };

export default function ContratosAdminPage() {
  const supabase = createClient();
  const [empleados, setEmpleados] = useState<Emp[]>([]);
  const [empId, setEmpId] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [tipoPlazo, setTipoPlazo] = useState<'DETERMINADO' | 'INDETERMINADO'>('INDETERMINADO');
  const [jornada, setJornada] = useState<'DIURNA' | 'NOCTURNA' | 'MIXTA'>('DIURNA');
  const [texto, setTexto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = true;
    (async () => {
      const e = await supabase.from('ci_empleados').select('id,nombre_completo,estado').eq('estado', 'aprobado').order('nombre_completo');
      if (!c) return;
      if (!e.error && e.data) setEmpleados(e.data as Emp[]);
      setLoading(false);
    })();
    return () => {
      c = false;
    };
  }, [supabase]);

  async function generar() {
    setErr(null);
    setTexto(null);
    setSaving(true);
    try {
      const res = await fetch('/api/talento/contratos/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empId,
          fecha_ingreso: fechaIngreso,
          tipoPlazo,
          jornada_trabajo: jornada,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Error');
        return;
      }
      setTexto((data.contrato as string) ?? null);
    } catch {
      setErr('Error de red');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 pb-28">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3 text-xs">
            <Link href="/talento" className="text-zinc-500 hover:text-zinc-300 transition-colors">
              ← Panel de Talento
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-300 font-medium">Contratos</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Contratos</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/talento/admin/documentos">
            <button className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
              <Settings2 className="size-3.5" />
              Configurar Documentos
            </button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="express-list" className="space-y-8">
        <TabsList className="bg-zinc-900/50 border border-white/5 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto flex justify-start sm:justify-center">
          <TabsTrigger value="express-list" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-bold transition-all">
            <List className="size-4 mr-2" />
            Contratos Express
          </TabsTrigger>
          <TabsTrigger value="dynamic-create" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-violet-600 data-[state=active]:text-white font-bold transition-all">
            <PlusCircle className="size-4 mr-2" />
            Generar Dinámico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="express-list" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Listado Fast-Track</h2>
                <p className="text-sm text-zinc-500">Registros directos sin expediente previo en Talento.</p>
              </div>
              <Link href="/talento/admin/contratos/fast-create">
                <button className="bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all">
                  + Nuevo Express
                </button>
              </Link>
            </div>
            <ContratosExpressListaTalento />
          </div>
        </TabsContent>

        <TabsContent value="dynamic-create" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-3xl backdrop-blur-xl">
                <h2 className="text-xl font-bold text-white mb-2">Nuevo Contrato Dinámico</h2>
                <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
                  Genera contratos legales parametrizables para empleados que ya superaron el proceso de evaluación y están <strong className="text-emerald-400">aprobados</strong>.
                </p>

                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="size-8 border-2 border-zinc-800 border-t-violet-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 ml-1">Empleado Aprobado</label>
                      <select
                        className="w-full rounded-2xl bg-black/40 border border-zinc-800 px-4 py-3.5 text-white text-sm focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all outline-none appearance-none"
                        value={empId}
                        onChange={(e) => setEmpId(e.target.value)}
                      >
                        <option value="">Selecciona un colaborador…</option>
                        {empleados.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nombre_completo}
                          </option>
                        ))}
                      </select>
                      {empleados.length === 0 && (
                        <div className="mt-3 bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
                          <p className="text-xs text-amber-500 leading-relaxed font-medium">
                            No hay empleados disponibles para contratación. Deben completar su examen y obtener estatus "Aprobado".
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 ml-1">Fecha Ingreso</label>
                        <input
                          type="date"
                          className="w-full rounded-2xl bg-black/40 border border-zinc-800 px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all outline-none [color-scheme:dark]"
                          value={fechaIngreso}
                          onChange={(e) => setFechaIngreso(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 ml-1">Jornada</label>
                        <select
                          className="w-full rounded-2xl bg-black/40 border border-zinc-800 px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all outline-none"
                          value={jornada}
                          onChange={(e) => setJornada(e.target.value as any)}
                        >
                          <option value="DIURNA">Diurna (8h)</option>
                          <option value="MIXTA">Mixta</option>
                          <option value="NOCTURNA">Nocturna</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2 ml-1">Tipo de Plazo</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setTipoPlazo('INDETERMINADO')}
                          className={`py-3 rounded-2xl border text-xs font-bold transition-all ${tipoPlazo === 'INDETERMINADO' ? 'bg-violet-500/10 border-violet-500 text-violet-400' : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                        >
                          Indeterminado
                        </button>
                        <button
                          onClick={() => setTipoPlazo('DETERMINADO')}
                          className={`py-3 rounded-2xl border text-xs font-bold transition-all ${tipoPlazo === 'DETERMINADO' ? 'bg-violet-500/10 border-violet-500 text-violet-400' : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                        >
                          Determinado
                        </button>
                      </div>
                    </div>

                    {err && (
                      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
                        <p className="text-xs text-red-400 font-medium">{err}</p>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={saving || !empId}
                      onClick={() => void generar()}
                      className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white font-black text-sm shadow-xl shadow-violet-900/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <FileText className="size-4" />
                          Generar y Guardar Contrato
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              {texto ? (
                <div className="sticky top-4 bg-black/60 border border-white/5 rounded-3xl p-8 backdrop-blur-3xl h-[600px] flex flex-col shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xs uppercase tracking-widest font-black text-violet-400">Vista Previa Legal</h2>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Listo para firmar</Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                    <pre className="text-[13px] text-zinc-300 whitespace-pre-wrap font-serif leading-relaxed italic">
                      {texto}
                    </pre>
                  </div>
                  <div className="mt-6 pt-6 border-t border-white/5 flex gap-3">
                    <button className="flex-1 bg-white text-black h-12 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-colors">
                      Descargar PDF
                    </button>
                    <button className="flex-1 bg-zinc-800 text-white h-12 rounded-xl font-bold text-sm hover:bg-zinc-700 transition-colors">
                      Enviar a Firma
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl text-center p-10 bg-zinc-950/20">
                  <div className="size-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6 border border-white/5 shadow-inner">
                    <FileText className="size-8 text-zinc-700" />
                  </div>
                  <h3 className="text-white font-bold mb-2">Vista Previa</h3>
                  <p className="text-sm text-zinc-500 max-w-[200px]">Completa los datos a la izquierda para visualizar el documento legal.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
