'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, CheckCircle, Clock, UserPlus, Search, ChevronRight, FileSignature } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ContratacionDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Fetch candidatos en evaluación
      const { data: empleadosData, error: empleadosError } = await supabase
        .from('ci_empleados')
        .select('*')
        .eq('estado_proceso', 'en_evaluacion')
        .order('created_at', { ascending: false });

      if (empleadosError) throw empleadosError;

      // Fetch contratos activos
      const { data: contratosData, error: contratosError } = await supabase
        .from('ci_contratos')
        .select(`
          *,
          empleado:ci_empleados (
            nombres,
            cargo
          )
        `)
        .order('created_at', { ascending: false });

      if (contratosError) throw contratosError;

      setPendientes(empleadosData || []);
      setContratos(contratosData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#000000] text-[#1C1C1E] dark:text-[#F2F2F7] p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold tracking-tight mb-2">Contratación</h1>
          <p className="text-[#8E8E93] text-lg">Gestión de contratos y seguimiento de candidatos.</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <h2 className="text-xl font-semibold">Pendientes</h2>
            </div>
            <p className="text-4xl font-bold">{pendientes.length}</p>
            <p className="text-sm text-[#8E8E93] mt-2">Candidatos esperando contrato</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold">Activos</h2>
            </div>
            <p className="text-4xl font-bold">{contratos.length}</p>
            <p className="text-sm text-[#8E8E93] mt-2">Contratos vigentes</p>
          </motion.div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Pendientes de Contrato */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-[#007AFF]" />
                Por Contratar
              </h2>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : pendientes.map((candidato, index) => (
                <motion.div
                  key={candidato.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="p-4 rounded-2xl bg-white/40 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 transition-colors border border-transparent hover:border-[#E5E5EA] dark:hover:border-gray-800 group"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-lg">{candidato.nombres}</h3>
                      <p className="text-[#8E8E93] text-sm">{candidato.cargo}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-[#8E8E93]">Postulado: {new Date(candidato.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Link href={`/rrhh/contratacion/generar/${candidato.id}`}>
                      <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#007AFF] text-white font-medium hover:bg-[#0056b3] transition-colors shadow-lg shadow-blue-500/30">
                        <FileSignature className="w-4 h-4" />
                        Generar Contrato
                      </button>
                    </Link>
                  </div>
                </motion.div>
              ))}
              
              {!loading && pendientes.length === 0 && (
                <p className="text-center text-[#8E8E93] py-8">No hay candidatos pendientes de contrato.</p>
              )}
            </div>
          </motion.div>

          {/* Contratos Activos */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <FileText className="w-6 h-6 text-[#34C759]" />
                Contratos Activos
              </h2>
              
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8E8E93]" />
                <input 
                  type="text" 
                  placeholder="Buscar..."
                  className="pl-9 pr-4 py-2 rounded-full bg-white/40 dark:bg-black/20 border border-[#E5E5EA] dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-[#34C759] text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin" />
                </div>
              ) : contratos.filter(c => c.empleado?.nombres.toLowerCase().includes(searchTerm.toLowerCase())).map((contrato, index) => (
                <motion.div
                  key={contrato.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="p-4 rounded-2xl bg-white/40 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 transition-colors border border-transparent hover:border-[#E5E5EA] dark:hover:border-gray-800 flex justify-between items-center cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#34C759]/10 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-[#34C759]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{contrato.empleado?.nombres || 'Desconocido'}</h3>
                      <p className="text-sm text-[#8E8E93]">{contrato.cargo_acordado}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[#8E8E93]">{new Date(contrato.created_at).toLocaleDateString()}</span>
                    <ChevronRight className="w-5 h-5 text-[#8E8E93] group-hover:text-[#1C1C1E] dark:group-hover:text-white transition-colors" />
                  </div>
                </motion.div>
              ))}
              
              {!loading && contratos.filter(c => c.empleado?.nombres.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                <p className="text-center text-[#8E8E93] py-8">No se encontraron contratos.</p>
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
