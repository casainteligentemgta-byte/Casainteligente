'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Plus } from 'lucide-react';
import AnalisisCostosProyecto from '@/components/finanzas/AnalisisCostosProyecto';
import { TarjetaBalanceBimonetarioFlotante } from '@/components/finanzas/TarjetaBalanceBimonetarioFlotante';
import RegistroAbonoClienteModal from '@/components/finanzas/RegistroAbonoClienteModal';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import {
  calcularSaldoFlotanteBimonetario,
  tasaCongeladaDesdeAbonos,
  type AbonoVesRef,
} from '@/lib/finanzas/calcularSaldoFlotanteBimonetario';
import { createClient } from '@/lib/supabase/client';

type Props = {
  proyectoId: string;
};

type FondosRow = {
  saldo_usd: number;
  saldo_ves: number;
  total_abonado_usd: number;
  total_abonado_ves: number;
};

export default function FinanzasProyectoPageClient({ proyectoId }: Props) {
  const { tasa: tasaHoy } = useTasaBcvHoy();
  const [nombre, setNombre] = useState<string | null>(null);
  const [fondos, setFondos] = useState<FondosRow | null>(null);
  const [abonosVes, setAbonosVes] = useState<AbonoVesRef[]>([]);
  const [abonoModalOpen, setAbonoModalOpen] = useState(false);

  const cargar = useCallback(async () => {
    const supabase = createClient();
    const [{ data: proy }, { data: fondosRow }, { data: abonos }] = await Promise.all([
      supabase.from('ci_proyectos').select('nombre').eq('id', proyectoId).maybeSingle(),
      supabase
        .from('ci_proyecto_fondos')
        .select('saldo_usd, saldo_ves, total_abonado_usd, total_abonado_ves')
        .eq('proyecto_id', proyectoId)
        .maybeSingle(),
      supabase
        .from('ci_proyecto_abonos')
        .select('monto_recibido, monto_usd, tasa_bcv, moneda')
        .eq('proyecto_id', proyectoId)
        .eq('moneda', 'VES')
        .order('fecha_abono', { ascending: false }),
    ]);

    setNombre(proy?.nombre ?? null);
    if (fondosRow) {
      setFondos({
        saldo_usd: Number(fondosRow.saldo_usd ?? 0),
        saldo_ves: Number(fondosRow.saldo_ves ?? 0),
        total_abonado_usd: Number(fondosRow.total_abonado_usd ?? 0),
        total_abonado_ves: Number(fondosRow.total_abonado_ves ?? 0),
      });
    } else {
      setFondos(null);
    }

    setAbonosVes(
      (abonos ?? []).map((a) => ({
        monto_recibido: Number((a as { monto_recibido?: unknown }).monto_recibido ?? 0),
        monto_usd: Number((a as { monto_usd?: unknown }).monto_usd ?? 0),
        tasa_bcv:
          (a as { tasa_bcv?: unknown }).tasa_bcv != null
            ? Number((a as { tasa_bcv?: unknown }).tasa_bcv)
            : null,
      })),
    );
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const saldoFlotante = useMemo(() => {
    if (!fondos?.saldo_ves) return null;
    return calcularSaldoFlotanteBimonetario(fondos.saldo_ves, tasaHoy, abonosVes);
  }, [fondos?.saldo_ves, tasaHoy, abonosVes]);

  const tasaOriginalAbono = useMemo(
    () => tasaCongeladaDesdeAbonos(abonosVes) ?? tasaHoy ?? 1,
    [abonosVes, tasaHoy],
  );

  const tieneSaldoVes = (fondos?.saldo_ves ?? 0) > 0;

  return (
    <>
      <div className="mt-4 space-y-4">
        {tieneSaldoVes ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <TarjetaBalanceBimonetarioFlotante
                saldoVesFondo={fondos?.saldo_ves ?? 0}
                saldoUsdFondo={fondos?.saldo_usd ?? 0}
                tasaOriginalAbono={saldoFlotante?.tasaCongelada ?? tasaOriginalAbono}
              />
            </div>
            <button
              type="button"
              onClick={() => setAbonoModalOpen(true)}
              className="inline-flex shrink-0 select-none items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-900/50 touch-manipulation"
            >
              <Plus className="h-4 w-4" />
              Registrar abono
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#0A0A0F] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Capital del cliente
                </p>
                <p className="mt-2 text-2xl font-black text-zinc-100">
                  $
                  {(fondos?.saldo_usd ?? 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                  <span className="ml-2 text-sm font-semibold text-zinc-500">USD consolidado</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbonoModalOpen(true)}
                className="inline-flex select-none items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-900/50 touch-manipulation"
              >
                <Plus className="h-4 w-4" />
                Registrar abono
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-[11px] text-zinc-500">
          <Banknote className="h-3.5 w-3.5" />
          Abonos acumulados: $
          {(fondos?.total_abonado_usd ?? 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })}
        </div>
      </div>

      <div className="mt-6">
        <AnalisisCostosProyecto proyectoId={proyectoId} />
      </div>

      <RegistroAbonoClienteModal
        open={abonoModalOpen}
        onClose={() => setAbonoModalOpen(false)}
        proyectoId={proyectoId}
        proyectoNombre={nombre}
        onAbonoRegistrado={() => void cargar()}
      />
    </>
  );
}
