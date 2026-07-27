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
  MoreVertical,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';

type EmpleadoBanca = {
  id: string;
  nombre_completo: string;
  documento: string | null;
  telefono: string | null;
  estatus: 'disponible' | 'asignado' | 'no_disponible' | 'vetado' | null;
  evaluacion_psico_status: 'pendiente' | 'aprobada' | 'rechazada' | 'no_requerida';
  evaluacion_psico_fecha: string | null;
};

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
        .select('id, nombre_completo, documento, telefono, estatus, evaluacion_psico_status, evaluacion_psico_fecha')
        .eq('rol_examen', 'obrero')
        .order('nombre_completo', { ascending: true });
        
      if (!alive) return;
      
      if (error) {
        toast.error('Error cargando la banca: ' + error.message);
      } else {
        setEmpleados(data as EmpleadoBanca[]);
      }
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, [supabase]);

  const filtrados = useMemo(() => {
    return empleados.filter(e => {
      const matchSearch = e.nombre_completo.toLowerCase().includes(search.toLowerCase()) || 
                          (e.documento || '').includes(search);
      const matchEstatus = filterEstatus === 'todos' || (e.estatus || 'no_disponible') === filterEstatus;
      return matchSearch && matchEstatus;
    });
  }, [empleados, search, filterEstatus]);

  const badgeEstatus = (estatus: string | null) => {
    switch (estatus) {
      case 'disponible':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20"><UserCheck className="w-3 h-3" /> Disponible</span>;
      case 'asignado':
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20"><Briefcase className="w-3 h-3" /> En Obra</span>;
      case 'vetado':
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20"><UserX className="w-3 h-3" /> Vetado</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-zinc-400 border border-zinc-500/20"><Clock className="w-3 h-3" /> No Disponible</span>;
    }
  };

  const badgePsico = (status: string) => {
    switch (status) {
      case 'aprobada':
        return <span className="text-emerald-400 text-xs">Aprobada</span>;
      case 'rechazada':
        return <span className="text-rose-400 text-xs">Rechazada</span>;
      case 'no_requerida':
        return <span className="text-zinc-400 text-xs">N/A</span>;
      default:
        return <span className="text-amber-400 text-xs">Pendiente</span>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-400" />
            Banca de Obreros
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Pool de talento disponible para asignación rápida a obras.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o cédula..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
          />
        </div>
        <select 
          value={filterEstatus}
          onChange={(e) => setFiltroEstatus(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
        >
          <option value="todos">Todos los estados</option>
          <option value="disponible">Disponibles en Banca</option>
          <option value="asignado">Actualmente en Obra</option>
          <option value="vetado">Vetados / No Recontratar</option>
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500">Cargando talento...</div>
      ) : (
        <>
          {/* Vista Desktop (Tabla) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Trabajador</th>
                  <th className="px-6 py-4 font-medium">Cédula</th>
                  <th className="px-6 py-4 font-medium">Teléfono</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium">Eval. Psico</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtrados.map((emp) => (
                  <tr key={emp.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-100">{emp.nombre_completo}</td>
                    <td className="px-6 py-4">{emp.documento || '—'}</td>
                    <td className="px-6 py-4">{emp.telefono || '—'}</td>
                    <td className="px-6 py-4">{badgeEstatus(emp.estatus)}</td>
                    <td className="px-6 py-4">{badgePsico(emp.evaluacion_psico_status)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/empleados/${emp.id}`}
                        className="inline-flex items-center justify-center p-2 text-zinc-400 hover:text-violet-400 hover:bg-violet-400/10 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">No se encontraron obreros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Vista Mobile (Tarjetas) */}
          <div className="md:hidden space-y-4">
            {filtrados.map((emp) => (
              <div key={emp.id} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-zinc-100">{emp.nombre_completo}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">CI: {emp.documento || '—'}</p>
                  </div>
                  {badgeEstatus(emp.estatus)}
                </div>
                
                <div className="flex items-center justify-between text-sm border-t border-zinc-800/50 pt-3 mt-1">
                  <div className="text-zinc-400">
                    <span className="block text-xs uppercase mb-1">Psicotécnico</span>
                    {badgePsico(emp.evaluacion_psico_status)}
                  </div>
                  <Link 
                    href={`/empleados/${emp.id}`}
                    className="text-violet-400 font-medium text-sm bg-violet-400/10 px-3 py-1.5 rounded-lg"
                  >
                    Ver Perfil
                  </Link>
                </div>
              </div>
            ))}
            {filtrados.length === 0 && (
              <div className="py-8 text-center text-zinc-500 border border-zinc-800 rounded-xl border-dashed">
                No se encontraron obreros.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
