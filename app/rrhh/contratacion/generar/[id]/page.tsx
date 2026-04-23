'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ContractPDF } from '@/components/pdf/ContractPDF';
import { createClient } from '@/lib/supabase/client';

// Evitar hydration mismatch de PDFViewer en Next.js
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center bg-[#F2F2F7] dark:bg-[#1C1C1E] animate-pulse rounded-3xl"><p className="text-[#8E8E93]">Cargando vista previa...</p></div> }
);

export default function GenerarContrato({ params }: { params: { id: string } }) {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    cargo: '',
    direccion: '',
    salarioBase: '',
    bonificaciones: '',
    fechaIngreso: new Date().toISOString().split('T')[0],
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    fetchCandidato();
  }, [params.id]);

  async function fetchCandidato() {
    try {
      const { data, error } = await supabase
        .from('ci_empleados')
        .select(`
          nombres,
          celular,
          cargo,
          ci_hojas_vida ( direccion )
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      
      const responseData = data as any;
      const hojaVida = responseData.ci_hojas_vida?.[0] || {};
      
      setFormData(prev => ({
        ...prev,
        nombre: responseData.nombres,
        telefono: responseData.celular,
        cargo: responseData.cargo,
        direccion: hojaVida.direccion || '',
        cedula: '', // Cédula debe ser llenada manualmente si no se tiene
      }));
    } catch (error) {
      console.error('Error fetching candidato:', error);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // 1. Insertar contrato
      const { error: contratoError } = await supabase.from('ci_contratos').insert({
        empleado_id: params.id,
        cargo_acordado: formData.cargo,
        salario_base: parseFloat(formData.salarioBase),
        bonificaciones: formData.bonificaciones ? parseFloat(formData.bonificaciones) : 0,
        fecha_ingreso: formData.fechaIngreso,
        estado: 'activo'
      });

      if (contratoError) throw contratoError;

      // 2. Actualizar estado del empleado a completado
      const { error: empleadoError } = await supabase
        .from('ci_empleados')
        .update({ estado_proceso: 'completado' })
        .eq('id', params.id);

      if (empleadoError) throw empleadoError;

      setGenerated(true);
    } catch (error) {
      console.error('Error generating contract:', error);
      alert('Error al generar contrato. Revisa la consola.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Prevenir hydration
  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#000000] text-[#1C1C1E] dark:text-[#F2F2F7] p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/rrhh/contratacion">
            <button className="p-3 rounded-full bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 hover:bg-white dark:hover:bg-[#2C2C2E] transition-colors shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Completar Contrato</h1>
            <p className="text-[#8E8E93]">Candidato: {formData.nombre || 'Desconocido'}</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)]">
          
          {/* Panel Izquierdo: Formulario */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-[400px] flex flex-col gap-6"
          >
            <div className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#FF9500]" />
                Datos Faltantes
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#8E8E93] mb-1">Cédula de Identidad *</label>
                  <input 
                    type="text" 
                    name="cedula"
                    placeholder="Ej. V-12345678"
                    value={formData.cedula}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-[#E5E5EA] dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#8E8E93] mb-1">Cargo Acordado *</label>
                  <input 
                    type="text" 
                    name="cargo"
                    value={formData.cargo}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-[#E5E5EA] dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#8E8E93] mb-1">Salario Mensual ($) *</label>
                  <input 
                    type="number" 
                    name="salarioBase"
                    placeholder="Ej. 400"
                    value={formData.salarioBase}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-[#E5E5EA] dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#8E8E93] mb-1">Bonificaciones ($)</label>
                  <input 
                    type="number" 
                    name="bonificaciones"
                    placeholder="Ej. 50"
                    value={formData.bonificaciones}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-[#E5E5EA] dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#8E8E93] mb-1">Fecha de Ingreso *</label>
                  <input 
                    type="date" 
                    name="fechaIngreso"
                    value={formData.fechaIngreso}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-[#E5E5EA] dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all"
                    required
                  />
                </div>
              </div>

              <div className="mt-8">
                {generated ? (
                  <div className="w-full py-4 rounded-xl bg-[#34C759]/10 text-[#34C759] font-semibold flex items-center justify-center gap-2 border border-[#34C759]/20">
                    <CheckCircle2 className="w-5 h-5" />
                    Contrato Enviado y Activo
                  </div>
                ) : (
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !formData.salarioBase || !formData.cedula || !formData.cargo || !formData.fechaIngreso}
                    className="w-full py-4 rounded-xl bg-[#007AFF] text-white font-semibold hover:bg-[#0056b3] transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Aprobar y Generar Contrato'
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Panel Derecho: PDF Viewer */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col"
          >
            <div className="p-4 border-b border-[#E5E5EA] dark:border-gray-800 flex justify-between items-center bg-white/40 dark:bg-black/20">
              <span className="font-semibold text-sm">Vista Previa en Vivo</span>
              <span className="text-xs text-[#8E8E93]">El documento se actualiza al escribir</span>
            </div>
            
            <div className="flex-1 w-full h-full p-0">
              <PDFViewer width="100%" height="100%" className="border-none">
                <ContractPDF 
                  nombre={formData.nombre || 'Nombre del Trabajador'}
                  cedula={formData.cedula || 'V-00.000.000'}
                  telefono={formData.telefono || 'Teléfono'}
                  cargo={formData.cargo || 'Cargo Asignado'}
                  direccion={formData.direccion || 'Dirección de Residencia'}
                  fecha={formData.fechaIngreso}
                  digitalSignature={generated ? `Firmado digitalmente por RRHH - ${new Date().toLocaleDateString()}` : undefined}
                />
              </PDFViewer>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
