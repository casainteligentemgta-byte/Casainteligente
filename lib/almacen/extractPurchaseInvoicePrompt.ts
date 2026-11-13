const EXTRACTION_PROMPT = `Extrae datos de esta factura o nota de entrega venezolana.

MONEDA: Los montos de la factura están en BOLÍVARES (VES). quantity, unit_price y total_amount son siempre en Bs, sin convertir a dólares.

OBLIGATORIO — Tabla de detalle (cuerpo de la factura):
- Lee TODAS las filas de la tabla: Descripción/Concepto/Artículo, Cantidad, Precio unitario.
- Cada fila va en items[] con:
  - description: nombre o descripción del artículo tal como en la factura (sin inventar).
  - item_code: código o referencia del producto si hay columna Código/Ref ("" si no hay).
  - unit: unidad de medida (UND, KG, M, PZA, etc.; "UND" si no aparece).
  - quantity: cantidad numérica (usa 1 si no aparece).
  - unit_price: precio unitario sin IVA. Si solo hay subtotal de línea, divide subtotal/cantidad.
- NO omitas filas. NO incluyas subtotales, IVA, descuentos globales ni "Total" como ítem.
- Si la tabla tiene muchas filas, inclúyelas todas.

Encabezado:
- invoice_number, supplier_name, supplier_rif (emisor, no el cliente), date (YYYY-MM-DD), total_amount (total en Bs, con IVA si así figura en el documento).
- receptor_nombre y receptor_rif: el cliente o comprador a nombre de quien está la factura (bloque "Cliente", "Razón social del comprador", "Señores"). Si no figura, "".
- document_kind: "nota_entrega" si el documento dice "nota de entrega" (o equivalente) O no trae precios / todos los precios están en 0. "factura" si es factura fiscal con precios.

El proveedor es quien EMITE la factura, no el comprador.`;

export const PROMPT_ALBUM_PARTES = `
IMÁGENES: son PARTES SOLAPADAS de la MISMA factura, en orden de arriba hacia abajo (o de la primera a la última página).
- Combínalas en UN solo documento. No trates cada foto como una factura distinta.
- Las zonas de recorte entre fotos consecutivas se SOLAPAN: si un producto aparece en dos fotos seguidas, inclúyelo UNA sola vez.
- Extrae TODAS las líneas distintas. El total_amount es el total de la factura (casi siempre en la última foto).
- Si el total no se ve, deja total_amount en 0. No inventes el total.`;

export function promptExtraccionConHint(hint?: string | null, album = false): string {
  const base = album ? `${EXTRACTION_PROMPT}\n${PROMPT_ALBUM_PARTES}` : EXTRACTION_PROMPT;
  const h = String(hint ?? '').trim();
  if (!h) return base;
  return `${base}

MEMORIA DE PROVEEDORES CONOCIDOS (úsalo SOLO si el emisor del documento coincide; no inventes datos que no estén en la foto):
${h}`;
}

export { EXTRACTION_PROMPT };
