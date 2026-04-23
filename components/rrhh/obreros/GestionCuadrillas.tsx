'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, LayoutGrid, MapPin, Calendar, Plus, ChevronRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function GestionCuadrillas() {
  const [cuadrillas, setCuadrillas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchCuadrillas();
  }, []);

  async function fetchCuadrillas() {
    try {
      const { data, error } = await supabase
        .from('ci_cuadrillas')
        .select(`
          *,
          lider:ci_empleados(nombres),
          miembros:ci_cuadrilla_miembros(count)
        `);

      if (error) throw error;
      setCuadrillas(data || []);
    } catch (error) {
      console.error('Error fetching cuadrillas:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Equipos de Trabajo Activos</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] text-white rounded-xl hover:bg-[#0056b3] transition-all text-sm font-medium shadow-lg shadow-blue-500/20">
          <Plus size={16} />
          Nueva Cuadrilla
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cuadrillas.length > 0 ? (
          cuadrillas.map((cuadrilla, index) => (
            <motion.div
              key={cuadrilla.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[#34C759]">
                    <CheckCircle2 size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{cuadrilla.estado}</span>
                  </div>
                  <h3 className="text-2xl font-bold">{cuadrilla.nombre_tarea}</h3>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  <LayoutGrid className="text-[#8E8E93]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <span className="text-xs text-[#8E8E93] block">Ubicación</span>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin size={14} className="text-[#8E8E93]" />
                    {cuadrilla.ubicacion || 'No asignada'}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-[#8E8E93] block">Líder de Cuadrilla</span>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Users size={14} className="text-[#8E8E93]" />
                    {cuadrilla.lider?.nombres || 'Por asignar'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-[#1C1C1E] bg-[#E5E5EA] dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold">
                        {i}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-[#8E8E93]">
                    {cuadrilla.miembros?.[0]?.count || 0} integrantes
                  </span>
                </div>
                <button className="p-2 rounded-xl bg-white dark:bg-black/20 hover:bg-[#007AFF] hover:text-white transition-all shadow-sm">
                  <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          /* Empty State Mockup */
          <div className="col-span-full py-12 border-2 border-dashed border-[#E5E5EA] dark:border-gray-800 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#8E8E93]">
              <Users size={32} />
            </div>
            <div>
              <p className="font-semibold">No hay cuadrillas activas</p>
              <p className="text-sm text-[#8E8E93]">Crea una nueva cuadrilla para asignar obreros a una obra.</p>
            </div>
            <button className="px-6 py-2 bg-white/60 dark:bg-[#1C1C1E]/60 border border-white/20 dark:border-gray-800 rounded-xl hover:bg-white transition-all text-sm font-medium">
              Empezar ahora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
