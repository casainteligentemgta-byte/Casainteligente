/** Datos que renderiza la vista previa oscura del presupuesto */
export interface PresupuestoVistaItem {
  nombre: string;
  categoria: string | null;
  qty: number;
  unitPrice: number;
  discount: number;
  costo: number | null;
}

export interface PresupuestoVista {
  cliente: string;
  rif: string;
  notas: string;
  items: PresupuestoVistaItem[];
  subtotal: number;
  totalCost: number;
  totalProfit: number;
  marginPct: number;
  showZelle: boolean;
  fecha: string;
  numero: string;
  telefono?: string;
  email?: string;
  /** Dirección del cliente (desde `customers.direccion`) */
  direccion?: string;
}
