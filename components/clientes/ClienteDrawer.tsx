'use client';

import { useEffect } from 'react';
import { X, MessageCircle, MapPin, Mail, Phone, Briefcase, Plus, Map as MapIcon, Crown, CheckCircle2 } from 'lucide-react';

interface ClienteDrawerProps {
  cliente: any;
  onClose: () => void;
}

export default function ClienteDrawer({ cliente, onClose }: ClienteDrawerProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleWhatsApp = () => {
    const numeroLimpio = cliente.telefono.replace(/[\s+]/g, '');
    const mensaje = encodeURIComponent(`Hola ${cliente.nombre}, me comunico de Casa Inteligente.`);
    window.open(`https://wa.me/${numeroLimpio}?text=${mensaje}`, '_blank');
  };

  const handleGoogleMaps = () => {
    const direccion = encodeURIComponent(cliente.direccion);
    window.open(`https://www.google.com/maps/search/?api=1&query=${direccion}`, '_blank');
  };

  const handleNuevoProyecto = () => {
    alert(`Redirigiendo a Nuevo Proyecto con ID pre-cargado: ${cliente.id}`);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in-fast" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] xl:w-[600px] bg-white dark:bg-slate-950 shadow-2xl z-50 transform transition-transform border-l border-slate-200 dark:border-slate-800 flex flex-col slide-in-right">
        
        <div className={`p-6 border-b flex justify-between items-start 
           ${cliente.isPremium ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50' : 'bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800'}
        `}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold uppercase tracking-wider ${cliente.isPremium ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                Perfil {cliente.tipo}
              </span>
              {cliente.isPremium && (
                <span className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-600 text-white px-2 py-0.5 rounded text-xs font-bold uppercase shadow-sm">
                  <Crown className="w-3 h-3" /> Cliente Premium
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold dark:text-white leading-tight">{cliente.nombre}</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
             <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
               <Mail className="w-5 h-5 text-slate-400" />
               <a href={`mailto:${cliente.email}`} className="hover:text-blue-500 font-medium">{cliente.email}</a>
             </div>
             <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
               <Phone className="w-5 h-5 text-slate-400" />
               <span className="font-medium">{cliente.telefono}</span>
             </div>
             
             <button 
               onClick={handleWhatsApp}
               className="w-full mt-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-3 rounded-xl font-bold shadow-sm shadow-[#25D366]/30 transition-colors flex items-center justify-center gap-2"
             >
               <MessageCircle className="w-5 h-5" />
               Contactar por WhatsApp
             </button>
          </div>

          <div>
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3">Retorno de Cliente (Ingreso Realizado)</h3>
             <div className={`p-6 rounded-2xl shadow-md border relative overflow-hidden text-white
                ${cliente.isPremium 
                  ? 'bg-gradient-to-br from-amber-600 to-orange-500 border-amber-600' 
                  : 'bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 border-slate-700'
                }
             `}>
                <CheckCircle2 className={`absolute -right-4 -bottom-4 w-32 h-32 opacity-10 ${cliente.isPremium ? 'text-black mix-blend-overlay' : 'text-white'}`} />
                <p className="font-medium mb-1 opacity-90">Total Generado (Proyectos Finalizados)</p>
                <div className="text-4xl font-black drop-shadow-sm">${(cliente.dineroGenerado).toLocaleString('es-MX')}</div>
                
                {cliente.isPremium && (
                   <p className="text-sm mt-3 font-medium flex items-center gap-1 bg-black/20 w-max px-3 py-1 rounded-full">
                     <Crown className="w-4 h-4" /> Beneficiario de Tarifas Preferenciales
                   </p>
                )}
             </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Ubicación Principal</h3>
              <button onClick={handleGoogleMaps} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                Abrir en Maps <MapIcon className="w-3 h-3" />
              </button>
            </div>
            <div className="bg-slate-100 dark:bg-slate-900 h-32 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center relative overflow-hidden group cursor-pointer" onClick={handleGoogleMaps}>
               <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%239C92AC%22 fill-opacity=%220.2%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30 dark:opacity-10 pointer-events-none mix-blend-multiply dark:mix-blend-screen" ></div>
               <div className="flex flex-col items-center justify-center p-4">
                 <MapPin className="w-8 h-8 text-rose-500 mb-2 drop-shadow-md group-hover:scale-110 transition-transform" />
                 <span className="font-semibold text-slate-700 dark:text-slate-300 text-center max-w-[80%] truncate">
                   {cliente.direccion}
                 </span>
               </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Proyectos Asociados ({cliente.proyectos.length})
            </h3>
            <div className="space-y-3">
              {cliente.proyectos.map((proy: any) => (
                <div key={proy.id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex justify-between items-center group hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{proy.nombre}</h4>
                    <p className="text-sm text-slate-500 font-medium">${(proy.costo).toLocaleString('es-MX')}</p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full border
                    ${proy.estado === 'Finalizado' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : ''}
                    ${proy.estado === 'Ejecucion' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20' : ''}
                    ${proy.estado === 'Cotizacion' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20' : ''}
                  `}>
                    {proy.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <button 
            onClick={handleNuevoProyecto}
            className={`w-full py-3.5 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 group text-white
              ${cliente.isPremium ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}
          `}>
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            Vender Nuevo Proyecto a {cliente.nombre.split(' ')[0]}
          </button>
        </div>

      </div>
      
    </>
  );
}
