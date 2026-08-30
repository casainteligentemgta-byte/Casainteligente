'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HistorialMantenimiento from '@/components/flota/mantenimiento/HistorialMantenimiento';
import RegistroMantenimiento, {
  type MantenimientoFormValues,
} from '@/components/flota/mantenimiento/RegistroMantenimiento';
import { apiUrl } from '@/lib/http/apiUrl';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import type { FlotaMantenimiento } from '@/lib/flota/mantenimiento';
import type { FlotaVehiculo } from '@/lib/flota/utils';

export default function FlotaMantenimientoPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState<FlotaMantenimiento[]>([]);
  const [vehiculos, setVehiculos] = useState<FlotaVehiculo[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl('/api/flota/mantenimiento'), { credentials: 'include' });
    if (res.status === 401) {
      router.push('/login?next=/flota/mantenimiento');
      return;
    }
    const json = await parseFetchJson<{
      registros?: FlotaMantenimiento[];
      vehiculos?: FlotaVehiculo[];
      hint?: string;
      error?: string;
    }>(res);
    if (!res.ok) throw new Error(formatApiErrorBody(json));
    setRegistros(json.registros ?? []);
    setVehiculos(json.vehiculos ?? []);
    setHint(json.hint ?? null);
  }, [router]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Error'));
  }, [load]);

  async function registrar(values: MantenimientoFormValues) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/flota/mantenimiento'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(formatApiErrorBody(json));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Mantenimiento</h2>
        <p className="text-sm text-zinc-500">Servicios de taller y próximo intervalo (fecha o km).</p>
      </div>
      {hint ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <RegistroMantenimiento vehiculos={vehiculos} saving={saving} onSubmit={registrar} />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Historial</h3>
        <HistorialMantenimiento
          items={registros}
          onDelete={async (id) => {
            if (!confirm('¿Eliminar este servicio?')) return;
            await fetch(apiUrl(`/api/flota/mantenimiento/${id}`), {
              method: 'DELETE',
              credentials: 'include',
            });
            await load();
          }}
        />
      </section>
    </div>
  );
}
