'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnalisisConsumo from '@/components/flota/gasolina/AnalisisConsumo';
import RegistroGasolina, { type GasolinaFormValues } from '@/components/flota/gasolina/RegistroGasolina';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/http/apiUrl';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import type { FlotaConductor } from '@/lib/flota/conductores';
import type { AnalisisConsumo as Analisis, FlotaGasolina } from '@/lib/flota/gasolina';
import { formatoFechaVe, formatoMonedaUsd, type FlotaVehiculo } from '@/lib/flota/utils';

export default function FlotaGasolinaPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState<FlotaGasolina[]>([]);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [vehiculos, setVehiculos] = useState<FlotaVehiculo[]>([]);
  const [conductores, setConductores] = useState<FlotaConductor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl('/api/flota/gasolina'), { credentials: 'include' });
    if (res.status === 401) {
      router.push('/login?next=/flota/gasolina');
      return;
    }
    const json = await parseFetchJson<{
      registros?: FlotaGasolina[];
      analisis?: Analisis;
      vehiculos?: FlotaVehiculo[];
      conductores?: FlotaConductor[];
      hint?: string;
      error?: string;
    }>(res);
    if (!res.ok) throw new Error(formatApiErrorBody(json));
    setRegistros(json.registros ?? []);
    setAnalisis(json.analisis ?? null);
    setVehiculos(json.vehiculos ?? []);
    setConductores(json.conductores ?? []);
    setHint(json.hint ?? null);
  }, [router]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Error'));
  }, [load]);

  async function registrar(values: GasolinaFormValues) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/flota/gasolina'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maquinaria_id: values.maquinaria_id,
          cantidad_litros: values.cantidad_litros,
          costo_total: values.costo_total,
          km_actual: values.km_actual,
          tipo_gasolina: values.tipo_gasolina,
          estacion_gasolina: values.estacion_gasolina,
          conductor_id: values.conductor_id,
          fecha: values.fecha,
          notas: values.notas,
        }),
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
        <h2 className="text-lg font-semibold text-white">Gasolina</h2>
        <p className="text-sm text-zinc-500">Cargas por unidad y consumo km/l entre odómetros.</p>
      </div>
      {hint ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{hint}</p>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <RegistroGasolina vehiculos={vehiculos} conductores={conductores} saving={saving} onSubmit={registrar} />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Análisis de consumo</h3>
        <AnalisisConsumo analisis={analisis} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Últimas cargas</h3>
        {registros.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin registros.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Litros</TableHead>
                <TableHead>Km</TableHead>
                <TableHead>USD</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatoFechaVe(r.fecha)}</TableCell>
                  <TableCell className="text-white">{r.vehiculo?.placa ?? '—'}</TableCell>
                  <TableCell>{r.litros}</TableCell>
                  <TableCell>{r.odometro_km ?? '—'}</TableCell>
                  <TableCell>{formatoMonedaUsd(r.monto_usd)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm('¿Eliminar esta carga?')) return;
                        await fetch(apiUrl(`/api/flota/gasolina/${r.id}`), {
                          method: 'DELETE',
                          credentials: 'include',
                        });
                        await load();
                      }}
                    >
                      Quitar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
