import type {
  ExamenGenerado,
  ItemPersonalidadExamen,
  PreguntaExamenMovil,
  PreguntaLogica,
  PreguntaPersonalidad,
  RolExamen,
} from '@/types/talento';
import {
  esPreguntaSituacionalObra,
  PREGUNTAS_SITUACIONALES_OBRA,
  puntajeOpcionSituacionalObra,
} from '@/lib/talento/preguntasActitudObraObrero';
import {
  normalizarValorPersonalidad,
  type ValorFrecuenciaPersonalidad,
} from '@/lib/talento/escalaFrecuenciaPersonalidad';
import { armarPreguntasAbcObrero } from '@/lib/talento/preguntasAbcFamiliaObrero';

export { ESCALA_FRECUENCIA_PERSONALIDAD } from '@/lib/talento/escalaFrecuenciaPersonalidad';
export type PreguntaObrero = {
  id: string;
  categoria: string;
  pregunta: string;
  opciones: { texto: string; valor: string }[];
};

/**
 * Núcleo ABC común (15) — léxico de obra.
 * El bloque 16–20 depende de la familia de oficio (`preguntasAbcObreroParaCargo`).
 */
export const PREGUNTAS_OBRERO_NUCLEO: PreguntaObrero[] = [
  {
    id: 'obr_01',
    categoria: 'seguridad',
    pregunta: 'Tu arnés tiene una costura rota. ¿Qué haces?',
    opciones: [
      { texto: 'Paro y pido otro al encargado.', valor: 'A' },
      { texto: 'Sigo con cuidado para no atrasar.', valor: 'B' },
      { texto: 'No digo nada.', valor: 'C' },
    ],
  },
  {
    id: 'obr_02',
    categoria: 'seguridad',
    pregunta: 'Te mandan donde hay cables pelados y un charco. ¿Qué haces?',
    opciones: [
      { texto: 'Aviso el peligro y pido secar o cortar luz.', valor: 'A' },
      { texto: 'Hago el trabajo rápido y con cuidado.', valor: 'B' },
      { texto: 'Me voy de mala manera a otra parte.', valor: 'C' },
    ],
  },
  {
    id: 'obr_03',
    categoria: 'seguridad',
    pregunta: 'Un compañero trabaja sin botas ni casco. ¿Qué haces?',
    opciones: [
      { texto: 'Le digo que se los ponga.', valor: 'A' },
      { texto: 'No digo nada.', valor: 'B' },
      { texto: 'Me burlo de él.', valor: 'C' },
    ],
  },
  {
    id: 'obr_04',
    categoria: 'seguridad',
    pregunta: 'Te dan una herramienta eléctrica que no conoces. ¿Qué haces?',
    opciones: [
      { texto: 'Le digo al encargado que me explique.', valor: 'A' },
      { texto: 'La uso mirando a los demás.', valor: 'B' },
      { texto: 'La uso a mi manera.', valor: 'C' },
    ],
  },
  {
    id: 'obr_05',
    categoria: 'seguridad',
    pregunta: 'Al salir queda escombro en el pasillo. ¿Qué haces?',
    opciones: [
      { texto: 'Lo recojo antes de irme.', valor: 'A' },
      { texto: 'Lo corro un poco con el pie.', valor: 'B' },
      { texto: 'Me voy: que lo recoja otro.', valor: 'C' },
    ],
  },
  {
    id: 'obr_06',
    categoria: 'responsabilidad',
    pregunta: 'Vas a llegar tarde por el transporte. ¿Qué haces?',
    opciones: [
      { texto: 'Aviso al encargado ya.', valor: 'A' },
      { texto: 'Llego callado.', valor: 'B' },
      { texto: 'No voy y mañana invento una excusa.', valor: 'C' },
    ],
  },
  {
    id: 'obr_07',
    categoria: 'responsabilidad',
    pregunta: 'Dañaste material y nadie te vio. ¿Qué haces?',
    opciones: [
      { texto: 'Se lo digo al encargado.', valor: 'A' },
      { texto: 'Lo dejo así.', valor: 'B' },
      { texto: 'Lo paso a otra cuadrilla.', valor: 'C' },
    ],
  },
  {
    id: 'obr_08',
    categoria: 'responsabilidad',
    pregunta: 'Te avisan: sábado hay extras por un vaciado. ¿Qué haces?',
    opciones: [
      { texto: 'Voy.', valor: 'A' },
      { texto: 'A última hora pongo una excusa.', valor: 'B' },
      { texto: 'Exijo plata extra o amenazo con no ir.', valor: 'C' },
    ],
  },
  {
    id: 'obr_09',
    categoria: 'responsabilidad',
    pregunta: 'Ves gente rara o se pierde herramienta. ¿Qué haces?',
    opciones: [
      { texto: 'Se lo digo al encargado o vigilante.', valor: 'A' },
      { texto: 'No me meto.', valor: 'B' },
      { texto: 'Me guardo algo también.', valor: 'C' },
    ],
  },
  {
    id: 'obr_10',
    categoria: 'responsabilidad',
    pregunta: 'El encargado salió y la cuadrilla quedó sola. ¿Qué haces?',
    opciones: [
      { texto: 'Sigo trabajando igual.', valor: 'A' },
      { texto: 'Bajo el ritmo y miro el teléfono.', valor: 'B' },
      { texto: 'Paro y animo a los demás a parar.', valor: 'C' },
    ],
  },
  {
    id: 'obr_11',
    categoria: 'convivencia',
    pregunta: 'Un compañero nuevo va lento. ¿Qué haces?',
    opciones: [
      { texto: 'Le ayudo con unos tips.', valor: 'A' },
      { texto: 'Me molesto y no le digo nada.', valor: 'B' },
      { texto: 'Me quejo en voz alta.', valor: 'C' },
    ],
  },
  {
    id: 'obr_12',
    categoria: 'convivencia',
    pregunta: 'Te piden prestada una herramienta tuya. ¿Qué haces?',
    opciones: [
      { texto: 'Se la presto y me aseguro que la devuelva.', valor: 'A' },
      { texto: 'Se la niego de mala manera.', valor: 'B' },
      { texto: 'Se la tiro al piso.', valor: 'C' },
    ],
  },
  {
    id: 'obr_13',
    categoria: 'convivencia',
    pregunta: 'Tú y otro no están de acuerdo en cómo hacer el trabajo. ¿Qué hacen?',
    opciones: [
      { texto: 'Hablamos; si no, preguntamos al maestro.', valor: 'A' },
      { texto: 'Lo hago a mi manera cuando él no mira.', valor: 'B' },
      { texto: 'Le grito o lo reto.', valor: 'C' },
    ],
  },
  {
    id: 'obr_14',
    categoria: 'convivencia',
    pregunta: 'El maestro te pide ayudar a otra cuadrilla. ¿Qué haces?',
    opciones: [
      { texto: 'Voy y ayudo.', valor: 'A' },
      { texto: 'Voy de mala gana.', valor: 'B' },
      { texto: 'Digo que no es mi trabajo.', valor: 'C' },
    ],
  },
  {
    id: 'obr_15',
    categoria: 'convivencia',
    pregunta: 'En el almuerzo hablan mal del ingeniero. ¿Qué haces?',
    opciones: [
      { texto: 'No me meto.', valor: 'A' },
      { texto: 'Oigo y asiento.', valor: 'B' },
      { texto: 'Me uno a las quejas.', valor: 'C' },
    ],
  },
];

/** Banco ABC completo según cargo / rol (núcleo + 5 del oficio). */
export function preguntasAbcObreroParaCargo(opts?: {
  cargo?: string | null;
  rolExamen?: string | null;
  codigoGoE?: string | null;
}): PreguntaObrero[] {
  return armarPreguntasAbcObrero({
    nucleo: PREGUNTAS_OBRERO_NUCLEO,
    cargo: opts?.cargo,
    rolExamen: opts?.rolExamen,
    codigoGoE: opts?.codigoGoE,
  }).preguntas as PreguntaObrero[];
}

export function metaAbcObreroParaCargo(opts?: {
  cargo?: string | null;
  rolExamen?: string | null;
  codigoGoE?: string | null;
}) {
  return armarPreguntasAbcObrero({
    nucleo: PREGUNTAS_OBRERO_NUCLEO,
    cargo: opts?.cargo,
    rolExamen: opts?.rolExamen,
    codigoGoE: opts?.codigoGoE,
  });
}

/** Compat: sin cargo = núcleo + familia general (20 ítems). */
export const PREGUNTAS_OBRERO: PreguntaObrero[] = preguntasAbcObreroParaCargo();

/** 20 ítems fijos (Nunca → Siempre): conducta, equipo, integridad operativa. */
export const PREGUNTAS_PERSONALIDAD: PreguntaPersonalidad[] = [
  { id: 'p01', bloque: 'Conducta', texto: 'Mantengo la calidad del trabajo bajo presión de plazos ajustados.' },
  { id: 'p02', bloque: 'Conducta', texto: 'Prefiero aclarar requisitos antes de ejecutar tareas ambiguas.' },
  { id: 'p03', bloque: 'Equipo', texto: 'Comparto información relevante con el equipo sin esperar que me lo pidan.' },
  { id: 'p04', bloque: 'Equipo', texto: 'Acepto feedback constructivo sin ponerse a la defensiva.' },
  { id: 'p05', bloque: 'Integridad', texto: 'Reporto errores propios aunque puedan generar retrabajo.' },
  { id: 'p06', bloque: 'Integridad', texto: 'Evito comprometer plazos que sé que no son realistas.' },
  { id: 'p07', bloque: 'Aprendizaje', texto: 'Investigo documentación oficial antes de improvisar soluciones.' },
  { id: 'p08', bloque: 'Aprendizaje', texto: 'Documento lo que aprendo para reutilizarlo en futuros proyectos.' },
  { id: 'p09', bloque: 'Cliente', texto: 'Priorizo la seguridad del usuario sobre la velocidad de entrega.' },
  { id: 'p10', bloque: 'Cliente', texto: 'Explico riesgos técnicos en lenguaje comprensible para el cliente.' },
  { id: 'p11', bloque: 'Operación', texto: 'Mantengo orden en herramientas, cables y entorno de trabajo.' },
  { id: 'p12', bloque: 'Operación', texto: 'Verifico checklist antes de dar por cerrada una instalación.' },
  { id: 'p13', bloque: 'Resolución', texto: 'Divido problemas grandes en pasos verificables.' },
  { id: 'p14', bloque: 'Resolución', texto: 'Midó el resultado antes de declarar éxito (pruebas / validación).' },
  { id: 'p15', bloque: 'Autonomía', texto: 'Pido ayuda cuando llevo más de un umbral razonable bloqueado.' },
  { id: 'p16', bloque: 'Autonomía', texto: 'Propongo alternativas cuando el plan original no es viable.' },
  { id: 'p17', bloque: 'Estrés', texto: 'Mantengo tono profesional ante reclamos o urgencias.' },
  { id: 'p18', bloque: 'Estrés', texto: 'Evito culpar a terceros en incidentes; busco causa raíz.' },
  { id: 'p19', bloque: 'Valores', texto: 'Cumplo normas de la empresa aunque no haya supervisión directa.' },
  { id: 'p20', bloque: 'Valores', texto: 'Trato a compañeros y subcontratistas con respeto constante.' },
];

const LOGICA_PROGRAMADOR: PreguntaLogica[] = [
  {
    id: 'lp1',
    texto: '¿Qué estructura permite búsqueda O(1) promedio en un conjunto de claves únicas?',
    opciones: ['Lista enlazada', 'Tabla hash (hash map)', 'Array ordenado sin índice', 'Cola FIFO'],
    correcta: 1,
  },
  {
    id: 'lp2',
    texto: 'En HTTP REST, ¿qué verbo es idempotente y suele usarse para lecturas sin efectos secundarios?',
    opciones: ['POST', 'PATCH', 'GET', 'CONNECT'],
    correcta: 2,
  },
  {
    id: 'lp3',
    texto: 'Un bug solo ocurre en producción. ¿Cuál es la primera acción más sensata?',
    opciones: [
      'Desplegar un hotfix sin revisar logs',
      'Reproducir o correlacionar con logs/métricas y aislar el cambio',
      'Reiniciar servidores indefinidamente',
      'Deshacer todos los commits del mes',
    ],
    correcta: 1,
  },
  {
    id: 'lp4',
    texto: '¿Qué patrón separa la construcción de un objeto complejo paso a paso?',
    opciones: ['Singleton', 'Builder', 'Adapter', 'Flyweight'],
    correcta: 1,
  },
  {
    id: 'lp5',
    texto: 'SQL: ¿qué cláusula restringe filas antes de agrupar?',
    opciones: ['HAVING', 'WHERE', 'ORDER BY', 'WINDOW'],
    correcta: 1,
  },
];

/** Lógica práctica de obra — personal obrero (rol `tecnico` en sistema). */
export const LOGICA_OBRERO: PreguntaLogica[] = [
  {
    id: 'lt1',
    texto: 'Mañana hay vaciado de concreto. ¿Qué conviene hacer hoy primero?',
    opciones: [
      'Vaciar hoy mismo para adelantar.',
      'Revisar encofrado, varilla y limpieza del área con el encargado.',
      'Esperar sin avisar a nadie.',
      'Comprar pintura para después del vaciado.',
    ],
    correcta: 1,
  },
  {
    id: 'lt2',
    texto: 'La lista pide 24 sacos de cemento y en obra solo ves 20. ¿Qué haces antes de mezclar?',
    opciones: [
      'Mezclo con 20 y le echo más agua.',
      'Tomo sacos de otra cuadrilla sin decir.',
      'Aviso al encargado y espero confirmación o el faltante.',
      'Mezclo igual y ya verán.',
    ],
    correcta: 2,
  },
  {
    id: 'lt3',
    texto: 'Vas a subir una escalera en terreno irregular. ¿Qué es lo más seguro?',
    opciones: [
      'Poner piedras solo bajo una pata.',
      'Usar la escalera más corta aunque no llegue.',
      'Apoyarla en un cable para que no se mueva.',
      'Nivelar la base o usar escalera estable con patas antideslizantes.',
    ],
    correcta: 3,
  },
  {
    id: 'lt4',
    texto: 'Antes de subir a un andamio, ¿qué va primero?',
    opciones: [
      'Subir rápido para no perder tiempo.',
      'Arnés, revisar el andamio y confirmar con el encargado.',
      'No usar arnés si «no es tan alto».',
      'Mandar al más nuevo sin explicarle nada.',
    ],
    correcta: 1,
  },
  {
    id: 'lt5',
    texto: 'Por la tarde puede llover. Por la mañana toca muro al sol. ¿Qué priorizas?',
    opciones: [
      'Echar todo el cemento afuera sin importar la lluvia.',
      'Irme sin decir nada.',
      'Cubrir material, proteger lo expuesto y avisar al encargado.',
      'Esconder herramientas bajo la lluvia sin avisar.',
    ],
    correcta: 2,
  },
];

/** @deprecated Usar `LOGICA_OBRERO`. */
const LOGICA_TECNICO = LOGICA_OBRERO;

export type ExamenAdaptativoResult = ExamenGenerado | PreguntaObrero[];

export function esExamenObrero(examen: ExamenAdaptativoResult): examen is PreguntaObrero[] {
  return Array.isArray(examen);
}

/** 20 ítems para rol tecnico: situaciones y hábitos de obra (4 opciones cada una). */
export function personalidadExamenTecnicoObra(): ItemPersonalidadExamen[] {
  return PREGUNTAS_SITUACIONALES_OBRA;
}

function obtenerPreguntasTech(rol: Extract<RolExamen, 'programador' | 'tecnico' | 'empleado'>): ExamenGenerado {
  const logica = rol === 'tecnico' ? LOGICA_TECNICO : LOGICA_PROGRAMADOR;
  const personalidad =
    rol === 'tecnico' ? personalidadExamenTecnicoObra() : PREGUNTAS_PERSONALIDAD;
  return {
    rol,
    personalidad,
    logica,
  };
}

/** Preguntas de personalidad o situacionales según el resultado de `generarExamenAdaptativo`. */
export function personalidadDelExamen(examen: ExamenAdaptativoResult) {
  return esExamenObrero(examen) ? examen : examen.personalidad;
}

/** Preguntas de lógica (vacío para obrero / vigilante). */
export function logicaDelExamen(examen: ExamenAdaptativoResult): PreguntaLogica[] {
  return esExamenObrero(examen) ? [] : examen.logica;
}

/**
 * Genera el banco de preguntas según rol.
 * - obrero / vigilante: 20 situacionales ABC (núcleo + familia de oficio)
 * - tecnico: 20 conducta obra (4 opciones) + 5 lógica de campo
 * - empleado / programador: 20 frecuencia + 5 lógica (TI / razonamiento)
 */
/** Etiqueta visible en UI — ver también `rolesExamenCatalogo`. */
export function etiquetaRolExamenUI(rol: RolExamen | string): string {
  if (rol === 'programador') return 'Programador / TI';
  if (rol === 'empleado') return 'Empleado (oficina)';
  if (rol === 'tecnico') return 'Técnico de obra';
  if (rol === 'obrero') return 'Obrero (campo)';
  if (rol === 'vigilante') return 'Vigilante';
  return String(rol);
}

export function generarExamenAdaptativo(rol: string): ExamenAdaptativoResult {
  switch (rol) {
    case 'programador':
    case 'empleado':
    case 'tecnico':
      return obtenerPreguntasTech(rol);
    case 'obrero':
    case 'vigilante':
      return preguntasAbcObreroParaCargo({ rolExamen: rol });
    default:
      throw new Error(`El rol ${rol} no tiene una evaluación configurada.`);
  }
}

/** Convierte ítems de lógica del examen al formato de `ExamenMovil` (opciones con `{ texto }`). */
export function logicaAPreguntasMovil(logica: PreguntaLogica[]): PreguntaExamenMovil[] {
  return logica.map((q) => ({
    id: q.id,
    pregunta: q.texto,
    opciones: q.opciones.map((texto) => ({ texto })),
  }));
}

/** Convierte respuestas por texto de vuelta a índices de opción (para `respuestas_logica`). */
export function respuestasMovilALogica(
  logica: PreguntaLogica[],
  porTexto: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of logica) {
    const t = porTexto[q.id];
    if (typeof t !== 'string') continue;
    const idx = q.opciones.indexOf(t);
    if (idx >= 0) out[q.id] = idx;
  }
  return out;
}

export function puntajePersonalidad(
  respuestas: Record<string, number>,
  rol?: RolExamen | string,
): number {
  if (rol === 'tecnico') return puntajePersonalidadTecnicoObra(respuestas);
  const ids = PREGUNTAS_PERSONALIDAD.map((p) => p.id);
  let sum = 0;
  let n = 0;
  for (const id of ids) {
    const v = normalizarValorPersonalidad(Number(respuestas[id]));
    if (v != null) {
      sum += v;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const avg = sum / n;
  return ((avg - 1) / 3) * 100;
}

/** Personalidad obra: 20 ítems situacionales (índice de opción 0–3). */
export function puntajePersonalidadTecnicoObra(respuestas: Record<string, number>): number {
  let sum = 0;
  let n = 0;
  for (const q of PREGUNTAS_SITUACIONALES_OBRA) {
    const v = Number(respuestas[q.id]);
    if (Number.isInteger(v) && v >= 0 && v <= 3) {
      sum += puntajeOpcionSituacionalObra(v, q.mejor, q.riesgo);
      n += 1;
    }
  }
  if (n === 0) return 0;
  return sum / n;
}

export function puntajeLogica(
  rol: RolExamen,
  respuestas: Record<string, number>,
): { puntaje: number; correctas: number; gma0a5: number } {
  const qs = rol === 'tecnico' ? LOGICA_TECNICO : LOGICA_PROGRAMADOR;
  let correctas = 0;
  for (const q of qs) {
    const r = respuestas[q.id];
    if (typeof r === 'number' && r === q.correcta) correctas += 1;
  }
  const gma0a5 = correctas;
  return { puntaje: (correctas / qs.length) * 100, correctas, gma0a5 };
}

/** Ítems frecuencia programador (1–4; baja respuesta ⇒ más riesgo). */
const IDS_INTEGRIDAD_RIESGO = ['p05', 'p06', 'p09', 'p17', 'p18', 'p19'] as const;

/**
 * Nivel de riesgo de integridad 0–10 (mayor = peor).
 * Basado en respuestas bajas en ítems de ética, seguridad y conducta bajo presión.
 */
export function nivelIntegridadRiesgo(
  respuestas: Record<string, number>,
  rol?: RolExamen | string,
): number {
  if (rol === 'tecnico') {
    let suma = 0;
    let n = 0;
    for (const q of PREGUNTAS_SITUACIONALES_OBRA) {
      const v = Number(respuestas[q.id]);
      if (Number.isInteger(v) && v >= 0 && v <= 3) {
        suma += v === q.riesgo ? 3 : v === q.mejor ? 0 : 1.5;
        n += 1;
      } else {
        suma += 1.5;
        n += 1;
      }
    }
    const maxRaw = n * 3;
    return Math.round(((suma / maxRaw) * 10 + Number.EPSILON) * 100) / 100;
  }

  let suma = 0;
  let n = 0;
  for (const id of IDS_INTEGRIDAD_RIESGO) {
    const v = normalizarValorPersonalidad(Number(respuestas[id]));
    if (v != null) {
      suma += 4 - v;
      n += 1;
    } else {
      suma += 2;
      n += 1;
    }
  }
  const maxRaw = IDS_INTEGRIDAD_RIESGO.length * 3;
  return Math.round(((suma / maxRaw) * 10 + Number.EPSILON) * 100) / 100;
}

export { esPreguntaSituacionalObra, PREGUNTAS_SITUACIONALES_OBRA };

export type { ValorFrecuenciaPersonalidad };

/** Combinación lineal simple (ajustable). */
export function puntajeTotal(pers: number, log: number): number {
  return pers * 0.45 + log * 0.55;
}
