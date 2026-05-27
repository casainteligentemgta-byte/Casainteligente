export type {
  UbicacionInventario,
  TipoUbicacion,
  InvUbicacion,
  InvUbicacionTipo,
  InvUbicacionRow,
  InventarioStock,
  SerieProducto,
  SerieProductoEstado,
  CompraFactura,
  CompraFacturaLinea,
  CompraFacturaInsert,
  CompraCondicionPago,
  CompraFacturaEstado,
  ObraPartidaMaterial,
  TransferenciaInventario,
  TransferenciaInventarioLinea,
  TransferenciaInventarioInsert,
  TransferenciaEstado,
  TransferenciaTipoMovimiento,
  DetalleTransferenciaPartida,
  ImputacionPartidaInput,
  AlertaExcesoPartida,
} from './inventario-obra';

export { mapUbicacionInventario, buildArbolUbicaciones } from './inventario-obra';

export interface Budget {
    id: string
    sale_price: number
    cost_price: number
}

export type ProjectStatus = 'Pendiente' | 'En Progreso' | 'Pruebas' | 'Completado'

export interface Project {
    id: string
    name: string
    status: ProjectStatus
    budget_id?: string
    budget?: Budget
    description?: string
    installation_address?: string
}
