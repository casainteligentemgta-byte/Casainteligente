/** Membrete fijo del representante legal en reportes de presupuesto. */
export const MEMBRETE_REPRESENTANTE_LEGAL = {
  nombre: 'Luis Vicente Mata Ortiz',
  cedula: 'V-13.840.231',
  cargo: 'Representante Legal',
} as const;

export type CapituloResumenFilas = {
  titulo: string;
  subCapitulos: Array<{ titulo: string; totalSub: number }>;
  totalCapitulo: number;
  porcentaje: number;
};

export type ResumenPresupuestoTablaProps = {
  tituloDocumento: string;
  proyectoNombre: string;
  numeroContrato: string;
  propietarioObra: string;
  capitulos: CapituloResumenFilas[];
  totalGeneral: number;
  pagina?: number;
  className?: string;
};
