'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, Briefcase, MapPin, MoreVertical, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function DirectorioObreros() {
  const [obreros, setObreros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchObreros();
  }, []);

  async function fetchObreros() {
    try {
      // Filtrar por cargos operativos o una marca específica si existe
      // Por ahora traemos los que tengan cargos típicos de obrero
      const { data, error } = await supabase
        .from('ci_empleados')
        .select('*')
        .or('cargo.ilike.%ayudante%,cargo.ilike.%maestro%,cargo.ilike.%albañil%,cargo.ilike.%obrero%')
        .order('nombres', { ascending: true });

      if (error) throw error;
      setObreros(data || []);
    } catch (error) {
      console.error('Error fetching obreros:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-white/40 dark:bg-[#1C1C1E]/40 animate-pulse rounded-3xl border border-white/20 dark:border-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {obreros.length > 0 ? (
        obreros.map((obrero, index) => (
          <motion.div
            key={obrero.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF]">
                <User size={24} />
              </div>
              <button className="text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white transition-colors">
                <MoreVertical size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-bold tracking-tight">{obrero.nombres}</h3>
              
              <div className="flex items-center gap-2 text-sm text-[#8E8E93]">
                <Briefcase size={14} />
                <span>{obrero.cargo}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-[#8E8E93]">
                <Phone size={14} />
                <span>{obrero.celular || 'Sin teléfono'}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-[#8E8E93]">
                <MapPin size={14} />
                <span>{obrero.ciudad || 'Ubicación no registrada'}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E5E5EA] dark:border-gray-800 flex justify-between items-center">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                obrero.estado_proceso === 'completado' 
                  ? 'bg-[#34C759]/10 text-[#34C759]' 
                  : 'bg-[#FF9500]/10 text-[#FF9500]'
              }`}>
                {obrero.estado_proceso || 'En Proceso'}
              </span>
              
              <button className="flex items-center gap-1 text-xs font-semibold text-[#007AFF] hover:underline">
                Ver Detalle
                <ExternalLink size={12} />
              </button>
            </div>
          </motion.div>
        ))
      ) : (
        <div className="col-span-full py-20 text-center">
          <p className="text-[#8E8E93]">No se encontraron obreros registrados.</p>
        </div>
      )}
    </div>
  );
}
