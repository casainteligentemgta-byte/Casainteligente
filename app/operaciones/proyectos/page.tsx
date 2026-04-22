'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, Plus, FolderKanban, 
  Calendar, MapPin, DollarSign, Clock,
  ChevronRight, MoreVertical, LayoutGrid, List,
  Loader2, AlertCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ProyectoDrawer from '@/components/proyectos/ProyectoDrawer';
import NuevoProyectoDrawer from '@/components/proyectos/NuevoProyectoDrawer';

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [isNuevoDrawerOpen, setIsNuevoDrawerOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchProyectos();
  }, [supabase]);

  async function fetchProyectos() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('ci_proyectos')
      .select(`
        *,
        cliente_info:customers(first_name, last_name, company_name)
      `)
      .order('created_at', { ascending: false });

    if (data) {
      setProyectos(data);
    }
    setIsLoading(false);
  }

  const proyectosFiltrados = useMemo(() => {
    return proyectos.filter(p => {
      const matchSearch = (p.nombre || p.nombre_proyecto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.cliente_info?.company_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchEstado = filtroEstado === 'Todos' || p.estado === filtroEstado.toLowerCase();
      return matchSearch && matchEstado;
    });
  }, [proyectos, searchTerm, filtroEstado]);

  const stats = useMemo(() => {
    return {
      total: proyectos.length,
      activos: proyectos.filter(p => p.estado === 'ejecucion' || p.estado === 'nuevo').length,
      finalizados: proyectos.filter(p => p.estado === 'finalizado').length,
    };
  }, [proyectos]);

  const getStatusColor = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'nuevo': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200';
      case 'ejecucion': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200';
      case 'detenido': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200';
      case 'finalizado': return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold dark:text-white flex items-center gap-3">
            Gestión de Proyectos
            <span className="text-sm font-medium bg-blue-500/10 text-blue-500 px-2.5 py-0.5 rounded-full border border-blue-500/20">
              {stats.total}
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Control operativo y seguimiento de obras activas.</p>
        </div>

        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Clock className="w-4 h-4 text-blue-500"/></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Activos</p>
              <p className="text-lg font-bold dark:text-white leading-tight">{stats.activos}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
            <div className="p-2 bg-emerald-500/10 rounded-lg"><Calendar className="w-4 h-4 text-emerald-500"/></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Finalizados</p>
              <p className="text-lg font-bold dark:text-white leading-tight">{stats.finalizados}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsNuevoDrawerOpen(true)}
            className="flex-1 lg:flex-none bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Proyecto
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, cliente o ubicación..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-transparent dark:bg-slate-900 dark:border-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {['Todos', 'Nuevo', 'Ejecucion', 'Detenido', 'Finalizado'].map((estado) => (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                ${filtroEstado === estado 
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
              `}
            >
              {estado}
            </button>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-3">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/20' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/20' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Grid View */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="text-slate-500 font-medium">Cargando proyectos...</p>
        </div>
      ) : proyectosFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 p-12 rounded-3xl text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold dark:text-white">No se encontraron proyectos</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2">Ajusta los filtros o crea un nuevo proyecto para comenzar.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {proyectosFiltrados.map((p) => (
            <div 
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 hover:border-blue-500 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(p.estado)}`}>
                  {p.estado}
                </div>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <MoreVertical className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <h3 className="text-xl font-bold dark:text-white mb-2 group-hover:text-blue-500 transition-colors">
                {p.nombre || p.nombre_proyecto || 'Sin nombre'}
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <p className="text-sm truncate">{p.ubicacion_texto || 'Ubicación no especificada'}</p>
                </div>
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                  <DollarSign className="w-4 h-4 shrink-0" />
                  <p className="text-sm font-semibold dark:text-slate-300">
                    {p.monto_aproximado ? `${p.monto_aproximado.toLocaleString()} ${p.moneda || 'USD'}` : 'Sin presupuesto'}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                    {p.cliente_info?.company_name?.[0] || 'C'}
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                    {p.cliente_info?.company_name || 'Cliente Genérico'}
                  </span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                  Ver detalle <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-6 py-4">Proyecto</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Ubicación</th>
                <th className="px-6 py-4 text-right">Inversión</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {proyectosFiltrados.map((p) => (
                <tr 
                  key={p.id} 
                  onClick={() => setSelectedProject(p)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 font-bold dark:text-white">{p.nombre || p.nombre_proyecto}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(p.estado)}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm font-medium">
                    {p.cliente_info?.company_name || '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-500 text-sm truncate max-w-[200px]">
                    {p.ubicacion_texto || '—'}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold dark:text-slate-200">
                    {p.monto_aproximado ? `${p.monto_aproximado.toLocaleString()} ${p.moneda}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedProject && (
        <ProyectoDrawer 
          proyecto={selectedProject} 
          onClose={() => setSelectedProject(null)} 
        />
      )}

      {isNuevoDrawerOpen && (
        <NuevoProyectoDrawer 
          onClose={() => setIsNuevoDrawerOpen(false)}
          onSuccess={() => fetchProyectos()}
        />
      )}
    </div>
  );
}
