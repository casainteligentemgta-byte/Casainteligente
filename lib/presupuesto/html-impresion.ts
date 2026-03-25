/**
 * HTML del presupuesto optimizado para impresión / “Guardar como PDF” desde el navegador.
 * Misma información de marca que la vista previa oscura (`lib/presupuesto/brand.ts`).
 */
import { PRESUPUESTO_BRAND, textoMetodosPago } from '@/lib/presupuesto/brand';
import { lineaPresupuestoTitulo, tituloPresupuestoPlano } from '@/lib/presupuesto/presentacion';

export type BudgetItemJson = {
  product_data?: { nombre?: string; categoria?: string | null; descripcion?: string | null };
  qty?: number;
  unit_price?: number;
  discount?: number;
};

export type BudgetRow = {
  customer_name?: string | null;
  customer_rif?: string | null;
  notes?: string | null;
  show_zelle?: boolean | null;
  subtotal?: number | null;
  items?: unknown;
  created_at?: string | null;
  id?: string;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineTotal(item: BudgetItemJson) {
  const qty = item.qty ?? 0;
  const up = item.unit_price ?? 0;
  const d = (item.discount ?? 0) / 100;
  return qty * up * (1 - d);
}

/**
 * Normaliza ítems guardados en `budgets.items`: solo texto y cifras para impresión,
 * sin `imagen` ni otros campos que pudieran usarse en plantillas viejas.
 */
export function sanitizeBudgetItemsForPrint(raw: unknown): BudgetItemJson[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    const pdIn =
      r.product_data && typeof r.product_data === 'object'
        ? (r.product_data as Record<string, unknown>)
        : {};
    const nombreRaw = pdIn.nombre;
    const nombreBase =
      typeof nombreRaw === 'string'
        ? nombreRaw
        : nombreRaw != null && String(nombreRaw).trim() !== ''
          ? String(nombreRaw)
          : '';
    const nombre = tituloPresupuestoPlano(nombreBase) || 'Ítem';
    return {
      qty: Number(r.qty) || 0,
      unit_price: Number(r.unit_price) || 0,
      discount: Number(r.discount) || 0,
      product_data: { nombre, categoria: null, descripcion: null },
    };
  });
}

/** Genera documento A4 claro alineado con docs/PRESUPUESTO-DISENO.md */
export function buildPresupuestoPrintHtml(budget: BudgetRow): string {
  const { impresion: c } = PRESUPUESTO_BRAND;
  const items = sanitizeBudgetItemsForPrint(budget.items);
  const idShort = (budget.id ?? '').slice(0, 8).toUpperCase();
  const fecha = budget.created_at
    ? new Date(budget.created_at).toLocaleDateString('es', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

  const rows = items
    .map((it) => {
      const nombre = lineaPresupuestoTitulo(it.product_data?.nombre, 'Ítem');
      const qty = it.qty ?? 0;
      const up = it.unit_price ?? 0;
      const sub = lineTotal(it);
      return `<tr>
        <td><strong>${escapeHtml(nombre)}</strong></td>
        <td class="num">${fmt(up)}</td>
        <td class="num">${qty}</td>
        <td class="num"><strong>${fmt(sub)}</strong></td>
      </tr>`;
    })
    .join('');

  const showZelle = budget.show_zelle !== false;
  const condiciones = escapeHtml(PRESUPUESTO_BRAND.condicionesDefault.replace(/\s+/g, ' ').trim());
  const pago = escapeHtml(textoMetodosPago());
  const notas = budget.notes ? escapeHtml(budget.notes) : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Presupuesto P-${idShort}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: ${c.texto};
      background: ${c.fondo};
      margin: 0;
      padding: 12mm 14mm;
      font-size: 11px;
      line-height: 1.45;
    }
    .sheet { max-width: 210mm; margin: 0 auto; }
    .top {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 3px solid ${c.acento};
      padding-bottom: 14px; margin-bottom: 18px;
    }
    .brand-name { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 4px; color: ${c.texto}; }
    .brand-sub { font-size: 10px; color: ${c.textoMuted}; text-transform: uppercase; letter-spacing: 0.06em; }
    .badge {
      background: ${c.acento}; color: #fff; font-weight: 700; font-size: 11px;
      padding: 8px 14px; border-radius: 8px; display: inline-block;
    }
    .fecha { font-size: 11px; color: ${c.textoMuted}; margin-bottom: 8px; text-align: right; }
    .cliente-block { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .cliente-nombre { font-size: 18px; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.02em; }
    .cliente-meta { color: ${c.textoMuted}; font-size: 11px; }
    .total-box { text-align: right; }
    .total-label { font-size: 10px; color: ${c.textoMuted}; text-transform: uppercase; letter-spacing: 0.05em; }
    .total-val { font-size: 28px; font-weight: 800; color: ${c.acento}; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 20px; }
    th {
      text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
      color: ${c.textoMuted}; padding: 10px 8px; background: ${c.barraTabla}; border-bottom: 1px solid ${c.borde};
    }
    th:nth-child(n+2), td.num { text-align: right; }
    td { padding: 10px 8px; border-bottom: 1px solid ${c.borde}; vertical-align: top; }
    table td img, table td picture { display: none !important; width: 0 !important; height: 0 !important; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer-grid { display: grid; grid-template-columns: 1fr 200px; gap: 20px; margin-top: 8px; }
    .legal h4 { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: ${c.textoMuted}; margin: 0 0 6px; }
    .legal p { margin: 0; color: ${c.textoMuted}; font-size: 10px; line-height: 1.55; }
    .legal .block { margin-top: 12px; }
    .sum-line { display: flex; justify-content: space-between; padding: 8px 10px; border: 1px solid ${c.borde}; border-radius: 8px; margin-bottom: 6px; background: #fff; }
    .sum-total {
      background: #eff6ff; border-color: #bfdbfe; font-weight: 800; font-size: 14px; color: ${c.acento};
    }
    .muted { color: ${c.textoMuted}; }
    @media print {
      body { padding: 10mm 12mm; }
      .sheet { max-width: none; }
    }
    @page { size: A4; margin: 12mm; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <h1 class="brand-name">${escapeHtml(PRESUPUESTO_BRAND.nombreLegal)}</h1>
        <p class="brand-sub">${escapeHtml(PRESUPUESTO_BRAND.tagline)} RIF ${escapeHtml(PRESUPUESTO_BRAND.rifEmpresa)}</p>
      </div>
      <div>
        <div class="fecha">${escapeHtml(fecha)}</div>
        <span class="badge">Presupuesto P-${escapeHtml(idShort)}</span>
      </div>
    </div>

    <div class="cliente-block">
      <div>
        <h2 class="cliente-nombre">${escapeHtml((budget.customer_name ?? 'Cliente').toUpperCase())}</h2>
        <p class="cliente-meta">RIF / ID: ${escapeHtml(budget.customer_rif ?? '—')}</p>
      </div>
      <div class="total-box">
        <div class="total-label">Total</div>
        <div class="total-val">$${fmt(Number(budget.subtotal ?? 0))}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Descripción</th>
          <th>P. unit.</th>
          <th>Cant.</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="4" class="muted">Sin ítems</td></tr>`}</tbody>
    </table>

    <div class="footer-grid">
      <div class="legal">
        <h4>Condiciones</h4>
        <p>${condiciones}</p>
        ${showZelle ? `<div class="block"><h4>Método de pago</h4><p>${pago}</p></div>` : ''}
        ${notas ? `<div class="block"><h4>Notas</h4><p>${notas}</p></div>` : ''}
      </div>
      <div>
        <div class="sum-line sum-total">
          <span>TOTAL</span>
          <span>$${fmt(Number(budget.subtotal ?? 0))}</span>
        </div>
        <p class="muted" style="font-size:9px;margin-top:10px;text-align:right">Casa Inteligente · Documento generado electrónicamente</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
