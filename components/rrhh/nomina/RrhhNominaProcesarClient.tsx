'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, CheckCircle2, ChevronRight, FileText, Loader2, Save, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';

type PeriodoRow = {
  id: string;
  descripcion: string;
  tipo_nomina: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  total_asignaciones: number;
  total_deducciones: number;
  total_neto: number;
};

type ReciboRow = {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  empleado_cedula: string;
  empleado_cargo: string;
  salario_base_mensual: number;
  total_asignaciones: number;
  total_deducciones: number;
  total_neto: number;
  estado: string;
  conceptos?: ConceptoRow[];
};

type ConceptoRow = {
  id?: string;
  tipo: 'asignacion' | 'deduccion';
  codigo_concepto: string;
  descripcion: string;
  cantidad: number;
  monto: number;
};

export default function RrhhNominaProcesarClient() {
  const searchParams = useSearchParams();
  const periodoId = searchParams.get('id');
  const supabase = useMemo(() => createClient(), []);

  const [periodo, setPeriodo] = useState<PeriodoRow | null>(null);
  const [recibos, setRecibos] = useState<ReciboRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculando, setCalculando] = useState(false);

  const cargar = useCallback(async () => {
    if (!periodoId) return;
    setLoading(true);

    const { data: pData } = await supabase
      .from('ci_nomina_periodos')
      .select('*')
      .eq('id', periodoId)
      .single();

    if (pData) {
      setPeriodo(pData as PeriodoRow);
    }

    const { data: rData } = await supabase
      .from('ci_nomina_recibos')
      .select('*, conceptos:ci_nomina_conceptos(*)')
      .eq('periodo_id', periodoId)
      .order('empleado_nombre');

    if (rData) {
      setRecibos(rData as ReciboRow[]);
    }

    setLoading(false);
  }, [periodoId, supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Motor Matemático Simple de Nómina
  const calcularNomina = async () => {
    if (!periodo) return;
    setCalculando(true);
    toast.info('Iniciando motor de cálculo matemático...');

    try {
      // 1. Obtener empleados activos
      // (Para simplificar, buscamos los que están en ci_personal_activos y son del tipo de la nómina)
      const { data: empleadosActivos } = await supabase
        .from('ci_empleados')
        .select('id, nombre_completo, cedula, cargo, salario_mensual, status')
        .in('status', ['activo', 'contratado']);

      if (!empleadosActivos || empleadosActivos.length === 0) {
        toast.error('No hay empleados activos para procesar.');
        setCalculando(false);
        return;
      }

      // 2. Por cada empleado, calcular.
      const factorDias = periodo.tipo_nomina === 'quincenal' ? 15 : 7;
      
      const nuevosRecibos: Omit<ReciboRow, 'id'>[] = [];

      for (const emp of empleadosActivos) {
        const salarioMes = emp.salario_mensual || 130; // 130 BsS / $ base legal si es nulo
        const salarioDiario = salarioMes / 30;
        const salarioPeriodo = salarioDiario * factorDias;

        const conceptos: ConceptoRow[] = [];

        // --- ASIGNACIONES ---
        // Salario Base
        conceptos.push({
          tipo: 'asignacion',
          codigo_concepto: 'SAL_BAS',
          descripcion: `Salario Base (${factorDias} días)`,
          cantidad: factorDias,
          monto: salarioPeriodo
        });

        // --- DEDUCCIONES LEGALES ---
        // SSO (4%) - Sobre límite de 5 salarios mínimos
        const deduccionSSO = salarioPeriodo * 0.04;
        conceptos.push({
          tipo: 'deduccion',
          codigo_concepto: 'SSO_04',
          descripcion: 'Retención S.S.O. (4%)',
          cantidad: 1,
          monto: deduccionSSO
        });

        // Régimen Prestacional de Empleo / Paro Forzoso (0.5%)
        const deduccionRPE = salarioPeriodo * 0.005;
        conceptos.push({
          tipo: 'deduccion',
          codigo_concepto: 'RPE_05',
          descripcion: 'Retención R.P.E. (0.5%)',
          cantidad: 1,
          monto: deduccionRPE
        });

        // FAOV (1%)
        const deduccionFAOV = salarioPeriodo * 0.01;
        conceptos.push({
          tipo: 'deduccion',
          codigo_concepto: 'FAOV_1',
          descripcion: 'Retención F.A.O.V. (1%)',
          cantidad: 1,
          monto: deduccionFAOV
        });

        // Sumar
        const tAsignaciones = conceptos.filter(c => c.tipo === 'asignacion').reduce((s, c) => s + c.monto, 0);
        const tDeducciones = conceptos.filter(c => c.tipo === 'deduccion').reduce((s, c) => s + c.monto, 0);
        const tNeto = tAsignaciones - tDeducciones;

        nuevosRecibos.push({
          empleado_id: emp.id,
          empleado_nombre: emp.nombre_completo,
          empleado_cedula: emp.cedula || 'N/A',
          empleado_cargo: emp.cargo || 'N/A',
          salario_base_mensual: salarioMes,
          total_asignaciones: tAsignaciones,
          total_deducciones: tDeducciones,
          total_neto: tNeto,
          estado: 'generado',
          conceptos: conceptos
        });
      }

      // 3. Guardar en Base de Datos (Insertar Recibos y luego Conceptos)
      // Primero limpiamos los anteriores si es borrador
      await supabase.from('ci_nomina_recibos').delete().eq('periodo_id', periodo.id);

      let sumNetoGlobal = 0;
      let sumAsigGlobal = 0;
      let sumDedGlobal = 0;

      for (const rec of nuevosRecibos) {
        sumNetoGlobal += rec.total_neto;
        sumAsigGlobal += rec.total_asignaciones;
        sumDedGlobal += rec.total_deducciones;

        const { data: iRec, error: eRec } = await supabase.from('ci_nomina_recibos').insert({
          periodo_id: periodo.id,
          empleado_id: rec.empleado_id,
          empleado_nombre: rec.empleado_nombre,
          empleado_cedula: rec.empleado_cedula,
          empleado_cargo: rec.empleado_cargo,
          salario_base_mensual: rec.salario_base_mensual,
          total_asignaciones: rec.total_asignaciones,
          total_deducciones: rec.total_deducciones,
          total_neto: rec.total_neto
        }).select('id').single();

        if (iRec && rec.conceptos) {
          const concToInsert = rec.conceptos.map(c => ({ ...c, recibo_id: iRec.id }));
          await supabase.from('ci_nomina_conceptos').insert(concToInsert);
        }
      }

      // Actualizar Totales del Periodo
      await supabase.from('ci_nomina_periodos').update({
        total_asignaciones: sumAsigGlobal,
        total_deducciones: sumDedGlobal,
        total_neto: sumNetoGlobal
      }).eq('id', periodo.id);

      toast.success(`Cálculo exitoso: ${nuevosRecibos.length} recibos generados.`);
      void cargar();
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error en el cálculo');
    } finally {
      setCalculando(false);
    }
  };

  const aprobarNomina = async () => {
    if (!periodo) return;
    if (!confirm('¿Seguro que desea Aprobar esta nómina? No se podrán recalcular los recibos.')) return;
    
    await supabase.from('ci_nomina_periodos').update({ estado: 'aprobada' }).eq('id', periodo.id);
    toast.success('Nómina Aprobada');
    void cargar();
  };

  if (loading) {
    return <div className="p-16 text-center text-zinc-500">Cargando datos del periodo...</div>;
  }

  if (!periodo) {
    return <div className="p-16 text-center text-zinc-500">Periodo no encontrado.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8">
      <header className="mb-6 border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/rrhh/nomina" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
            Nómina
          </Link>
          <ChevronRight className="h-3 w-3 text-zinc-600" />
          <span className="text-xs font-semibold text-zinc-400">Procesar Periodo</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{periodo.descripcion}</h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                periodo.estado === 'borrador' ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'
              }`}>
                {periodo.estado}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              {periodo.tipo_nomina.toUpperCase()} | {new Date(periodo.fecha_inicio).toLocaleDateString()} al {new Date(periodo.fecha_fin).toLocaleDateString()}
            </p>
          </div>
          
          <div className="flex gap-2">
            {periodo.estado === 'borrador' && (
              <>
                <button
                  onClick={calcularNomina}
                  disabled={calculando}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600/20 border border-violet-500/50 px-4 py-2 text-sm font-bold text-violet-300 hover:bg-violet-600/30 disabled:opacity-50"
                >
                  {calculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Correr Motor de Nómina
                </button>
                <button
                  onClick={aprobarNomina}
                  disabled={recibos.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aprobar
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[10px] font-bold uppercase text-zinc-500">Total Recibos</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
            <Users className="h-5 w-5 text-zinc-400" />
            {recibos.length}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[10px] font-bold uppercase text-zinc-500">Asignaciones</p>
          <p className="mt-1 text-xl font-bold text-sky-400">${Number(periodo.total_asignaciones).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[10px] font-bold uppercase text-zinc-500">Deducciones</p>
          <p className="mt-1 text-xl font-bold text-red-400">${Number(periodo.total_deducciones).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <p className="text-[10px] font-bold uppercase text-emerald-500">Neto a Pagar</p>
          <p className="mt-1 text-2xl font-black text-emerald-400">${Number(periodo.total_neto).toLocaleString()}</p>
        </div>
      </div>

      {/* Lista de Recibos Generados */}
      <h2 className="text-lg font-bold text-white mb-4">Detalle de Recibos</h2>
      
      {recibos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/20 p-12 text-center text-zinc-500">
          Haz clic en "Correr Motor de Nómina" para calcular los pagos de los trabajadores en este periodo.
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-black/40 text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="p-3 font-semibold">Trabajador</th>
                <th className="p-3 font-semibold text-right">Base Mensual</th>
                <th className="p-3 font-semibold text-right text-sky-400/70">Asignaciones</th>
                <th className="p-3 font-semibold text-right text-red-400/70">Deducciones</th>
                <th className="p-3 font-semibold text-right text-emerald-400/70">Neto</th>
                <th className="p-3 font-semibold text-center">Recibo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recibos.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-zinc-200">{r.empleado_nombre}</div>
                    <div className="text-[11px] text-zinc-500">{r.empleado_cedula} · {r.empleado_cargo}</div>
                  </td>
                  <td className="p-3 text-right text-zinc-400 font-mono">${r.salario_base_mensual.toFixed(2)}</td>
                  <td className="p-3 text-right text-sky-300 font-mono">${r.total_asignaciones.toFixed(2)}</td>
                  <td className="p-3 text-right text-red-300 font-mono">${r.total_deducciones.toFixed(2)}</td>
                  <td className="p-3 text-right text-emerald-300 font-bold font-mono">${r.total_neto.toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <button className="text-zinc-500 hover:text-white p-1 rounded hover:bg-white/10" title="Ver PDF">
                      <FileText className="h-4 w-4 inline-block" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}