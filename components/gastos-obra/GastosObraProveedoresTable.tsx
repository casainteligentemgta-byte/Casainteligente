'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import type { ProveedorAgrupado } from '@/lib/gastos-obra/gastosObraUtils';
import { formatUsd } from '@/lib/gastos-obra/gastosObraUtils';
import type { GastoObraEditableField } from '@/types/gastos-obra';

export type EditTarget = {
  field: GastoObraEditableField;
  valorActual: string;
  transactionId?: string;
  proveedorAnterior?: string;
  bulkProveedor?: boolean;
};

type Props = {
  proveedores: ProveedorAgrupado[];
  gastoPeriodo: number;
  onEdit: (target: EditTarget) => void;
};

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="ml-1 inline-flex rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-orange-600"
      aria-label="Editar"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  );
}

export default function GastosObraProveedoresTable({ proveedores, gastoPeriodo, onEdit }: Props) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  function toggle(proveedor: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(proveedor)) next.delete(proveedor);
      else next.add(proveedor);
      return next;
    });
  }

  if (proveedores.length === 0) {
    return (
      <p className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        No hay proveedores para los filtros seleccionados.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Proveedor</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="w-48 px-4 py-3">Participación</th>
          </tr>
        </thead>
        <tbody>
          {proveedores.map((grupo) => {
            const pct = gastoPeriodo > 0 ? (grupo.costo / gastoPeriodo) * 100 : 0;
            const abierto = abiertos.has(grupo.proveedor);
            return (
              <Fragment key={grupo.proveedor}>
                <tr
                  className="cursor-pointer border-b border-gray-50 hover:bg-gray-50/80"
                  onClick={() => toggle(grupo.proveedor)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <span className="inline-flex items-center gap-2">
                      {abierto ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      {grupo.proveedor}
                      <EditBtn
                        onClick={() =>
                          onEdit({
                            field: 'proveedor',
                            valorActual: grupo.proveedor,
                            proveedorAnterior: grupo.proveedor,
                            bulkProveedor: true,
                          })
                        }
                      />
                    </span>
                    <span className="ml-6 block text-xs font-normal text-gray-500">
                      {grupo.transacciones.length} transacción(es)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatUsd(grupo.costo)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-orange-500 transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs text-gray-600">{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
                {abierto
                  ? grupo.transacciones.map((tx) => (
                      <tr key={tx.id} className="border-b border-gray-50 bg-gray-50/50 text-gray-700">
                        <td className="px-4 py-2 pl-12" colSpan={3}>
                          <div className="grid gap-2 sm:grid-cols-5 sm:items-center">
                            <span className="inline-flex items-center text-xs">
                              <span className="text-gray-500">Fecha:</span>
                              <span className="ml-1">{tx.fecha}</span>
                              <EditBtn
                                onClick={() =>
                                  onEdit({ field: 'fecha', valorActual: tx.fecha, transactionId: tx.id })
                                }
                              />
                            </span>
                            <span className="inline-flex items-center text-xs sm:col-span-2">
                              <span className="text-gray-500">Desc:</span>
                              <span className="ml-1 truncate">{tx.descripcion || '—'}</span>
                            </span>
                            <span className="inline-flex items-center text-xs">
                              <span className="text-gray-500">Tipo:</span>
                              <span className="ml-1">{tx.tipo}</span>
                              <EditBtn
                                onClick={() =>
                                  onEdit({ field: 'tipo', valorActual: tx.tipo, transactionId: tx.id })
                                }
                              />
                            </span>
                            <span className="inline-flex items-center text-xs">
                              <span className="text-gray-500">Área:</span>
                              <span className="ml-1">{tx.disciplina}</span>
                              <EditBtn
                                onClick={() =>
                                  onEdit({
                                    field: 'disciplina',
                                    valorActual: tx.disciplina,
                                    transactionId: tx.id,
                                  })
                                }
                              />
                            </span>
                            <span className="text-right text-xs font-semibold text-orange-700">
                              {formatUsd(tx.costo)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}



