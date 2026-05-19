'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  acumuladoHastaMes,
  aplicaFiltros,
  aplicaFiltrosSinMes,
  agruparPorProveedor,
  evolucionPorMes,
  mesesUnicos,
  porDisciplina,
  sumCosto,
  top10PorTipo,
  valoresUnicos,
} from '@/lib/gastos-obra/gastosObraUtils';
import type { GastoObra, GastoObraEditableField, GastosObraFiltros } from '@/types/gastos-obra';
import { FILTRO_TODOS } from '@/types/gastos-obra';

function mapRow(row: Record<string, unknown>): GastoObra {
  return {
    id: String(row.id),
    fecha: String(row.fecha),
    tipo: String(row.tipo ?? ''),
    disciplina: String(row.disciplina ?? ''),
    proveedor: String(row.proveedor ?? ''),
    descripcion: String(row.descripcion ?? ''),
    costo: Number(row.costo) || 0,
  };
}

const filtrosIniciales: GastosObraFiltros = {
  mes: FILTRO_TODOS,
  tipo: FILTRO_TODOS,
  disciplina: FILTRO_TODOS,
};

export function useGastosObra() {
  const supabase = useMemo(() => createClient(), []);
  const [rawData, setRawData] = useState<GastoObra[]>([]);
  const [filtros, setFiltros] = useState<GastosObraFiltros>(filtrosIniciales);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase.from('gastos_obra').select('*').order('fecha', { ascending: false });

    if (qErr) {
      setError(qErr.message);
      setRawData([]);
    } else {
      setRawData((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filteredData = useMemo(() => aplicaFiltros(rawData, filtros), [rawData, filtros]);

  const opcionesMes = useMemo(() => mesesUnicos(rawData), [rawData]);
  const opcionesTipo = useMemo(() => valoresUnicos(rawData, 'tipo'), [rawData]);
  const opcionesDisciplina = useMemo(() => valoresUnicos(rawData, 'disciplina'), [rawData]);

  const kpis = useMemo(() => {
    const gastoTotal = sumCosto(rawData);
    const gastoPeriodo = sumCosto(filteredData);
    const acumulado =
      filtros.mes !== FILTRO_TODOS ? acumuladoHastaMes(rawData, filtros.mes) : gastoTotal;
    return {
      gastoTotal,
      acumulado,
      gastoPeriodo,
      transacciones: filteredData.length,
    };
  }, [rawData, filteredData, filtros.mes]);

  const chartEvolucion = useMemo(
    () => evolucionPorMes(aplicaFiltrosSinMes(rawData, filtros)),
    [rawData, filtros],
  );
  const chartTopTipo = useMemo(() => top10PorTipo(filteredData), [filteredData]);
  const chartDisciplina = useMemo(() => porDisciplina(filteredData), [filteredData]);
  const proveedores = useMemo(() => agruparPorProveedor(filteredData), [filteredData]);

  const actualizarCampo = useCallback(
    async (params: {
      field: GastoObraEditableField;
      nuevoValor: string;
      transactionId?: string;
      proveedorAnterior?: string;
    }) => {
      const { field, nuevoValor, transactionId, proveedorAnterior } = params;
      const valor = nuevoValor.trim();
      if (!valor) {
        toast.error('El valor no puede estar vacío');
        return false;
      }

      let q;
      if (field === 'proveedor' && proveedorAnterior && !transactionId) {
        q = await supabase.from('gastos_obra').update({ proveedor: valor }).eq('proveedor', proveedorAnterior);
      } else if (transactionId) {
        const payload: Record<string, string> = { [field]: valor };
        q = await supabase.from('gastos_obra').update(payload).eq('id', transactionId);
      } else {
        toast.error('Falta identificador de transacción');
        return false;
      }

      if (q.error) {
        toast.error(q.error.message);
        return false;
      }

      toast.success('Registro actualizado');
      await cargar();
      return true;
    },
    [supabase, cargar],
  );

  return {
    rawData,
    filteredData,
    filtros,
    setFiltros,
    loading,
    error,
    opcionesMes,
    opcionesTipo,
    opcionesDisciplina,
    kpis,
    chartEvolucion,
    chartTopTipo,
    chartDisciplina,
    proveedores,
    recargar: cargar,
    actualizarCampo,
  };
}
