'use client';

import { useState, useEffect } from 'react';
import { 
  X, Plus, Save, User, MapPin, 
  DollarSign, FileText, Loader2,
  Search, Check
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface NuevoProyectoDrawerProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function NuevoProyectoDrawer({ onClose, onSuccess }: NuevoProyectoDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [isFetchingClientes, setIsFetchingClientes] = useState(true);
  const [searchCliente, setSearchCliente] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    ubicacion_texto: '',
    customer_id: '',
    monto_aproximado: '',
    moneda: 'USD',
    estado: 'nuevo',
    observaciones: ''
  });

  const supabase = createClient();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    fetchClientes();
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  async function fetchClientes() {
    setIsFetchingClientes(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, nombre')
        .order('nombre', { ascending: true });
      
      if (error) throw error;
      if (data) setClientes(data);
    } catch (error) {
      console.error('Error fetching clientes:', error);
    } finally {
      setIsFetchingClientes(false);
    }
  }

  const clientesFiltrados = clientes.filter(c => 
    (c.nombre || '').toLowerCase().includes(searchCliente.toLowerCase())
  ).slice(0, 10); // Aumentar a 10 para mejor visibilidad

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.customer_id) {
      alert('Por favor completa los campos obligatorios (Nombre y Cliente)');
      return;
    }

    setIsLoading(true);
    const { error } = await supabase
      .from('ci_proyectos')
      .insert([{
        ...formData,
        nombre_proyecto: formData.nombre, // Sync both fields just in case
        monto_aproximado: formData.monto_aproximado ? parseFloat(formData.monto_aproximado) : null
      }]);

    if (error) {
      console.error('Error creating project:', error);
      alert('Error al crear el proyecto: ' + error.message);
    } else {
      onSuccess();
      onClose();
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[60] transition-opacity animate-fade-in-fast" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white dark:bg-slate-950 shadow-2xl z-[70] transform transition-transform border-l border-slate-200 dark:border-slate-800 flex flex-col slide-in-right">
        
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold dark:text-white">Nuevo Proyecto</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Nombre del Proyecto */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Proyecto *</label>
            <div className="relative">
              <FileText className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                required
                type="text" 
                placeholder="Ej. Residencia Los Olivos"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all dark:text-white"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>
          </div>

          {/* Seleccionar Cliente */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente Responsable *</label>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar cliente..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all dark:text-white mb-1"
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              />
              
              {/* Sugerencias de Clientes */}
              {(isFocused || searchCliente !== '' || isFetchingClientes) && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[250px] overflow-y-auto animate-in fade-in zoom-in duration-200">
                  {isFetchingClientes ? (
                    <div className="p-4 flex items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Cargando clientes...</span>
                    </div>
                  ) : clientesFiltrados.length > 0 ? (
                    clientesFiltrados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors
                          ${formData.customer_id === c.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'dark:text-slate-300'}
                        `}
                        onClick={() => {
                          setFormData({ ...formData, customer_id: c.id });
                          setSearchCliente(c.nombre);
                        }}
                      >
                        <div>
                          <p className="font-bold text-sm">{c.nombre}</p>
                          <p className="text-[10px] opacity-70">ID: {c.id.slice(0, 8)}</p>
                        </div>
                        {formData.customer_id === c.id && <Check className="w-4 h-4" />}
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-sm italic">
                      No se encontraron coincidencias
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ubicación */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ubicación / Dirección</label>
            <div className="relative">
              <MapPin className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Calle, Ciudad, Estado..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all dark:text-white"
                value={formData.ubicacion_texto}
                onChange={(e) => setFormData({ ...formData, ubicacion_texto: e.target.value })}
              />
            </div>
          </div>

          {/* Presupuesto y Moneda */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inversión Aprox.</label>
              <div className="relative">
                <DollarSign className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all dark:text-white"
                  value={formData.monto_aproximado}
                  onChange={(e) => setFormData({ ...formData, monto_aproximado: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Moneda</label>
              <select 
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all dark:text-white appearance-none cursor-pointer"
                value={formData.moneda}
                onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
              >
                <option value="USD">USD - Dólares</option>
                <option value="MXN">MXN - Pesos</option>
              </select>
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observaciones</label>
            <textarea 
              placeholder="Detalles adicionales del proyecto..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all dark:text-white resize-none"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            />
          </div>

        </form>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl font-bold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isLoading || !formData.nombre || !formData.customer_id}
            className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Crear Proyecto
          </button>
        </div>

      </div>
    </>
  );
}
