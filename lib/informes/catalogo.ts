/** Catálogo del Centro de Informes (pack 1). */

export type InformeId = 'compras' | 'cadena-procura' | 'stock' | 'rentabilidad';

export type InformeDef = {
  id: InformeId;
  href: string;
  titulo: string;
  descripcion: string;
  /** Módulos que generan los datos (solo documentación UI). */
  fuentes: string[];
};

export const INFORMES_PACK1: InformeDef[] = [
  {
    id: 'compras',
    href: '/informes/compras',
    titulo: 'Compras del período',
    descripcion: 'Materiales y facturas del día, semana o mes (misma lógica que Telegram).',
    fuentes: ['contabilidad_compras', 'canal Telegram'],
  },
  {
    id: 'cadena-procura',
    href: '/informes/cadena-procura',
    titulo: 'Cadena procura → compra',
    descripcion: 'Cumplimiento: pedido vs cantidad de compra y vínculo a factura.',
    fuentes: ['ci_procuras'],
  },
  {
    id: 'stock',
    href: '/informes/stock',
    titulo: 'Stock valorizado',
    descripcion: 'Cantidad en almacén × costo promedio (USD) por obra o global.',
    fuentes: ['inventario_stock', 'global_inventory'],
  },
  {
    id: 'rentabilidad',
    href: '/informes/rentabilidad',
    titulo: 'Rentabilidad de obra',
    descripcion: 'Ventas aceptadas, cobrado y compras vs margen bruto simple.',
    fuentes: ['budgets', 'contabilidad_compras'],
  },
];
