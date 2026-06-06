import type { FormaIngresoRecepcion } from '@/lib/almacen/formaIngresoRecepcion';

export type TipoRecepcionCampo = 'nota_entrega' | 'emergencia' | 'factura_canal';

export type LineaRecepcionCampoInput = {
  material_id: string;
  cantidad: number;
  unidad?: string;
  descripcion?: string;
  observaciones?: string;
  forma_ingreso?: FormaIngresoRecepcion;
  soporte_storage_path?: string | null;
  soporte_file_name?: string | null;
  soporte_mime_type?: string | null;
};

export type PayloadRecepcionManualApi = {
  proyecto_id: string;
  ubicacion_id: string;
  proveedor_id?: string | null;
  proveedor_nombre?: string;
  tipo: TipoRecepcionCampo;
  num_doc?: string;
  lineas: LineaRecepcionCampoInput[];
  soporte_storage_path?: string | null;
  soporte_file_name?: string | null;
  soporte_mime_type?: string | null;
  observaciones?: string | null;
  /** Tras registrar en web, limpia el borrador Telegram asociado. */
  borrador_token?: string | null;
};
