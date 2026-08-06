/**
 * Obligaciones / ficha técnica por oficio «raso» (sin forzar grado).
 * Ayuda a mapear listados (AYUDANTE, CARPINTERO) a tareas del manual.
 * En el contrato el cargo impreso sigue siendo la denominación Gaceta/tabulador.
 */

export type FichaOficioRaso = {
  /** Clave normalizada (sin acentos, minúsculas). */
  clave: string;
  /** Nombre para el texto del contrato. */
  denominacion: string;
  conocimientos: string;
  tareas: string;
};

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\u00B7]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quita sufijo de grado del nombre de oficio. */
export function stripGradoOficio(nombre: string | null | undefined): string {
  return String(nombre ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(
      /\s+de\s+(?:1(?:era|ra|a|ª)|2(?:da|a|ª)|3(?:era|ra|a|ª)|4(?:ta|a|ª)|primera|segunda|tercera|cuarta)\.?\s*$/i,
      '',
    )
    .trim();
}

const FICHAS: FichaOficioRaso[] = [
  {
    clave: 'ayudante',
    denominacion: 'Ayudante',
    conocimientos: 'Herramientas manuales básicas, materiales de construcción y normas mínimas de seguridad (LOPCYMAT)',
    tareas:
      'Apoyo general en obra: carga y descarga, acarreo de materiales, limpieza, asistencia a oficios especializados y labores complementarias asignadas por el supervisor',
  },
  {
    clave: 'obrero',
    denominacion: 'Obrero',
    conocimientos: 'Herramientas manuales, mezclas básicas y seguridad en obra',
    tareas: 'Excavaciones, carga/descarga, apoyo general en obra y labores anexas complementarias',
  },
  {
    clave: 'carpintero',
    denominacion: 'Carpintero',
    conocimientos: 'Maderas, encofrados, herramientas de carpintería de obra y lectura básica de planos',
    tareas:
      'Armado y desencofrado de moldes, fabricación e instalación de elementos de madera, apoyo en estructuras y acabados de carpintería de obra',
  },
  {
    clave: 'albanil',
    denominacion: 'Albañil',
    conocimientos: 'Mampostería, morteros, niveles, plomos y seguridad en trabajo en altura',
    tareas:
      'Levantamiento de paredes y cerramientos, frisos, colocación de bloques, replanteo menor y acabados de albañilería',
  },
  {
    clave: 'cabillero',
    denominacion: 'Cabillero',
    conocimientos: 'Acero de refuerzo, diámetros, traslapes, amarre y lectura de despieces',
    tareas:
      'Corte, doblado, armado y colocación de cabillas según planos; preparación de armaduras para fundaciones, columnas, vigas y losas',
  },
  {
    clave: 'plomero',
    denominacion: 'Plomero',
    conocimientos: 'Tuberías de agua potable y servidas, uniones, pendientes y pruebas de hermeticidad',
    tareas:
      'Tendido e instalación de redes hidráulicas y sanitarias, empotramientos, piezas sanitarias y reparaciones menores de plomería de obra',
  },
  {
    clave: 'electricista',
    denominacion: 'Electricista',
    conocimientos: 'Circuitos, tubería IEM, tableros, normas básicas de seguridad eléctrica',
    tareas:
      'Cableado, empotramiento, instalación de tomas, interruptores, tableros y apoyos en instalaciones eléctricas de obra',
  },
  {
    clave: 'pintor',
    denominacion: 'Pintor',
    conocimientos: 'Preparación de superficies, tipos de pintura, diluyentes y seguridad en altura',
    tareas:
      'Preparación de paredes y techos, aplicación de pinturas e impermeabilizantes menores, y acabados de pintura en obra',
  },
  {
    clave: 'soldador',
    denominacion: 'Soldador',
    conocimientos: 'Procesos de soldadura, materiales metálicos, EPP y riesgos de calor/chispas',
    tareas:
      'Soldadura y corte de elementos metálicos, montaje de estructuras livianas y trabajos de soldadura asignados en obra',
  },
  {
    clave: 'granitero',
    denominacion: 'Granitero',
    conocimientos: 'Mezclas de granito, nivelación, pulido y acabados de piso',
    tareas: 'Vaciado, nivelación, pulido y acabado de pisos y elementos de granito en obra',
  },
  {
    clave: 'impermeabilizador',
    denominacion: 'Impermeabilizador',
    conocimientos: 'Membranas, asfaltos, pendientes y puntos críticos de filtración',
    tareas:
      'Preparación de superficies e impermeabilización de losas, techos, jardineras y áreas húmedas',
  },
  {
    clave: 'operador',
    denominacion: 'Operador',
    conocimientos: 'Operación segura de equipos, mantenimiento básico y señalización de obra',
    tareas: 'Operar equipos asignados, apoyar movimientos de tierra/materiales y cuidar el equipo durante la jornada',
  },
  {
    clave: 'operador de equipo liviano',
    denominacion: 'Operador de equipo liviano',
    conocimientos: 'Operación segura de equipos livianos, mantenimiento básico y señalización de obra',
    tareas: 'Operar equipo liviano asignado, apoyar movimientos de materiales y cuidar el equipo durante la jornada',
  },
  {
    clave: 'ayudante de topografo',
    denominacion: 'Ayudante de Topógrafo',
    conocimientos: 'Conceptos de talud y relleno; identificación de teodolito, mira y prismas',
    tareas: 'Transporte y cuido de instrumentos, colocación de estacas y señalamientos',
  },
  {
    clave: 'maestro de obra',
    denominacion: 'Maestro de Obra',
    conocimientos: 'Organización de cuadrillas, lectura de planos, rendimientos y seguridad en obra',
    tareas:
      'Dirigir y coordinar labores de la cuadrilla, controlar avances, calidad y cumplimiento de normas de seguridad',
  },
  {
    clave: 'caporal',
    denominacion: 'Caporal',
    conocimientos: 'Supervisión de personal, secuencias de trabajo y seguridad básica',
    tareas: 'Coordinar cuadrillas, asignar tareas diarias y verificar el cumplimiento de instrucciones de obra',
  },
];

const BY_CLAVE = new Map(FICHAS.map((f) => [f.clave, f]));

/** Alias frecuentes del listado → clave rasa. */
const ALIAS_A_CLAVE: Record<string, string> = {
  utilitis: 'ayudante',
  utilities: 'ayudante',
  utility: 'ayudante',
  utilites: 'ayudante',
  utilitario: 'ayudante',
  topografo: 'ayudante de topografo',
  'ingeniero supervisor': 'maestro de obra',
  ingeniero: 'maestro de obra',
  supervisor: 'caporal',
  'operador de equipo': 'operador de equipo liviano',
};

export function fichaOficioRaso(nombreOrClave: string | null | undefined): FichaOficioRaso | null {
  const raso = stripGradoOficio(nombreOrClave);
  if (!raso) return null;
  let key = normKey(raso);
  if (ALIAS_A_CLAVE[key]) key = ALIAS_A_CLAVE[key]!;
  const exact = BY_CLAVE.get(key);
  if (exact) return exact;
  // Coincidencia parcial (p. ej. «Ayudante de Operadores» → ayudante)
  for (const f of FICHAS) {
    if (key === f.clave || key.startsWith(`${f.clave} `) || f.clave.startsWith(`${key} `)) {
      return f;
    }
  }
  return null;
}

export function listarFichasOficiosRasos(): FichaOficioRaso[] {
  return [...FICHAS];
}
