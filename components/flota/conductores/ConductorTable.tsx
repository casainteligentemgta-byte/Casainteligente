'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FlotaConductor } from '@/lib/flota/conductores';
import { diasHasta, etiquetaConductor, formatoFechaVe } from '@/lib/flota/utils';

function badgeVence(fecha: string | null) {
  const d = diasHasta(fecha);
  if (d == null) return <span className="text-zinc-500">—</span>;
  const cls =
    d < 0
      ? 'text-red-300'
      : d <= 15
        ? 'text-amber-300'
        : 'text-zinc-300';
  return (
    <span className={cls}>
      {formatoFechaVe(fecha)}
      {d < 0 ? ' · vencida' : d <= 15 ? ` · ${d}d` : ''}
    </span>
  );
}

export default function ConductorTable({
  items,
  onEdit,
  onDelete,
  onSelect,
  selectedId,
}: {
  items: FlotaConductor[];
  selectedId?: string | null;
  onEdit: (c: FlotaConductor) => void;
  onDelete: (c: FlotaConductor) => void;
  onSelect?: (c: FlotaConductor) => void;
}) {
  if (!items.length) {
    return <p className="text-sm text-zinc-500">No hay conductores registrados.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Conductor</TableHead>
          <TableHead>Cédula</TableHead>
          <TableHead>Licencia</TableHead>
          <TableHead>Cert. médico</TableHead>
          <TableHead>Unidad</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((c) => (
          <TableRow
            key={c.id}
            data-state={selectedId === c.id ? 'selected' : undefined}
            className="cursor-pointer"
            onClick={() => onSelect?.(c)}
          >
            <TableCell>
              <div className="font-medium text-white">{etiquetaConductor(c)}</div>
              <div className="text-xs text-zinc-500">{c.telefono || c.email || '—'}</div>
              {!c.activo ? <div className="text-[10px] uppercase text-zinc-600">Inactivo</div> : null}
            </TableCell>
            <TableCell className="text-zinc-300">{c.cedula || '—'}</TableCell>
            <TableCell>
              <div className="text-xs text-zinc-400">{c.tipo_licencia || '—'}</div>
              {badgeVence(c.licencia_vence)}
            </TableCell>
            <TableCell>{badgeVence(c.certificado_medico_vence)}</TableCell>
            <TableCell className="text-zinc-300">{c.vehiculo?.placa || '—'}</TableCell>
            <TableCell className="text-right">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(c);
                }}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Eliminar"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c);
                }}
              >
                <Trash2 />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
