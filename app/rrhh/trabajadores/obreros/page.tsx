'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, FileText, LayoutGrid, Search, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DirectorioObreros from '@/components/rrhh/obreros/DirectorioObreros';
import TabuladorSalarial from '@/components/rrhh/obreros/TabuladorSalarial';
import GestionCuadrillas from '@/components/rrhh/obreros/GestionCuadrillas';

type Tab = 'directorio' | 'tabulador' | 'cuadrillas';

export default function ObrerosDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('directorio');

  const tabs = [
    { id: 'directorio', label: 'Directorio Activo', icon: Users },
    { id: 'tabulador', label: 'Tabulador (Gaceta)', icon: FileText },
    { id: 'cuadrillas', label: 'Cuadrillas y Tareas', icon: LayoutGrid },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#000000] text-[#1C1C1E] dark:text-[#F2F2F7] p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button
                onClick={() => router.push('/rrhh')}
                className="flex items-center text-sm font-medium mb-3 hover:opacity-70 transition-opacity text-[#007AFF]"
            >
                <ArrowLeft size={16} className="mr-1" />
                Volver a RRHH
            </button>
            <h1 className="text-4xl font-bold tracking-tight">Trabajadores Obreros</h1>
            <p className="text-[#8E8E93] mt-2">Gestión de personal operativo, salarios por gaceta y asignación de cuadrillas.</p>
          </div>
          
          <div className="relative w-full md:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-[#8E8E93]" />
            </div>
            <input
              type="text"
              placeholder="Buscar trabajador o cuadrilla..."
              className="pl-10 pr-4 py-3 bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all w-full md:w-80 shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
            />
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex gap-2 p-1 bg-white/40 dark:bg-[#1C1C1E]/40 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-2xl w-max shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 whitespace-nowrap ${
                    isActive 
                      ? 'text-white shadow-md' 
                      : 'text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white hover:bg-white/20 dark:hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 bg-[#007AFF] rounded-xl"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="relative w-full min-h-[600px] mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {activeTab === 'directorio' && <DirectorioObreros />}
              {activeTab === 'tabulador' && <TabuladorSalarial />}
              {activeTab === 'cuadrillas' && <GestionCuadrillas />}
            </motion.div>
          </AnimatePresence>
        </div>
        
      </div>
    </div>
  );
}
