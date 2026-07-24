'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { isValidProyectoUuid } from '@/lib/proyectos/validarProyectoUuid';
import { formatApiErrorBody, formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type {
  LuloGasto,
  LuloPartida,
  LuloProyectoMeta,
  LuloResumenNativo,
  LuloSnapshotDetail,
  LuloSnapshotMeta,
} from '@/lib/proyectos/lulo/luloProyectoTypes';

export function useLuloProyectoData(proyectoId: string) {
  const [loading, setLoading] = useState(true);
  const [partidas, setPartidas] = useState<LuloPartida[]>([]);
  const [gastos, setGastos] = useState<LuloGasto[]>([]);
  const [snapshots, setSnapshots] = useState<LuloSnapshotMeta[]>([]);
  const [snapshotDetail, setSnapshotDetail] = useState<LuloSnapshotDetail | null>(null);
  const [resumenNativo, setResumenNativo] = useState<LuloResumenNativo>({
    apuLineas: 0,
    insumosEnApu: 0,
    insumosMaestroTotal: 0,
  });
  const [proyectoMeta, setProyectoMeta] = useState<LuloProyectoMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!isValidProyectoUuid(proyectoId)) return;
      const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/lulo`);
      const data = await parseFetchJson<{
        error?: string;
        partidas?: LuloPartida[];
        gastos?: LuloGasto[];
        snapshots?: LuloSnapshotMeta[];
        resumenNativo?: Partial<LuloResumenNativo>;
        proyecto?: LuloProyectoMeta;
      }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(data, 'Error al cargar datos Lulo'));
      setPartidas(data.partidas ?? []);
      setGastos(data.gastos ?? []);
      setResumenNativo({
        apuLineas: data.resumenNativo?.apuLineas ?? 0,
        insumosEnApu: data.resumenNativo?.insumosEnApu ?? 0,
        insumosMaestroTotal: data.resumenNativo?.insumosMaestroTotal ?? 0,
      });
      setProyectoMeta(data.proyecto ?? null);
      const snaps = data.snapshots ?? [];
      setSnapshots(snaps);
      if (snaps[0]?.id) {
        const snapRes = await fetch(`/api/proyectos/lulo/snapshots/${snaps[0].id}`);
        const snapData = await parseFetchJson<{
          error?: string;
          id: string;
          nombre_archivo: string;
          payload: LuloSnapshotDetail['payload'];
        }>(snapRes);
        if (snapRes.ok) {
          setSnapshotDetail({
            id: snapData.id,
            payload: snapData.payload,
            nombre_archivo: snapData.nombre_archivo,
          });
        }
      } else {
        setSnapshotDetail(null);
      }
    } catch (e) {
      toast.error(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSnapshot = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/proyectos/lulo/snapshots/${id}`);
      const data = await parseFetchJson<{
        error?: string;
        id: string;
        nombre_archivo: string;
        payload: LuloSnapshotDetail['payload'];
      }>(res);
      if (!res.ok) throw new Error(data.error ?? 'No se pudo abrir el volcado');
      setSnapshotDetail({
        id: data.id,
        payload: data.payload,
        nombre_archivo: data.nombre_archivo,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir el volcado');
    }
  }, []);

  const deleteSnapshot = useCallback(
    async (id: string, nombre: string) => {
      if (!window.confirm(`¿Borrar el volcado "${nombre}"? No borra partidas ni gastos ya importados.`))
        return;
      const res = await fetch(`/api/proyectos/lulo/snapshots/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('No se pudo borrar el volcado');
        return;
      }
      setSnapshots((s) => s.filter((x) => x.id !== id));
      if (snapshotDetail?.id === id) setSnapshotDetail(null);
      toast.success('Volcado eliminado');
    },
    [snapshotDetail?.id],
  );

  return {
    loading,
    partidas,
    gastos,
    snapshots,
    snapshotDetail,
    resumenNativo,
    proyectoMeta,
    load,
    loadSnapshot,
    deleteSnapshot,
  };
}
