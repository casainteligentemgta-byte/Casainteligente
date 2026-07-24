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

function EditBtn({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="ml-1 inline-flex rounded-md p-1 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
      aria-label={label ?? 'Editar'}
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
      <p className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        No hay proveedores para los filtros seleccionados.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <th className="px-5 py-3.5">Proveedor</th>
            <th className="px-5 py-3.5 text-center">Facturas</th>
            <th className="px-5 py-3.5 text-right">Monto total</th>
            <th className="w-56 px-5 py-3.5">Participación</th>
          </tr>
        </thead>
        <tbody>
          {proveedores.map((grupo) => {
            const pct = gastoPeriodo > 0 ? (grupo.costo / gastoPeriodo) * 100 : 0;
            const abierto = abiertos.has(grupo.proveedor);
            return (
              <Fragment key={grupo.proveedor}>
                <tr
                  className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/60"
                  onClick={() => toggle(grupo.proveedor)}
                >
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      {abierto ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      {grupo.proveedor}
                      <EditBtn
                        label="Editar proveedor"
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
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                      {grupo.transacciones.length}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-bold tracking-tight text-slate-900">
                    {formatUsd(grupo.costo)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="w-11 text-right text-xs font-semibold text-slate-600">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-slate-50">
                  <td colSpan={4} className="p-0">
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        abierto ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <table className="w-full bg-slate-50/40 text-xs">
                        <thead>
                          <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            <th className="px-5 py-2 pl-14">Fecha</th>
                            <th className="px-3 py-2">Descripción</th>
                            <th className="px-3 py-2">Tipo</th>
                            <th className="px-3 py-2">Disciplina</th>
                            <th className="px-5 py-2 text-right">Costo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.transacciones.map((tx) => (
                            <tr key={tx.id} className="border-t border-slate-100/80 text-slate-700">
                              <td className="px-5 py-2.5 pl-14">
                                <span className="inline-flex items-center">
                                  {tx.fecha}
                                  <EditBtn
                                    onClick={() =>
                                      onEdit({ field: 'fecha', valorActual: tx.fecha, transactionId: tx.id })
                                    }
                                  />
                                </span>
                              </td>
                              <td className="max-w-[200px] truncate px-3 py-2.5" title={tx.descripcion}>
                                {tx.descripcion || '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center">
                                  {tx.tipo}
                                  <EditBtn
                                    onClick={() =>
                                      onEdit({ field: 'tipo', valorActual: tx.tipo, transactionId: tx.id })
                                    }
                                  />
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center">
                                  {tx.disciplina}
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
                              </td>
                              <td className="px-5 py-2.5 text-right font-semibold text-indigo-700">
                                <span className="inline-flex items-center justify-end">
                                  {formatUsd(tx.costo)}
                                  <EditBtn
                                    onClick={() =>
                                      onEdit({
                                        field: 'costo',
                                        valorActual: String(tx.costo),
                                        transactionId: tx.id,
                                      })
                                    }
                                  />
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
