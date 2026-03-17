'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, LoaderCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function InventarioView() {
  const [inventario, setInventario] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [savingCompra, setSavingCompra] = useState(false);
  const [formCompra, setFormCompra] = useState({ id_inventario: '', cantidad: 1, costo_unitario: 0, proveedor: '' });

  const supabase = createClient();

  useEffect(() => {
    const fetchInventario = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tb_inventario')
        .select('*')
        .order('nombre', { ascending: true });
        
      if (!error && data) {
        setInventario(data);
      }
      setIsLoading(false);
    };

    fetchInventario();

    const channel = supabase
      .channel('realtime_inventario_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tb_inventario' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setInventario((prev) => [...prev, payload.new as any]);
          } else if (payload.eventType === 'UPDATE') {
            setInventario((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setInventario((prev) =>
              prev.filter((item) => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const inventarioFiltrado = useMemo(() => {
    return inventario.filter(item => 
      item.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventario, searchTerm]);

  const handleGuardarEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompra(true);

    const { error } = await supabase
      .from('tb_compras')
      .insert({
        id_inventario: formCompra.id_inventario,
        cantidad: Number(formCompra.cantidad),
        costo_unitario: Number(formCompra.costo_unitario),
        proveedor: formCompra.proveedor,
      });

    if (error) {
       console.error("Error al registrar compra:", error);
       alert("Hubo un error al registrar la compra");
    } else {
       setModalOpen(false);
       setFormCompra({ id_inventario: '', cantidad: 1, costo_unitario: 0, proveedor: '' });
    }
    
    setSavingCompra(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
            Inventario en Tiempo Real
            {isLoading && <LoaderCircle className="w-5 h-5 animate-spin text-blue-500" />}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gestiona existencias de "Casa Inteligente" y registra compras.</p>
        </div>
        
        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm shadow-blue-500/30 transition-all w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5" />
          Nueva Entrada
        </button>
      </div>

      <div className="relative w-full sm:w-96">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar producto o SKU..."
          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all dark:text-white shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4 font-bold">SKU / Producto</th>
                <th className="px-6 py-4 font-bold text-center">Stock Actual</th>
                <th className="px-6 py-4 font-bold">Criticidad</th>
                <th className="px-6 py-4 font-bold text-right">Costo Promedio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {inventarioFiltrado.length === 0 && !isLoading ? (
                 <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                       No se encontraron productos en el inventario.
                    </td>
                 </tr>
              ) : inventarioFiltrado.map((item) => {
                const isUnderstock = item.stock_actual < item.stock_minimo;
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{item.nombre}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-xs font-mono mt-0.5">{item.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="font-bold text-lg dark:text-white">
                        {item.stock_actual}
                      </div>
                      <div className="text-slate-400 font-medium text-xs">Min: {item.stock_minimo}</div>
                    </td>
                    <td className="px-6 py-4">
                      {isUnderstock ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Bajo Stock
                        </div>
                      ) : (
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                          Stock OK
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-medium dark:text-white">
                      ${Number(item.costo_promedio).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in-fast">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-bold mb-1 dark:text-white">Registrar Compra</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">El stock se actualizará automáticamente.</p>
            
            <form onSubmit={handleGuardarEntrada} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 dark:text-slate-300">Producto a ingresar</label>
                <select 
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  value={formCompra.id_inventario}
                  onChange={e => setFormCompra({...formCompra, id_inventario: e.target.value})}
                >
                  <option value="">Selecciona un producto...</option>
                  {inventario.map(item => (
                    <option key={item.id} value={item.id}>{item.nombre} (Stock: {item.stock_actual})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 dark:text-slate-300">Cantidad</label>
                  <input 
                    type="number" min="1" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    value={formCompra.cantidad}
                    onChange={e => setFormCompra({...formCompra, cantidad: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 dark:text-slate-300">Costo Unit. ($)</label>
                  <input 
                    type="number" step="0.01" min="0" required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    value={formCompra.costo_unitario}
                    onChange={e => setFormCompra({...formCompra, costo_unitario: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 dark:text-slate-300">Proveedor</label>
                <input 
                  type="text" required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  value={formCompra.proveedor}
                  onChange={e => setFormCompra({...formCompra, proveedor: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)} 
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={savingCompra}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/30 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {savingCompra ? <LoaderCircle className="w-5 h-5 animate-spin" /> : 'Procesar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
