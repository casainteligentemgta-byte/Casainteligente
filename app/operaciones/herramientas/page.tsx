'use client';

import { useState } from 'react';
import { Wrench } from 'lucide-react';

export default function HerramientasView() {
  const [herramientas] = useState([
    { id: '1', desc: 'Taladro Rotomartillo Bosch', estado: 'En Obra', asignadoA: 'Carlos Tecnico', proyecto: 'Edificio Las Lomas' },
    { id: '2', desc: 'Escalera Tijera 3m', estado: 'Disponible', asignadoA: null, proyecto: null },
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold dark:text-white">Activos Fijos y Herramientas</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {herramientas.map((h) => (
          <div key={h.id} className="bg-white dark:bg-slate-950 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
                  ${h.estado === 'Disponible' 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
                    : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'}`}
                >
                  {h.estado}
                </span>
              </div>
              <h3 className="font-semibold text-lg leading-tight dark:text-white mb-1">{h.desc}</h3>
              {h.estado === 'En Obra' && (
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 space-y-1">
                  <p><span className="font-medium">Técnico:</span> {h.asignadoA}</p>
                  <p><span className="font-medium">Proyecto:</span> {h.proyecto}</p>
                </div>
              )}
            </div>
            
            <button className="mt-6 w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg text-sm transition-colors border border-slate-200 dark:border-slate-700">
              {h.estado === 'Disponible' ? 'Asignar a Proyecto' : 'Reasignar / Devolver'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
