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
  top10PorProveedor,
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

export const FILTROS_INICIALES: GastosObraFiltros = {
  mes: FILTRO_TODOS,
  tipo: FILTRO_TODOS,
  disciplina: FILTRO_TODOS,
};

/**
 * Hook principal: lectura de `gastos_obra`, filtros reactivos en cliente,
 * KPIs derivados y persistencia con actualización optimista del estado local.
 */
export function useGastosObra() {
  const supabase = useMemo(() => createClient(), []);
  const [rawData, setRawData] = useState<GastoObra[]>([]);
  const [filtros, setFiltros] = useState<GastosObraFiltros>(FILTROS_INICIALES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from('gastos_obra')
      .select('id, fecha, tipo, disciplina, proveedor, descripcion, costo')
      .order('fecha', { ascending: false });

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

  const limpiarFiltros = useCallback(() => {
    setFiltros(FILTROS_INICIALES);
  }, []);

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
  const chartTopProveedor = useMemo(() => top10PorProveedor(filteredData), [filteredData]);
  const chartDisciplina = useMemo(() => porDisciplina(filteredData), [filteredData]);
  const proveedores = useMemo(() => agruparPorProveedor(filteredData), [filteredData]);

  const hayFiltrosActivos =
    filtros.mes !== FILTRO_TODOS ||
    filtros.tipo !== FILTRO_TODOS ||
    filtros.disciplina !== FILTRO_TODOS;

  const patchLocal = useCallback(
    (field: GastoObraEditableField, valor: string | number, transactionId?: string, proveedorAnterior?: string) => {
      setRawData((prev) => {
        if (field === 'proveedor' && proveedorAnterior && !transactionId) {
          return prev.map((r) =>
            r.proveedor === proveedorAnterior ? { ...r, proveedor: String(valor) } : r,
          );
        }
        if (!transactionId) return prev;
        return prev.map((r) => {
          if (r.id !== transactionId) return r;
          if (field === 'costo') return { ...r, costo: Number(valor) };
          return { ...r, [field]: String(valor) };
        });
      });
    },
    [],
  );

  const actualizarCampo = useCallback(
    async (params: {
      field: GastoObraEditableField;
      nuevoValor: string;
      transactionId?: string;
      proveedorAnterior?: string;
    }) => {
      const { field, nuevoValor, transactionId, proveedorAnterior } = params;
      const valorStr = nuevoValor.trim();
      if (!valorStr) {
        toast.error('El valor no puede estar vacío');
        return false;
      }

      let payload: Record<string, string | number>;
      if (field === 'costo') {
        const n = Number(valorStr.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) {
          toast.error('Ingresa un monto válido');
          return false;
        }
        payload = { costo: n };
      } else {
        payload = { [field]: valorStr };
      }

      let q;
      if (field === 'proveedor' && proveedorAnterior && !transactionId) {
        q = await supabase.from('gastos_obra').update({ proveedor: valorStr }).eq('proveedor', proveedorAnterior);
      } else if (transactionId) {
        q = await supabase.from('gastos_obra').update(payload).eq('id', transactionId);
      } else {
        toast.error('Falta identificador de transacción');
        return false;
      }

      if (q.error) {
        toast.error(q.error.message);
        return false;
      }

      const valorPatch = field === 'costo' ? Number(payload.costo) : valorStr;
      patchLocal(field, valorPatch, transactionId, proveedorAnterior);
      toast.success('Registro actualizado');
      return true;
    },
    [supabase, patchLocal],
  );

  return {
    rawData,
    filteredData,
    filtros,
    setFiltros,
    limpiarFiltros,
    hayFiltrosActivos,
    loading,
    error,
    opcionesMes,
    opcionesTipo,
    opcionesDisciplina,
    kpis,
    chartEvolucion,
    chartTopTipo,
    chartTopProveedor,
    chartDisciplina,
    proveedores,
    recargar: cargar,
    actualizarCampo,
  };
}

export { useGastosObra as useGastos };
