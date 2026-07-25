export type AcuerdoPheme = {
  tarea: string;
  responsable: string;
  /** YYYY-MM-DD, plazo textual, o null si N/A / no se mencionó. */
  fecha_limite: string | null;
};

/** Estructura JSON estricta del prototipo Pheme. */
export type MinutaPheme = {
  resumen_ejecutivo: string;
  puntos_clave: string[];
  acuerdos: AcuerdoPheme[];
  pendientes_o_alertas: string[];
};

export type GenerarMinutaPhemeResult = {
  titulo_reunion: string;
  minuta: MinutaPheme;
  markdown: string;
  desdeGemini: boolean;
  modelo?: string;
  aviso?: string;
  /** Id en `ci_pheme_reuniones` si se persistió. */
  reunion_id?: string | null;
};
