'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Download, Edit3, Trash2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function TabuladorSalarial() {
  const [tabulador, setTabulador] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchTabulador();
  }, []);

  async function fetchTabulador() {
    try {
      const { data, error } = await supabase
        .from('ci_tabulador_salarial')
        .select('*')
        .order('salario_diario', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setTabulador(data);
      } else {
        // Datos de respaldo basados en Gaceta 6.752 (Referencial)
        const mockData = [
          { id: '1', cargo_nombre: 'Maestro de Primera', salario_diario: 12.50, salario_semanal: 75.00, referencia_gaceta: '6.752 (Jul 2023)' },
          { id: '2', cargo_nombre: 'Maestro de Segunda', salario_diario: 11.00, salario_semanal: 66.00, referencia_gaceta: '6.752 (Jul 2023)' },
          { id: '3', cargo_nombre: 'Oficial', salario_diario: 9.50, salario_semanal: 57.00, referencia_gaceta: '6.752 (Jul 2023)' },
          { id: '4', cargo_nombre: 'Ayudante', salario_diario: 8.00, salario_semanal: 48.00, referencia_gaceta: '6.752 (Jul 2023)' },
          { id: '5', cargo_nombre: 'Vigilante', salario_diario: 7.50, salario_semanal: 45.00, referencia_gaceta: '6.752 (Jul 2023)' },
        ];
        setTabulador(mockData);
      }
    } catch (error) {
      console.error('Error fetching tabulador:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-[#FF9500]/10 text-[#FF9500] rounded-xl border border-[#FF9500]/20 text-sm">
          <AlertCircle size={16} />
          <span>Vigente: Gaceta Oficial 6.752 Extraordinaria</span>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white/60 dark:bg-[#1C1C1E]/60 border border-white/20 dark:border-gray-800 rounded-xl hover:bg-white transition-all text-sm font-medium">
            <Download size={16} />
            Descargar PDF
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#007AFF] text-white rounded-xl hover:bg-[#0056b3] transition-all text-sm font-medium shadow-lg shadow-blue-500/20">
            <Plus size={16} />
            Nuevo Cargo
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F2F2F7]/50 dark:bg-black/20 text-left border-b border-[#E5E5EA] dark:border-gray-800">
                <th className="px-6 py-4 text-xs font-bold text-[#8E8E93] uppercase tracking-wider">Cargo / Denominación</th>
                <th className="px-6 py-4 text-xs font-bold text-[#8E8E93] uppercase tracking-wider">Salario Diario ($)</th>
                <th className="px-6 py-4 text-xs font-bold text-[#8E8E93] uppercase tracking-wider">Salario Semanal ($)</th>
                <th className="px-6 py-4 text-xs font-bold text-[#8E8E93] uppercase tracking-wider">Ref. Gaceta</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-[#8E8E93] uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5EA] dark:divide-gray-800">
              {tabulador.map((item, index) => (
                <motion.tr 
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#007AFF]/5 text-[#007AFF]">
                        <FileText size={14} />
                      </div>
                      <span className="font-semibold">{item.cargo_nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm">${item.salario_diario.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-lg bg-[#34C759]/10 text-[#34C759] font-bold text-sm">
                      ${item.salario_semanal.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#8E8E93]">{item.referencia_gaceta}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 rounded-lg hover:bg-[#007AFF]/10 text-[#007AFF] transition-colors">
                        <Edit3 size={16} />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-[#FF3B30]/10 text-[#FF3B30] transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-6 bg-white/40 dark:bg-[#1C1C1E]/40 border border-white/20 dark:border-gray-800 rounded-3xl">
        <h4 className="text-sm font-bold mb-2">Información sobre Gaceta 6.752</h4>
        <p className="text-xs text-[#8E8E93] leading-relaxed">
          Los montos mostrados son referenciales basados en la homologación del sector construcción. 
          Los salarios en dólares ($) se calculan a la tasa oficial del día o según acuerdos contractuales internos de la empresa. 
          Recuerde que el tabulador incluye beneficios de alimentación y transporte según la cláusula vigente.
        </p>
      </div>
    </div>
  );
}
