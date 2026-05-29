'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Plus } from 'lucide-react';
import AnalisisCostosProyecto from '@/components/finanzas/AnalisisCostosProyecto';
import RegistroAbonoClienteModal from '@/components/finanzas/RegistroAbonoClienteModal';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import {
  calcularSaldoFlotanteBimonetario,
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

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function FinanzasProyectoPageClient({ proyectoId }: Props) {
  const { tasa: tasaHoy, loading: cargandoTasa } = useTasaBcvHoy();
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
        tasa_bcv: (a as { tasa_bcv?: unknown }).tasa_bcv != null
          ? Number((a as { tasa_bcv?: unknown }).tasa_bcv)
          : null,
      })),
    );
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const saldoFlotante = useMemo(() => {
    if (!fondos?.saldo_ves || cargandoTasa) return null;
    return calcularSaldoFlotanteBimonetario(fondos.saldo_ves, tasaHoy, abonosVes);
  }, [fondos?.saldo_ves, tasaHoy, abonosVes, cargandoTasa]);

  return (
    <>
      <div className="mt-4 rounded-2xl border border-white/10 bg-[#0A0A0F] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Capital del cliente
            </p>
            <p className="mt-2 text-2xl font-black text-zinc-100">
              ${(fondos?.saldo_usd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="ml-2 text-sm font-semibold text-zinc-500">USD consolidado</span>
            </p>
            {(fondos?.saldo_ves ?? 0) > 0 ? (
              <>
                <p className="mt-1 text-sm text-amber-400">
                  Bs {(fondos?.saldo_ves ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}{' '}
                  en custodia VES
                </p>
                {saldoFlotante ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Equivalente hoy: {fmtUsd(saldoFlotante.usdHoy)} USD · tasa BCV{' '}
                    {saldoFlotante.tasaHoy.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                ) : null}
                {saldoFlotante && saldoFlotante.perdidaUsd > 0.01 ? (
                  <p className="mt-2 text-sm text-rose-500/80">
                    Pérdida por fluctuación: -{fmtUsd(saldoFlotante.perdidaUsd)} USD
                  </p>
                ) : null}
              </>
            ) : null}
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
        <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
          <Banknote className="h-3.5 w-3.5" />
          Abonos acumulados: $
          {(fondos?.total_abonado_usd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
