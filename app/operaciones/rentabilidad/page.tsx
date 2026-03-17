'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DollarSign, TrendingUp, AlertTriangle, PieChart } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function AnálisisRentabilidad() {
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ facturado: 0, costo: 0, utilidad: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadAnalytics() {
      const { data, error } = await supabase
        .from('vw_analisis_rentabilidad')
        .select('*')
        .order('utilidad_neta', { ascending: false });

      if (data) {
        setProyectos(data);

        const totalFacturado = data.reduce((acc, curr) => acc + Number(curr.total_facturado), 0);
        const totalCosto = data.reduce((acc, curr) => acc + Number(curr.costo_total_operativo), 0);
        setKpis({
          facturado: totalFacturado,
          costo: totalCosto,
          utilidad: totalFacturado - totalCosto
        });

        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dataPorMes = data.reduce((acc, curr) => {
           const mesIndex = curr.mes_creacion - 1;
           const mesNombre = meses[mesIndex];
           if(!acc[mesNombre]) acc[mesNombre] = { name: mesNombre, Utilidad: 0 };
           acc[mesNombre].Utilidad += Number(curr.utilidad_neta);
           return acc;
        }, {} as Record<string, any>);
        
        setChartData(Object.values(dataPorMes));
      }
    }
    loadAnalytics();
  }, [supabase]);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  return (
    <div className="space-y-8 animate-fade-in p-2 md:p-6">
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold dark:text-white mb-2">Análisis de Rentabilidad</h1>
        <p className="text-slate-500">Monitor de salud financiera de proyectos de Casa Inteligente.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-sm font-semibold text-slate-500 uppercase">Total Facturado</p>
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-lg"><DollarSign className="w-5 h-5"/></div>
          </div>
          <h3 className="text-3xl font-bold mt-4 dark:text-white">{formatCurrency(kpis.facturado)}</h3>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-sm font-semibold text-slate-500 uppercase">Costo Total Operativo</p>
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-lg"><PieChart className="w-5 h-5"/></div>
          </div>
          <h3 className="text-3xl font-bold mt-4 dark:text-white">{formatCurrency(kpis.costo)}</h3>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-sm font-semibold text-slate-500 uppercase">Utilidad Neta Total</p>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg"><TrendingUp className="w-5 h-5"/></div>
          </div>
          <h3 className="text-3xl font-bold mt-4 text-emerald-600 dark:text-emerald-400">{formatCurrency(kpis.utilidad)}</h3>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <h3 className="text-lg font-bold mb-6 dark:text-white">Tendencia de Utilidad Mensual</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
              <YAxis tickFormatter={(val) => `$${val / 1000}k`} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <Tooltip 
                cursor={{fill: '#f1f5f9', opacity: 0.1}}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [formatCurrency(value as number), "Utilidad"]}
              />
              <Bar dataKey="Utilidad" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold dark:text-white">Márgenes por Proyecto</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
             <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-xs">
               <tr>
                 <th className="px-6 py-4">Proyecto</th>
                 <th className="px-6 py-4 text-right">Facturado</th>
                 <th className="px-6 py-4 text-right">Costos</th>
                 <th className="px-6 py-4 text-right">Utilidad</th>
                 <th className="px-6 py-4 text-center">Margen (%)</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
               {proyectos.map((p) => {
                 const isAlert = p.margen_porcentaje < 15;
                 
                 return (
                   <tr key={p.proyecto_id} className={`transition-colors
                     ${isAlert ? 'bg-orange-50/50 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'}
                   `}>
                     <td className="px-6 py-4 font-semibold dark:text-slate-100">
                       <div className="flex items-center gap-2">
                         {isAlert && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                         {p.proyecto_nombre}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-right dark:text-slate-300">{formatCurrency(p.total_facturado)}</td>
                     <td className="px-6 py-4 text-right dark:text-slate-300">{formatCurrency(p.costo_total_operativo)}</td>
                     <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                       {formatCurrency(p.utilidad_neta)}
                     </td>
                     <td className="px-6 py-4 text-center">
                       <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border 
                          ${isAlert 
                            ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30' 
                            : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'}
                       `}>
                         {p.margen_porcentaje}%
                       </span>
                     </td>
                   </tr>
                 );
               })}
             </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
