'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Activity, AlertOctagon, DollarSign, 
  Plus, ShoppingCart, Wrench, ChevronRight, 
  Clock, CheckCircle2, AlertCircle, ShieldCheck
} from 'lucide-react';

const ULTIMOS_PROYECTOS = [
  { id: '1', nombre: 'Domótica Torre Alta', cliente: 'Constructora Atlas', estado: 'Ejecucion', fecha: 'Hoy, 10:30 AM', valor: 450000 },
  { id: '2', nombre: 'CCTV Corporativo', cliente: 'Grupo Salinas', estado: 'Cotizacion', fecha: 'Ayer, 16:45 PM', valor: 125000 },
  { id: '3', nombre: 'Control de Accesos', cliente: 'Residencial Bosques', estado: 'Finalizado', fecha: 'Hace 2 días', valor: 85000 },
  { id: '4', nombre: 'Redes y WiFi 6', cliente: 'WeWork Santa Fe', estado: 'Ejecucion', fecha: 'Hace 3 días', valor: 210000 },
  { id: '5', nombre: 'Automatización Sala Juntas', cliente: 'Coca Cola Femsa', estado: 'Cotizacion', fecha: 'Hace 5 días', valor: 65000 },
];

export default function DashboardView() {
  const [metricas, setMetricas] = useState({ clientes: 0, proyectosActivos: 12, stockCritico: 3, utilidadMes: 245000 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSharePointClients() {
      try {
        const sharePointListId = 'b53a9250-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        const url = `https://casainteligentevzla.sharepoint.com/_vti_bin/owssvr.dll?XMLDATA=1&List={${sharePointListId}}`;
        
        setTimeout(() => {
          setMetricas(prev => ({ ...prev, clientes: 145 }));
          setIsLoading(false);
        }, 1500);

      } catch (error) {
        console.error("Error conectando a SharePoint:", error);
      }
    }

    fetchSharePointClients();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-slate-300 p-4 md:p-8 font-sans selection:bg-blue-500/30 selection:text-blue-200">
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-black text-white tracking-tight">Centro de Comando</h1>
          </div>
          <p className="text-slate-500 font-medium">Operaciones Casa Inteligente • Acceso Autorizado</p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800/50 px-4 py-2 rounded-xl backdrop-blur-sm">
           <span className="flex h-3 w-3 relative">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
           </span>
           <span className="text-sm font-semibold text-blue-400 font-mono tracking-wider">SISTEMA EN LÍNEA</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Total Clientes (SP)', valor: isLoading ? '...' : metricas.clientes, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { title: 'Proyectos Activos', valor: metricas.proyectosActivos, icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { title: 'Stock Crítico (Alertas)', valor: metricas.stockCritico, icon: AlertOctagon, color: 'text-rose-400', bg: 'bg-rose-500/10' },
          { title: 'Utilidad del Mes', valor: `$${(metricas.utilidadMes/1000).toFixed(1)}k`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((card, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
            <div className={`absolute top-0 right-0 w-32 h-32 ${card.bg} rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110`} />
            
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">{card.title}</p>
                <h3 className="text-4xl font-black text-white">{card.valor}</h3>
              </div>
              <div className={`p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl relative z-10 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" /> Actividad Reciente (Últimos 5 Proyectos)
          </h2>
          <button className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors">
            Ver Todos <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#0f172a] text-slate-400 uppercase text-xs font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Proyecto / Cliente</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Creación</th>
                <th className="px-6 py-4 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {ULTIMOS_PROYECTOS.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4 font-mono text-slate-500 group-hover:text-blue-400 transition-colors">#{p.id.padStart(4, '0')}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{p.nombre}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{p.cliente}</div>
                  </td>
                  <td className="px-6 py-4">
                    {p.estado === 'Finalizado' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5"/>FINALIZADO</span>}
                    {p.estado === 'Ejecucion' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold"><Activity className="w-3.5 h-3.5"/>EJECUTANDO</span>}
                    {p.estado === 'Cotizacion' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold"><AlertCircle className="w-3.5 h-3.5"/>COTIZANDO</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-400">{p.fecha}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-200">
                    ${p.valor.toLocaleString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50 animate-fade-in">
        
        <div className="group relative flex items-center justify-end">
           <span className="absolute right-full mr-4 bg-slate-800 text-slate-200 text-xs font-bold px-3 py-1.5 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
             Nuevo Cliente / Proyecto
           </span>
           <button className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center shadow-lg border border-slate-700 hover:border-blue-500/50 transition-all hover:scale-105">
             <Plus className="w-5 h-5 text-blue-400" />
           </button>
        </div>

        <div className="group relative flex items-center justify-end">
           <span className="absolute right-full mr-4 bg-slate-800 text-slate-200 text-xs font-bold px-3 py-1.5 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
             Ingreso de Inventario
           </span>
           <button className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center shadow-lg border border-slate-700 hover:border-blue-500/50 transition-all hover:scale-105">
             <ShoppingCart className="w-5 h-5 text-blue-400" />
           </button>
        </div>

        <div className="group relative flex items-center justify-end mt-2">
           <span className="absolute right-full mr-5 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg shell-glow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-[0_0_15px_rgba(59,130,246,0.5)]">
             Asignar Herramienta a Técnico
           </span>
           <button className="w-16 h-16 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.7)] transition-all hover:-translate-y-1">
             <Wrench className="w-7 h-7" />
           </button>
        </div>

      </div>

    </div>
  );
}
