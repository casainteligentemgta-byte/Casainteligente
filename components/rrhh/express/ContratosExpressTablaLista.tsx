'use client';

import {
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import AccionesContratoPdfFila from '@/components/rrhh/AccionesContratoPdfFila';
import { Button } from '@/components/ui/button';

export type ExpressListaRow = {
  id: string;
  created_at: string;
  obrero_nombre: string;
  obrero_cedula: string;
  cargo_nombre_snapshot?: string | null;
  formalizado_empleado_id?: string | null;
  pdf_firmado_storage_path?: string | null;
  pdf_firmado_subido_at?: string | null;
};

type Props = {
  rows: ExpressListaRow[];
  selectedIds: Set<string>;
  todosSeleccionados: boolean;
  busyDeleteId: string | null;
  busyFormalizarId: string | null;
  busyEscaneoId: string | null;
  onToggleTodos: () => void;
  onToggleUno: (id: string) => void;
  onVerEscaneoFirmado: (id: string) => void;
  onPedirEscaneo: (id: string) => void;
  onFormalizar: (id: string, nombre: string) => void;
  onEditar: (id: string) => void;
  onEliminar: (id: string, nombre: string) => void;
};

/** Tabla de contratos express de una obra (lista + acciones). */
export default function ContratosExpressTablaLista({
  rows,
  selectedIds,
  todosSeleccionados,
  busyDeleteId,
  busyFormalizarId,
  busyEscaneoId,
  onToggleTodos,
  onToggleUno,
  onVerEscaneoFirmado,
  onPedirEscaneo,
  onFormalizar,
  onEditar,
  onEliminar,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-amber-500/20 bg-black/25">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-amber-500/25 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">
            <th className="w-10 px-2 py-2.5 text-center">
              <input
                type="checkbox"
                checked={todosSeleccionados}
                onChange={onToggleTodos}
                aria-label="Seleccionar todos"
                className="size-3.5 accent-amber-500"
              />
            </th>
            <th className="px-3 py-2.5">Fecha</th>
            <th className="px-3 py-2.5">Obrero</th>
            <th className="px-3 py-2.5">Cédula</th>
            <th className="px-3 py-2.5">Cargo</th>
            <th className="px-3 py-2.5 text-center">PDF</th>
            <th className="px-3 py-2.5 text-center">Firmado</th>
            <th className="px-3 py-2.5 text-center">Expediente</th>
            <th className="px-3 py-2.5 text-center">Editar</th>
            <th className="px-3 py-2.5 text-right">Borrar</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tieneFirmado = Boolean(String(r.pdf_firmado_storage_path ?? '').trim());
            const formalizado = Boolean(r.formalizado_empleado_id);
            return (
              <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => onToggleUno(r.id)}
                    aria-label={`Seleccionar ${r.obrero_nombre}`}
                    className="size-3.5 accent-amber-500"
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                  {new Date(r.created_at).toLocaleDateString('es-VE')}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-100">{r.obrero_nombre}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">{r.obrero_cedula}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {r.cargo_nombre_snapshot ?? '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <AccionesContratoPdfFila
                    empleadoRowId={`ci-express-${r.id}`}
                    nombreObrero={r.obrero_nombre}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="inline-flex items-center justify-center gap-1">
                    {tieneFirmado ? (
                      <>
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-950/40 px-1.5 py-1 text-[10px] font-bold text-emerald-200"
                          title={
                            r.pdf_firmado_subido_at
                              ? `Subido ${new Date(r.pdf_firmado_subido_at).toLocaleString('es-VE')}`
                              : 'Escaneo firmado cargado'
                          }
                        >
                          <CheckCircle2 className="size-3" aria-hidden />
                          Sí
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-emerald-700/45 bg-emerald-950/20 px-2 text-xs text-emerald-100"
                          onClick={() => onVerEscaneoFirmado(r.id)}
                          title="Ver escaneo firmado"
                          aria-label={`Ver escaneo firmado de ${r.obrero_nombre}`}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyEscaneoId === r.id}
                      className="h-8 border-violet-700/50 bg-violet-950/30 px-2 text-xs text-violet-100"
                      onClick={() => onPedirEscaneo(r.id)}
                      title={
                        tieneFirmado
                          ? 'Reemplazar escaneo firmado'
                          : 'Subir contrato escaneado firmado'
                      }
                      aria-label={`Subir escaneo firmado de ${r.obrero_nombre}`}
                    >
                      {busyEscaneoId === r.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Upload className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  {formalizado ? (
                    <span
                      className="inline-flex items-center rounded-md border border-sky-500/35 bg-sky-950/40 px-1.5 py-1 text-[10px] font-bold text-sky-100"
                      title="Ya tiene expediente en Talento"
                    >
                      OK
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyFormalizarId === r.id}
                      className="h-8 border-sky-700/50 bg-sky-950/30 px-2 text-xs text-sky-100"
                      onClick={() => onFormalizar(r.id, r.obrero_nombre)}
                      title="Crear expediente en Talento (formalizar)"
                      aria-label={`Formalizar contrato de ${r.obrero_nombre}`}
                    >
                      {busyFormalizarId === r.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="size-3.5" />
                      )}
                    </Button>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-amber-700/50 bg-amber-950/25 px-2 text-xs text-amber-100"
                    onClick={() => onEditar(r.id)}
                    title="Editar datos del contrato"
                    aria-label={`Editar datos de ${r.obrero_nombre}`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyDeleteId === r.id}
                    className="h-8 border-red-900/55 bg-red-950/30 px-2 text-xs text-red-200"
                    onClick={() => onEliminar(r.id, r.obrero_nombre)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
