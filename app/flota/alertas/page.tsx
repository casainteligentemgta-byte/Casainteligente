'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AlertasPanel from '@/components/flota/alertas/AlertasPanel';
import ConfigurarAlertas from '@/components/flota/alertas/ConfigurarAlertas';
import { apiUrl } from '@/lib/http/apiUrl';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import type { FlotaAlerta, FlotaAlertaConfig } from '@/lib/flota/alertas';

export default function FlotaAlertasPage() {
  const router = useRouter();
  const [alertas, setAlertas] = useState<FlotaAlerta[]>([]);
  const [config, setConfig] = useState<FlotaAlertaConfig[]>([]);
  const [generando, setGenerando] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl('/api/flota/alertas'), { credentials: 'include' });
    if (res.status === 401) {
      router.push('/login?next=/flota/alertas');
      return;
    }
    const json = await parseFetchJson<{
      alertas?: FlotaAlerta[];
      config?: FlotaAlertaConfig[];
      hint?: string;
      error?: string;
    }>(res);
    if (!res.ok) throw new Error(formatApiErrorBody(json));
    setAlertas(json.alertas ?? []);
    setConfig(json.config ?? []);
    setHint(json.hint ?? null);
  }, [router]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Error'));
  }, [load]);

  async function patchAlerta(id: string, body: Record<string, unknown>) {
    const res = await fetch(apiUrl(`/api/flota/alertas/${id}`), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Alertas</h2>
        <p className="text-sm text-zinc-500">Vencimientos de documentos, servicios y consumo anómalo.</p>
      </div>
      {hint ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <AlertasPanel
        alertas={alertas}
        generando={generando}
        onGenerar={async () => {
          setGenerando(true);
          setError(null);
          try {
            const res = await fetch(apiUrl('/api/flota/alertas'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accion: 'generar' }),
            });
            const json = await parseFetchJson<{ error?: string }>(res);
            if (!res.ok) throw new Error(formatApiErrorBody(json));
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudieron generar');
          } finally {
            setGenerando(false);
          }
        }}
        onLeida={(id) => void patchAlerta(id, { leida: true })}
        onResolver={(id) => void patchAlerta(id, { resuelta: true, leida: true })}
      />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Configuración</h3>
        <ConfigurarAlertas
          configs={config}
          savingId={savingId}
          onSave={async (id, patch) => {
            setSavingId(id);
            try {
              const res = await fetch(apiUrl(`/api/flota/alertas/${id}`), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recurso: 'config', ...patch }),
              });
              const json = await parseFetchJson<{ error?: string }>(res);
              if (!res.ok) throw new Error(formatApiErrorBody(json));
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo guardar');
            } finally {
              setSavingId(null);
            }
          }}
        />
      </section>
    </div>
  );
}
