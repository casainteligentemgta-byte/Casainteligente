import type { DocumentoPresupuestoCliente } from './documentoCliente';

export type BudgetPdfItem = {
  nombre: string;
  descripcion?: string | null;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
};

export type BudgetPdfData = {
  cliente: string;
  rif: string;
  notas: string;
  items: BudgetPdfItem[];
  subtotal: number;
  descuentoTotal: number;
  ivaPct: number;
  ivaMonto: number;
  totalConIva: number;
  showZelle: boolean;
  fecha: string;
  numero: string;
  telefono?: string;
  email?: string;
  tasaBcv?: number | null;
  tasaBcvFecha?: string | null;
  totalBs?: number | null;
  logoSrc?: string | null;
};

export function budgetPdfDataDesdeDocumento(
  doc: DocumentoPresupuestoCliente,
  opts?: { logoSrc?: string | null },
): BudgetPdfData {
  return {
    cliente: doc.cliente,
    rif: doc.rif,
    notas: doc.notas,
    items: doc.items.map((i) => ({
      nombre: i.nombre,
      descripcion: i.descripcion,
      qty: i.qty,
      unitPrice: i.unitPrice,
      discount: i.discount,
      lineTotal: i.lineTotal,
    })),
    subtotal: doc.subtotal,
    descuentoTotal: doc.descuentoTotal,
    ivaPct: doc.ivaPct,
    ivaMonto: doc.ivaMonto,
    totalConIva: doc.totalConIva,
    showZelle: doc.showZelle,
    fecha: doc.fecha,
    numero: doc.numero,
    telefono: doc.telefono,
    email: doc.email,
    tasaBcv: doc.tasaBcv,
    tasaBcvFecha: doc.tasaBcvFecha,
    totalBs: doc.totalBs,
    logoSrc: opts?.logoSrc ?? null,
  };
}

export function logoPresupuestoAbsoluto(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/logo-casa-inteligente.png`;
}
