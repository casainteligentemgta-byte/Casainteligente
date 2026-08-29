'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnalisisConsumo as Analisis } from '@/lib/flota/gasolina';
import { formatoBs, formatoFechaVe, formatoMonedaUsd } from '@/lib/flota/utils';

export default function AnalisisConsumo({ analisis }: { analisis: Analisis | null }) {
  if (!analisis || analisis.total_cargas === 0) {
    return <p className="text-sm text-zinc-500">Sin cargas suficientes para analizar consumo.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Cargas" value={String(analisis.total_cargas)} />
        <Stat label="Litros" value={String(analisis.total_litros)} />
        <Stat label="Promedio km/l" value={analisis.promedio_km_l != null ? String(analisis.promedio_km_l) : '—'} />
        <Stat label="USD" value={formatoMonedaUsd(analisis.total_usd)} />
      </div>
      <p className="text-xs text-zinc-500">
        Periodo {formatoFechaVe(analisis.desde)} — {formatoFechaVe(analisis.hasta)}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unidad</TableHead>
            <TableHead>Cargas</TableHead>
            <TableHead>Litros</TableHead>
            <TableHead>Km</TableHead>
            <TableHead>km/l</TableHead>
            <TableHead>USD</TableHead>
            <TableHead>Bs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {analisis.por_vehiculo.map((v) => (
            <TableRow key={v.vehiculo_id}>
              <TableCell className="text-white">{v.etiqueta}</TableCell>
              <TableCell>{v.cargas}</TableCell>
              <TableCell>{v.litros}</TableCell>
              <TableCell>{v.km}</TableCell>
              <TableCell className={v.km_por_litro != null && v.km_por_litro < 4 ? 'text-amber-300' : 'text-zinc-200'}>
                {v.km_por_litro ?? '—'}
              </TableCell>
              <TableCell>{formatoMonedaUsd(v.monto_usd)}</TableCell>
              <TableCell>{formatoBs(v.monto_bs)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
