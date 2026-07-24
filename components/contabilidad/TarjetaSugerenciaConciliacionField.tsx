'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';

type RecepcionPendiente = {
  id: string;
  num_doc: string;
  tipo: string;
  proveedor_nombre: string;
};

type ConciliacionProps = {
  facturaId: string;
  proyectoId: string;
  proveedorId?: string;
  proveedorRif?: string;
  proveedorNombre?: string;
  extracted?: ExtractedCanalHeader | null;
  onConciliadoExito: () => void;
  /** true cuando hay FRM sin conciliar (bloquea «Cargar compra» en el padre). */
  onFrmPendienteChange?: (hayFrmPendiente: boolean) => void;
};

function etiquetaTipo(tipo: string): string {
  if (tipo === 'nota_entrega') return 'Nota de entrega';
  if (tipo === 'emergencia') return 'Emergencia';
  return tipo || 'Campo';
}

export function TarjetaSugerenciaConciliacionField({
  facturaId,
  proyectoId,
  proveedorId,
  proveedorRif,
  proveedorNombre,
  extracted,
  onConciliadoExito,
  onFrmPendienteChange,
}: ConciliacionProps) {
  const [recepcionesPendientes, setRecepcionesPendientes] = useState<RecepcionPendiente[]>([]);
  const [cargando, setCargando] = useState(false);
  const { isSubmitting: isProcessing, runLocked } = useSyncSubmitLock();

  const buscar = useCallback(async () => {
    if (!proyectoId.trim()) {
      setRecepcionesPendientes([]);
      return;
    }
    if (!proveedorId?.trim() && !proveedorNombre?.trim() && !proveedorRif?.trim()) {
      setRecepcionesPendientes([]);
      return;
    }

    setCargando(true);
    try {
      const qs = new URLSearchParams({ proyecto_id: proyectoId });
      if (proveedorId?.trim()) qs.set('proveedor_id', proveedorId.trim());
      if (proveedorRif?.trim()) qs.set('proveedor_rif', proveedorRif.trim());
      if (proveedorNombre?.trim()) qs.set('proveedor_nombre', proveedorNombre.trim());

      const response = await fetch(`/api/almacen/recepcion/buscar-pendientes?${qs}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = (await response.json()) as { recepciones?: RecepcionPendiente[] };
        setRecepcionesPendientes(data.recepciones ?? []);
      } else {
        setRecepcionesPendientes([]);
      }
    } catch {
      setRecepcionesPendientes([]);
    } finally {
      setCargando(false);
    }
  }, [proyectoId, proveedorId, proveedorRif, proveedorNombre]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  useEffect(() => {
    if (!onFrmPendienteChange) return;
    if (!proyectoId.trim()) {
      onFrmPendienteChange(false);
      return;
    }
    if (cargando) return;
    onFrmPendienteChange(recepcionesPendientes.length > 0);
  }, [cargando, recepcionesPendientes.length, proyectoId, onFrmPendienteChange]);

  const ejecutarConciliacionAtomica = async (recepcionId: string) => {
    if (isProcessing) return;
    await runLocked(async () => {
      try {
        const res = await fetch('/api/contabilidad/compras/conciliar-frm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            factura_id: facturaId,
            recepcion_campo_id: recepcionId,
            ...(extracted ? { extracted } : {}),
          }),
        });

        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'Error en conciliación');

        toast.success(
          'Conciliación completada. La factura fiscal quedó en contabilidad sin duplicar el stock de obra.',
        );
        onConciliadoExito();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Error en conciliación.');
      }
    });
  };

  if (!proyectoId.trim()) return null;
  if (cargando) {
    return (
      <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Buscando ingresos previos en obra…
      </div>
    );
  }
  if (recepcionesPendientes.length === 0) return null;

  return (
    <div className="mb-4 p-4 rounded-lg bg-[#FF9500]/10 border border-[#FF9500]/20 backdrop-blur-xl">
      <p className="text-[10px] font-mono uppercase text-[#FF9500] font-bold tracking-wider">
        Alerta de contraloría: materiales ya detectados en obra
      </p>
      <p className="text-xs text-zinc-400 mt-1">
        El almacenista reportó ingresos manuales de este proveedor. Use conciliación en lugar de
        «Cargar compra» para no duplicar inventario.
      </p>
      <div className="mt-3 space-y-2">
        {recepcionesPendientes.map((rec) => (
          <div
            key={rec.id}
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-2 rounded bg-white/[0.02] border border-white/5 text-xs"
          >
            <span className="font-mono text-zinc-300">
              {rec.proveedor_nombre || 'Proveedor'} · {etiquetaTipo(rec.tipo)} ·{' '}
              {rec.num_doc || 'Sin número'}
            </span>
            <button
              type="button"
              onClick={() => void ejecutarConciliacionAtomica(rec.id)}
              disabled={isProcessing}
              className="shrink-0 px-3 py-1 bg-[#FF9500] text-black font-mono text-[10px] uppercase font-bold rounded hover:bg-[#FF9500]/90 transition-all disabled:opacity-40"
            >
              Conciliar e inyectar costo
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
