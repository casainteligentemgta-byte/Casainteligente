'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FlotaMantenimiento } from '@/lib/flota/mantenimiento';
import { ETIQUETA_TIPO_MANTENIMIENTO, formatoFechaVe, formatoMonedaUsd } from '@/lib/flota/utils';

export default function HistorialMantenimiento({
  items,
  onDelete,
}: {
  items: FlotaMantenimiento[];
  onDelete: (id: string) => void;
}) {
  if (!items.length) {
    return <p className="text-sm text-zinc-500">Sin servicios registrados.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Unidad</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Km</TableHead>
          <TableHead>Próximo</TableHead>
          <TableHead>USD</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="text-zinc-300">{formatoFechaVe(m.fecha)}</TableCell>
            <TableCell className="text-white">{m.vehiculo?.placa ?? '—'}</TableCell>
            <TableCell>
              <div className="text-zinc-200">{ETIQUETA_TIPO_MANTENIMIENTO[m.tipo]}</div>
              {m.descripcion ? <div className="text-xs text-zinc-500">{m.descripcion}</div> : null}
            </TableCell>
            <TableCell>{m.odometro_km ?? '—'}</TableCell>
            <TableCell className="text-xs text-zinc-400">
              {m.proximo_fecha ? formatoFechaVe(m.proximo_fecha) : ''}
              {m.proximo_odometro_km != null ? `${m.proximo_fecha ? ' · ' : ''}${m.proximo_odometro_km} km` : ''}
              {!m.proximo_fecha && m.proximo_odometro_km == null ? '—' : ''}
            </TableCell>
            <TableCell>{formatoMonedaUsd(m.costo_usd)}</TableCell>
            <TableCell className="text-right">
              <Button type="button" size="icon" variant="ghost" aria-label="Eliminar" onClick={() => onDelete(m.id)}>
                <Trash2 />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
