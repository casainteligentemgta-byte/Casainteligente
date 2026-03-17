'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Plus, User, Building2, ChevronRight, Crown } from 'lucide-react';
import ClienteDrawer from '@/components/clientes/ClienteDrawer';

const CLIENTES_MOCK = [
  { 
    id: 'c1', 
    nombre: 'Constructora Atlas S.A.', 
    tipo: 'Empresa', 
    email: 'compras@atlas.com', 
    telefono: '+525512345678',
    direccion: 'Av. Reforma 222, CDMX',
    proyectos: [
      { id: 'p1', nombre: 'Torre Central - Domótica', estado: 'Ejecucion', costo: 850000 },
      { id: 'p2', nombre: 'Oficinas Atlas - Redes', estado: 'Finalizado', costo: 600000 },
    ]
  },
  { 
    id: 'c2', 
    nombre: 'Roberto Medina', 
    tipo: 'Residencial', 
    email: 'roberto.m@email.com', 
    telefono: '+525598765432',
    direccion: 'Bosques de las Lomas, Casa 45',
    proyectos: [
      { id: 'p3', nombre: 'Casa Medina - CCTV y Audio', estado: 'Cotizacion', costo: 125000 },
    ]
  },
];

const UMBRAL_PREMIUM = 500000;

export default function ClientesCRMView() {
  const [clientes, setClientes] = useState(CLIENTES_MOCK);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const matchSearch = c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = filtroTipo === 'Todos' || c.tipo === filtroTipo;
      return matchSearch && matchTipo;
    });
  }, [clientes, searchTerm, filtroTipo]);

  return (
    <div className="space-y-6 animate-fade-in md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Directorio de Clientes</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona relaciones, proyectos e inversiones.</p>
        </div>
        <button className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </button>
      </div>

      <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, empresa o correo..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-50 border border-transparent dark:bg-slate-900 dark:border-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-64">
          <Filter className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select 
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-50 border border-transparent dark:bg-slate-900 dark:border-slate-800 focus:bg-white focus:border-blue-500 outline-none appearance-none font-medium dark:text-white cursor-pointer"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="Todos">Todos los tipos</option>
            <option value="Empresa">Empresa (B2B)</option>
            <option value="Residencial">Residencial (B2C)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {clientesFiltrados.map((cliente) => {
          const dineroGenerado = cliente.proyectos
             .filter(p => p.estado === 'Finalizado')
             .reduce((total, p) => total + p.costo, 0);
          
          const isPremium = dineroGenerado >= UMBRAL_PREMIUM;

          return (
            <div 
              key={cliente.id}
              onClick={() => setClienteSeleccionado({ ...cliente, dineroGenerado, isPremium })}
              className={`group bg-white dark:bg-slate-900 border p-5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center gap-4 justify-between
                ${isPremium ? 'border-amber-400/50 dark:border-amber-500/50 hover:border-amber-500' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700/50'}
              `}
            >
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 relative
                  ${isPremium ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-500/30' : 
                   cliente.tipo === 'Empresa' ? 'bg-indigo-100 text-indigo-600 border-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-900/20' : 
                                                'bg-emerald-100 text-emerald-600 border-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/20'}
                `}>
                  {cliente.tipo === 'Empresa' ? <Building2 className="w-6 h-6" /> : <User className="w-6 h-6" />}
                  {isPremium && (
                    <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-sm">
                       <Crown className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className={`text-xl font-bold transition-colors flex items-center gap-2
                    ${isPremium ? 'text-amber-700 dark:text-amber-400 group-hover:text-amber-600' : 'text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'}
                  `}>
                    {cliente.nombre}
                    {isPremium && <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs px-2 py-0.5 rounded-full font-bold tracking-wide uppercase">Premium</span>}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-medium bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">{cliente.tipo}</span>
                    <span>{cliente.email}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-slate-100 dark:border-slate-800">
                <div className="text-left md:text-right flex-1">
                  <p className={`text-sm font-medium ${isPremium ? 'text-amber-600/70 dark:text-amber-500/70' : 'text-slate-500 dark:text-slate-400'}`}>Generado (Finalizados)</p>
                  <p className={`text-xl font-black ${isPremium ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    ${(dineroGenerado).toLocaleString('es-MX')}
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-blue-500 transition-colors hidden md:block" />
              </div>
            </div>
          );
        })}
      </div>

      {clienteSeleccionado && (
        <ClienteDrawer 
          cliente={clienteSeleccionado} 
          onClose={() => setClienteSeleccionado(null)} 
        />
      )}
    </div>
  );
}
