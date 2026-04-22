'use client';

import { useEffect, useState } from 'react';
import { 
  X, FolderKanban, MapPin, Calendar, 
  DollarSign, Clock, FileText, User, 
  ChevronRight, ExternalLink, AlertCircle,
  Save, Trash2, CheckCircle2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ProyectoDrawerProps {
  proyecto: any;
  onClose: () => void;
}

export default function ProyectoDrawer({ proyecto, onClose }: ProyectoDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProyecto, setEditedProyecto] = useState({ ...proyecto });
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const getStatusColor = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'nuevo': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200';
      case 'ejecucion': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200';
      case 'detenido': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200';
      case 'finalizado': return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400 border-gray-200';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Note: We would implement the update logic here
    // For now, let's just simulate it
    setTimeout(() => {
      setIsSaving(false);
      setIsEditing(false);
      alert('Cambios guardados localmente (Simulado)');
    }, 1000);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No definida';
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in-fast" 
        onClick={onClose} 
      />

      <div className="fixed inset-y-0 right-0 w-full md:w-[550px] xl:w-[650px] bg-white dark:bg-slate-950 shadow-2xl z-50 transform transition-transform border-l border-slate-200 dark:border-slate-800 flex flex-col slide-in-right">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <FolderKanban className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Detalle del Proyecto
              </span>
            </div>
            <h2 className="text-2xl font-bold dark:text-white leading-tight">
              {proyecto.nombre || proyecto.nombre_proyecto}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-sm border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Status & Quick Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Estado Actual</p>
              <div className={`w-full py-2 rounded-xl text-xs font-bold text-center border uppercase tracking-wider ${getStatusColor(proyecto.estado)}`}>
                {proyecto.estado}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Inversión Estimada</p>
              <div className="flex items-center gap-2 text-lg font-bold dark:text-white">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                {proyecto.monto_aproximado ? `${proyecto.monto_aproximado.toLocaleString()} ${proyecto.moneda}` : '—'}
              </div>
            </div>
          </div>

          {/* Client Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
              <User className="w-4 h-4" /> Cliente Responsable
            </h3>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
                  {proyecto.cliente_info?.nombre?.[0] || 'C'}
                </div>
                <div>
                  <h4 className="font-bold dark:text-white">{proyecto.cliente_info?.nombre || 'Cliente Genérico'}</h4>
                  <p className="text-sm text-slate-500 italic">
                    Cliente del proyecto
                  </p>
                </div>
              </div>
              <button className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4" /> Información Técnica
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50">
                <div className="p-2 bg-rose-500/10 rounded-xl mt-1">
                  <MapPin className="w-4 h-4 text-rose-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ubicación de Obra</p>
                  <p className="text-sm font-medium dark:text-slate-200 leading-relaxed">
                    {proyecto.ubicacion_texto || 'No especificada'}
                  </p>
                </div>
                <button className="text-[10px] font-bold text-blue-500 flex items-center gap-1 hover:underline">
                  VER MAPA <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50">
                  <div className="p-2 bg-blue-500/10 rounded-xl">
                    <Calendar className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Inicio</p>
                    <p className="text-sm font-bold dark:text-slate-200">
                      {formatDate(proyecto.fecha_inicio)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50">
                  <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <Clock className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Entrega Est.</p>
                    <p className="text-sm font-bold dark:text-slate-200">
                      {formatDate(proyecto.fecha_entrega_estimada)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Observaciones y Notas
            </h3>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 min-h-[120px]">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">
                {proyecto.observaciones || 'No hay observaciones registradas para este proyecto.'}
              </p>
            </div>
          </div>

          {/* Budget Link if exists */}
          {proyecto.budget_id && (
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500 rounded-lg text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Presupuesto Vinculado</p>
                  <p className="text-[10px] text-indigo-500/70 font-mono">{proyecto.budget_id}</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 hover:bg-indigo-600 transition-all flex items-center gap-2">
                Abrir <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button 
            className="flex-1 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button 
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            onClick={() => setIsEditing(true)}
          >
            Editar Proyecto
          </button>
        </div>

      </div>
    </>
  );
}
