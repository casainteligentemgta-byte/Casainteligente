import type { PresupuestoVista } from '@/lib/presupuesto/types';

function lineTotal(item: { unitPrice: number; discount: number; qty: number }) {
  return item.unitPrice * (1 - item.discount / 100) * item.qty;
}

const items: PresupuestoVista['items'] = [
  {
    nombre: 'CÁMARA IP 4MP DOMO',
    descripcion: 'VISIÓN NOCTURNA Y POE — INCLUYE SOPORTE',
    categoria: 'Cámaras IP',
    qty: 4,
    unitPrice: 89.5,
    discount: 0,
    costo: 52,
  },
  {
    nombre: 'nvr 8 canales',
    descripcion: 'grabación en red, acceso remoto',
    categoria: 'C.C.T.V',
    qty: 1,
    unitPrice: 320,
    discount: 5,
    costo: 210,
  },
  {
    nombre: 'MANO DE OBRA INSTALACIÓN',
    descripcion: null,
    categoria: 'Servicio',
    qty: 1,
    unitPrice: 450,
    discount: 0,
    costo: 280,
  },
];

const subtotal = Math.round(items.reduce((s, i) => s + lineTotal(i), 0) * 100) / 100;
const totalCost =
  Math.round(items.reduce((s, i) => s + (i.costo ?? 0) * i.qty, 0) * 100) / 100;
const totalProfit = Math.round((subtotal - totalCost) * 100) / 100;

/**
 * Presupuesto de ejemplo para ver el diseño en local sin pasar por Ventas.
 * Abre: http://localhost:3000/ventas/preview?demo=1
 */
export const DEMO_PRESUPUESTO: PresupuestoVista = {
  cliente: 'María González / Oficina Centro',
  rif: 'V-12.345.678',
  telefono: '0414-5551234',
  email: 'maria.ejemplo@correo.com',
  direccion: 'Av. Principal, Edif. Demo, piso 3 — Caracas',
  notas: 'Instalación preferible en horario mañana. Incluye cableado categoría 6.',
  items,
  subtotal,
  totalCost,
  totalProfit,
  marginPct: 22,
  showZelle: true,
  fecha: new Date().toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
  numero: 'DEMO-001',
};
