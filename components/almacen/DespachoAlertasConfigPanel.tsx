'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, ChevronDown, ChevronUp, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  DESPACHO_ALERTAS_DEFAULT,
  type DespachoAlertasConfig,
} from '@/lib/almacen/despachoAlertasConfig';

type Props = {
  proyectoId: string;
  onConfigChange?: (config: DespachoAlertasConfig) => void;
};

export function DespachoAlertasConfigPanel({ proyectoId, onConfigChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [personalizado, setPersonalizado] = useState(false);
  const [defaults, setDefaults] = useState<DespachoAlertasConfig>({ ...DESPACHO_ALERTAS_DEFAULT });
  const [config, setConfig] = useState<DespachoAlertasConfig>({ ...DESPACHO_ALERTAS_DEFAULT });

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ proyecto_id: proyectoId });
      const res = await fetch(`/api/almacen/despacho-alertas?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as {
        config?: DespachoAlertasConfig;
        defaults?: DespachoAlertasConfig;
        personalizado?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar configuración');
      const cfg = data.config ?? DESPACHO_ALERTAS_DEFAULT;
      const defs = data.defaults ?? DESPACHO_ALERTAS_DEFAULT;
      setDefaults(defs);
      setConfig(cfg);
      setPersonalizado(Boolean(data.personalizado));
      onConfigChange?.(cfg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
      setConfig({ ...DESPACHO_ALERTAS_DEFAULT });
      onConfigChange?.(DESPACHO_ALERTAS_DEFAULT);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, onConfigChange]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch('/api/almacen/despacho-alertas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          ...config,
        }),
      });
      const data = (await res.json()) as { config?: DespachoAlertasConfig; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      const cfg = data.config ?? config;
      setConfig(cfg);
      setPersonalizado(true);
      onConfigChange?.(cfg);
      toast.success('Umbrales de alerta guardados para esta obra');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const restaurar = () => {
    setConfig({ ...defaults });
  };

  if (!proyectoId) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          <Bell className="h-3.5 w-3.5" />
          Alarmas de despacho
          {personalizado ? (
            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
              personalizado
            </span>
          ) : (
            <span className="rounded bg-zinc-500/15 px-1.5 py-0.5 text-[9px] font-bold text-zinc-400">
              por defecto
            </span>
          )}
        </span>
        {abierto ? (
          <ChevronUp className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        )}
      </button>

      {abierto ? (
        <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3">
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando…
            </p>
          ) : (
            <>
              <p className="text-[11px] text-zinc-500">
                Exceso presupuestario (faltante) y saldo sin asignar en origen. Aplica solo a este
                proyecto.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">
                    Advertencia (% exceso)
                  </span>
                  <input
                    type="number"
                    min={0.1}
                    max={500}
                    step={0.5}
                    value={config.excesoAdvertenciaPct}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        excesoAdvertenciaPct: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">
                    Crítico (% exceso)
                  </span>
                  <input
                    type="number"
                    min={0.1}
                    max={500}
                    step={0.5}
                    value={config.excesoCriticoPct}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        excesoCriticoPct: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">
                    Saldo informativo (% línea)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={config.saldoInformativoPct}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        saldoInformativoPct: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void guardar()}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-100 hover:bg-white/15 disabled:opacity-40"
                >
                  {guardando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Guardar para esta obra
                </button>
                <button
                  type="button"
                  onClick={restaurar}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Valores por defecto
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default DespachoAlertasConfigPanel;
