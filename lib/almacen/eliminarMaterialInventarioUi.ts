import { apiUrl } from '@/lib/http/apiUrl';

/** Confirma (si aplica) y elimina un material del inventario vía API. */
export async function confirmarYEliminarMaterialInventario(
  id: string,
  label: string,
  opciones?: { skipConfirm?: boolean },
): Promise<boolean> {
  const previewRes = await fetch(apiUrl(`/api/almacen/inventario/${encodeURIComponent(id)}`), {
    cache: 'no-store',
  });
  const preview = (await previewRes.json()) as {
    error?: string;
    total?: number;
    vinculos?: Record<string, number>;
  };
  if (!previewRes.ok) {
    throw new Error(preview.error || 'No se pudo consultar el material.');
  }

  if (!opciones?.skipConfirm) {
    const totalVinculos = Number(preview.total ?? 0);
    let mensajeConfirm = `¿Eliminar del inventario?\n\n${label}\n\nEsta acción no se puede deshacer.`;
    if (totalVinculos > 0) {
      const partes: string[] = [];
      const v = preview.vinculos ?? {};
      if (v.movimientos) partes.push(`${v.movimientos} movimiento(s) de stock`);
      if (v.comprasLineas) {
        partes.push(
          `${v.comprasLineas} línea(s) de compra${v.comprasFacturas ? ` (${v.comprasFacturas} factura(s))` : ''}`,
        );
      }
      if (v.transferenciasLineas) {
        partes.push(
          `${v.transferenciasLineas} línea(s) de transferencia${v.transferencias ? ` (${v.transferencias} transferencia(s))` : ''}`,
        );
      }
      if (v.egresosLineas) {
        partes.push(
          `${v.egresosLineas} línea(s) de egreso${v.egresos ? ` (${v.egresos} egreso(s))` : ''}`,
        );
      }
      if (v.recepcionesLineas) {
        partes.push(
          `${v.recepcionesLineas} línea(s) de recepción${v.recepciones ? ` (${v.recepciones} recepción(es))` : ''}`,
        );
      }
      if (v.stock) partes.push(`${v.stock} registro(s) de stock`);
      if (v.series) partes.push(`${v.series} número(s) de serie`);
      if (v.purchaseDetails) partes.push(`${v.purchaseDetails} línea(s) de cuarentena`);
      if (v.maquinaria) partes.push(`${v.maquinaria} ficha(s) de maquinaria`);
      mensajeConfirm =
        `Este material tiene registros vinculados:\n\n• ${partes.join('\n• ')}\n\n` +
        `¿Eliminar también esos movimientos, compras y demás registros?\n\n` +
        `Material: ${label}\n\nEsta acción no se puede deshacer.`;
    }

    if (!confirm(mensajeConfirm)) return false;
  }

  const delRes = await fetch(apiUrl(`/api/almacen/inventario/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
  const delBody = (await delRes.json()) as { error?: string };
  if (!delRes.ok) {
    throw new Error(delBody.error || 'Error al borrar el material.');
  }

  return true;
}
