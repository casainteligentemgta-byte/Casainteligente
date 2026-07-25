export type AcuerdoPheme = {
  tarea: string;
  responsable: string;
  /** Fecha/plazo mencionado, o null si no se indicó. */
  fecha_limite: string | null;
};

export type MinutaPheme = {
  resumen_ejecutivo: string;
  puntos_clave: string[];
  acuerdos: AcuerdoPheme[];
  alertas_pendientes: string[];
};

export type GenerarMinutaPhemeResult = {
  minuta: MinutaPheme;
  markdown: string;
  desdeGemini: boolean;
  modelo?: string;
  aviso?: string;
};
