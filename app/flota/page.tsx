'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FLOTA_INPUT, FLOTA_LABEL } from '@/components/flota/FlotaShell';
import { apiUrl } from '@/lib/http/apiUrl';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import { TIPOS_VEHICULO, etiquetaVehiculo, type FlotaVehiculo } from '@/lib/flota/utils';
import type { FlotaConductor } from '@/lib/flota/conductores';
import type { FlotaAlerta } from '@/lib/flota/alertas';

export default function FlotaResumenPage() {
  const router = useRouter();
  const [vehiculos, setVehiculos] = useState<FlotaVehiculo[]>([]);
  const [conductores, setConductores] = useState<FlotaConductor[]>([]);
  const [alertas, setAlertas] = useState<FlotaAlerta[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [tipo, setTipo] = useState('camioneta');
  const [odometro, setOdometro] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const [cRes, aRes] = await Promise.all([
      fetch(apiUrl('/api/flota/conductores'), { credentials: 'include' }),
      fetch(apiUrl('/api/flota/alertas'), { credentials: 'include' }),
    ]);
    if (cRes.status === 401) {
      router.push('/login?next=/flota');
      return;
    }
    const cJson = await parseFetchJson<{
      conductores?: FlotaConductor[];
      vehiculos?: FlotaVehiculo[];
      hint?: string;
      error?: string;
    }>(cRes);
    if (!cRes.ok) throw new Error(formatApiErrorBody(cJson));
    setConductores(cJson.conductores ?? []);
    setVehiculos(cJson.vehiculos ?? []);
    setHint(cJson.hint ?? null);

    if (aRes.ok) {
      const aJson = await parseFetchJson<{ alertas?: FlotaAlerta[] }>(aRes);
      setAlertas(aJson.alertas ?? []);
    }
  }, [router]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, [load]);

  return (
    <div className="space-y-6">
      {hint ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {hint}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile href="/flota/conductores" label="Unidades" value={vehiculos.length} />
        <Tile href="/flota/conductores" label="Conductores" value={conductores.filter((c) => c.activo).length} />
        <Tile href="/flota/alertas" label="Alertas" value={alertas.filter((a) => !a.resuelta).length} />
        <Tile href="/flota/chatbot" label="Mecánico" value="IA" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Registrar unidad</h2>
        <form
          className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError(null);
            try {
              const res = await fetch(apiUrl('/api/flota/conductores'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recurso: 'vehiculo',
                  placa,
                  marca,
                  modelo,
                  tipo,
                  odometro_km: odometro,
                }),
              });
              const json = await parseFetchJson<{ error?: string }>(res);
              if (!res.ok) throw new Error(formatApiErrorBody(json));
              setPlaca('');
              setMarca('');
              setModelo('');
              setOdometro('');
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo guardar');
            } finally {
              setSaving(false);
            }
          }}
        >
          <div>
            <label className={FLOTA_LABEL}>Placa</label>
            <input className={FLOTA_INPUT} required value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="AB123CD" />
          </div>
          <div>
            <label className={FLOTA_LABEL}>Tipo</label>
            <select className={FLOTA_INPUT} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_VEHICULO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={FLOTA_LABEL}>Marca</label>
            <input className={FLOTA_INPUT} value={marca} onChange={(e) => setMarca(e.target.value)} />
          </div>
          <div>
            <label className={FLOTA_LABEL}>Modelo</label>
            <input className={FLOTA_INPUT} value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </div>
          <div>
            <label className={FLOTA_LABEL}>Odómetro (km)</label>
            <input className={FLOTA_INPUT} inputMode="decimal" value={odometro} onChange={(e) => setOdometro(e.target.value)} />
          </div>
          <div className="flex items-end justify-end">
            <Button type="submit" variant="elitePrimary" disabled={saving}>
              {saving ? 'Guardando…' : 'Agregar unidad'}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white">Unidades</h2>
        {vehiculos.length === 0 ? (
          <p className="text-sm text-zinc-500">Registre la primera placa para empezar.</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {vehiculos.map((v) => (
              <li key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div>
                  <p className="text-white">{etiquetaVehiculo(v)}</p>
                  <p className="text-xs text-zinc-500">
                    {v.tipo} · {v.odometro_km} km
                  </p>
                </div>
                <Link href="/flota/gasolina" className="text-xs text-amber-300 hover:underline">
                  Cargar gasolina
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ href, label, value }: { href: string; label: string; value: number | string }) {
  return (
    <Link href={href} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </Link>
  );
}
