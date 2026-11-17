const EXTRACTION_PROMPT = `Extrae datos de esta factura o nota de entrega venezolana.

ORIENTACIÓN: la foto puede estar rotada, inclinada o tomada de lado. Oriéntala mentalmente (0°, 90°, 180° o 270°) ANTES de leer. No dejes de extraer porque el documento esté de costado.

MONEDA: Los montos de la factura están en BOLÍVARES (VES). quantity, unit_price y total_amount son siempre en Bs, sin convertir a dólares.

OBLIGATORIO — Tabla de detalle (cuerpo de la factura o nota):
- Lee las filas que tengan CANTIDAD realmente escrita (manuscrita o impresa en esa celda).
- IGNORA renglones preimpresos vacíos: formularios con lista fija (arena, arrocillo, piedra, polvillo, relleno, tejas, bloques, tabelones, placas, agua, cemento, fletes, otros, etc.) donde la celda de cantidad está en blanco. Esos renglones NO van en items[].
- NO inventes cantidad 1. Si no hay cantidad visible en esa fila, NO la incluyas (o quantity=0 y quantity_present=false).
- NO copies la unidad del ENCABEZADO de columna cuando la celda de unidad de esa fila está vacía. Si no hay unidad en la fila, unit="".
- Cantidades COMPUESTAS: si una fila tiene más de una cantidad (p. ej. «4 pallet» y «1/2 saco»), pon quantity_parts[] con cada una (quantity, unit, label) y quantity_raw con el texto tal cual. quantity = la primera cantidad leída. NO te quedes solo con la fracción.
- Cada fila incluida va en items[] con:
  - description: nombre o descripción del artículo tal como en el documento (sin inventar; no confundas palabras parecidas, p. ej. POLVILLO ≠ BOMBILLO).
  - item_code: código o referencia del producto si hay columna Código/Ref ("" si no hay).
  - unit: unidad de medida de ESA FILA (UND, KG, M, PZA, PALLET, SACO, etc.; "" si no aparece en la fila).
  - quantity: cantidad numérica leída en esa fila (0 si no hay).
  - quantity_present: true SOLO si hay cantidad visible en esa fila.
  - quantity_raw: texto de la(s) cantidad(es) tal como se ve («4 pallet y 1/2 saco»).
  - quantity_parts: array de {quantity, unit, label} si hay más de una cantidad; si hay una sola, un elemento o [].
  - unit_price: precio unitario sin IVA. Si solo hay subtotal de línea, divide subtotal/cantidad. 0 si no hay precio.
- NO incluyas subtotales, IVA, descuentos globales ni "Total" como ítem.
- Si la tabla tiene muchas filas CON cantidad, inclúyelas todas.

Encabezado:
- invoice_number, supplier_name, supplier_rif (emisor, no el cliente), date (YYYY-MM-DD), total_amount (total en Bs, con IVA si así figura en el documento).
- receptor_nombre y receptor_rif: el cliente o comprador a nombre de quien está la factura (bloque "Cliente", "Razón social del comprador", "Señores"). Si no figura, "".
- document_kind: "nota_entrega" si el documento dice "nota de entrega" (o equivalente) O no trae precios / todos los precios están en 0. "factura" si es factura fiscal con precios.

El proveedor es quien EMITE la factura, no el comprador.`;

export const PROMPT_ALBUM_PARTES = `
IMÁGENES: son PARTES SOLAPADAS de la MISMA factura, en orden de arriba hacia abajo (o de la primera a la última página).
- Combínalas en UN solo documento. No trates cada foto como una factura distinta.
- Las zonas de recorte entre fotos consecutivas se SOLAPAN: si un producto aparece en dos fotos seguidas, inclúyelo UNA sola vez.
- Extrae TODAS las líneas distintas CON cantidad. El total_amount es el total de la factura (casi siempre en la última foto).
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
