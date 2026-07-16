'use client';

import { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  normalizarDiagnosticoDescalce,
  type DiagnosticoDescalceRow,
} from '@/lib/procuras/diagnosticoDescalceProcuras';

function fmtUsd(n: number): string {
  if (!n) return '—';
  return `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBs(n: number): string {
  if (!n) return '—';
  return `Bs.${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTasa(n: number): string {
  if (!n) return '—';
  return `${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Bs/USD`;
}

export default function PanelAuditoriaProcuras() {
  const [loading, setLoading] = useState(false);
  const [reporte, setReporte] = useState<DiagnosticoDescalceRow[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ejecutarDiagnostico = async () => {
    setLoading(true);
    setStatusMsg('');
    setError(null);
    setReporte([]);

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc(
        'ci_diagnostico_descalce_procuras' as 'ci_registrar_ingreso_manual_campo',
      );

      if (rpcError) {
        console.error('[PanelAuditoriaProcuras]', rpcError);
        const hint = /42883|does not exist|permission denied/i.test(rpcError.message)
          ? ' Verifique migraciones 255–257 y que la sesión esté autenticada.'
          : '';
        setError(`${rpcError.message}${hint}`);
        return;
      }

      const filas = normalizarDiagnosticoDescalce(data);
      setReporte(filas);
      if (filas.length === 0) {
        setStatusMsg('✅ Todo en orden. No se detectaron descalces cambiarios en procuras.');
      } else {
        setStatusMsg(`⚠️ Alerta: se encontraron ${filas.length} registro(s) sospechoso(s).`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red al ejecutar el diagnóstico.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <ShieldAlert size={18} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white">
              Auditoría Cambiaria Expresa
            </h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-xl">
              Verifica descalces nominales o errores bimonetarios en procuras vinculadas a compras
              (RPC <span className="font-mono text-zinc-400">ci_diagnostico_descalce_procuras</span>).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void ejecutarDiagnostico()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border border-[#FF9500]/40 bg-[#FF9500]/15 text-[#FF9500] hover:bg-[#FF9500]/25 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Analizando Base de Datos…
            </>
          ) : (
            'Correr Diagnóstico'
          )}
        </button>
      </div>

      {error ? (
        <div className="p-3 text-sm rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
          ❌ {error}
        </div>
      ) : null}

      {statusMsg ? (
        <div className="p-3 text-sm rounded-xl border border-white/10 bg-[#0A0A0F]/80 text-zinc-300">
          {statusMsg}
        </div>
      ) : null}

      {reporte.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-zinc-500">
                <th className="text-left p-3">Procura</th>
                <th className="text-right p-3">Est. USD</th>
                <th className="text-right p-3">Real VES</th>
                <th className="text-right p-3">Real USD</th>
                <th className="text-right p-3">Tasa BCV</th>
                <th className="text-right p-3">Desviación</th>
              </tr>
            </thead>
            <tbody>
              {reporte.map((row) => (
                <tr
                  key={row.procura_id}
                  className="border-b border-white/[0.06] hover:bg-white/[0.02]"
                  title={row.procura_id}
                >
                  <td className="p-3 font-mono text-xs text-[#FF9500]">
                    {row.ticket ?? row.procura_id.slice(0, 8)}
                  </td>
                  <td className="p-3 text-right tabular-nums text-zinc-200">
                    {fmtUsd(row.monto_estimado_usd)}
                  </td>
                  <td className="p-3 text-right tabular-nums text-zinc-400">{fmtBs(row.real_ves)}</td>
                  <td className="p-3 text-right tabular-nums text-zinc-200">{fmtUsd(row.real_usd)}</td>
                  <td className="p-3 text-right tabular-nums text-zinc-400">{fmtTasa(row.tasa_bcv)}</td>
                  <td className="p-3 text-right tabular-nums font-semibold text-rose-400">
                    {fmtUsd(row.desviacion_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
