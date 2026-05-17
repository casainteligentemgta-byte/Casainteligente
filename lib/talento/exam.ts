import type {
  ExamenGenerado,
  PreguntaExamenMovil,
  PreguntaLogica,
  PreguntaPersonalidad,
  RolExamen,
} from '@/types/talento';
export type PreguntaObrero = {
  id: string;
  categoria: string;
  pregunta: string;
  opciones: { texto: string; valor: string }[];
};

/** 20 ítems ABC — seguridad, responsabilidad, convivencia, herramientas y datos del obrero. */
export const PREGUNTAS_OBRERO: PreguntaObrero[] = [
  // Bloque 1: Seguridad y uso de equipos
  {
    id: 'obr_01',
    categoria: 'seguridad',
    pregunta:
      'Estás trabajando en altura y notas que tu arnés de seguridad tiene una costura rota. ¿Qué haces?',
    opciones: [
      {
        texto: 'Dejo de trabajar de inmediato, notifico al supervisor y pido un cambio de equipo.',
        valor: 'A',
      },
      { texto: 'Sigo usándolo con cuidado para no retrasar el avance del día.', valor: 'B' },
      {
        texto: 'No digo nada y espero a que el supervisor se dé cuenta en la revisión.',
        valor: 'C',
      },
    ],
  },
  {
    id: 'obr_02',
    categoria: 'seguridad',
    pregunta:
      'El supervisor te pide realizar una tarea en un área donde hay cables expuestos y un charco de agua. ¿Cómo reaccionas?',
    opciones: [
      {
        texto:
          'Le explico el peligro de electrocución y le pido secar el área o cortar la luz antes de empezar.',
        valor: 'A',
      },
      { texto: 'Hago el trabajo rápido y con cuidado para evitar pisar el agua.', valor: 'B' },
      {
        texto: 'Me niego a trabajar de mala manera y me voy a otra área de la obra.',
        valor: 'C',
      },
    ],
  },
  {
    id: 'obr_03',
    categoria: 'seguridad',
    pregunta: 'Ves a un compañero de cuadrilla trabajando sin sus botas de seguridad ni casco. ¿Qué haces?',
    opciones: [
      {
        texto: 'Le recuerdo de buena manera que se los ponga por su propia seguridad y la de todos.',
        valor: 'A',
      },
      { texto: 'No digo nada, es su responsabilidad y su problema si le pasa algo.', valor: 'B' },
      { texto: 'Me burlo de él o me quejo con los demás compañeros a sus espaldas.', valor: 'C' },
    ],
  },
  {
    id: 'obr_04',
    categoria: 'seguridad',
    pregunta: 'Te asignan una herramienta eléctrica que nunca has usado antes. ¿Qué haces?',
    opciones: [
      {
        texto:
          'Le digo honestamente al supervisor que no la conozco y le pido una explicación rápida de uso.',
        valor: 'A',
      },
      {
        texto:
          'Intento usarla viendo cómo la usan los demás, por miedo a que piensen que no sé trabajar.',
        valor: 'B',
      },
      { texto: 'La uso a mi manera, todas las herramientas funcionan parecido.', valor: 'C' },
    ],
  },
  {
    id: 'obr_05',
    categoria: 'seguridad',
    pregunta:
      'Termina la jornada y queda material y escombro atravesado en un pasillo de paso común. ¿Qué haces?',
    opciones: [
      {
        texto: 'Me tomo unos minutos para recogerlo y dejar el paso limpio y seguro antes de irme.',
        valor: 'A',
      },
      { texto: 'Lo arrimo un poco con el pie para que se pueda pasar a medias.', valor: 'B' },
      {
        texto: 'Me voy de inmediato, el turno ya terminó y eso lo puede recoger la cuadrilla de mañana.',
        valor: 'C',
      },
    ],
  },
  // Bloque 2: Responsabilidad, puntualidad y compromiso
  {
    id: 'obr_06',
    categoria: 'responsabilidad',
    pregunta:
      'El transporte público se retrasó y sabes que vas a llegar unos 20 o 30 minutos tarde a la obra. ¿Qué haces?',
    opciones: [
      {
        texto:
          'Llamo o escribo a mi supervisor de inmediato para avisarle la situación y mi hora estimada de llegada.',
        valor: 'A',
      },
      {
        texto: 'Llego directo a la obra e intento incorporarme callado para que nadie note el retraso.',
        valor: 'B',
      },
      {
        texto: 'Prefiero no ir a trabajar ese día y pongo una excusa médica al día siguiente.',
        valor: 'C',
      },
    ],
  },
  {
    id: 'obr_07',
    categoria: 'responsabilidad',
    pregunta:
      'Cometes un error en una mezcla o en una instalación y dañas un material por accidente. Nadie te vio. ¿Cómo actúas?',
    opciones: [
      { texto: 'Asumo el error de inmediato ante el encargado para ver cómo corregirlo rápido.', valor: 'A' },
      { texto: 'Dejo el material así y espero a ver si el error pasa desapercibido.', valor: 'B' },
      {
        texto: 'Muevo el material dañado al área de otra cuadrilla para que piensen que fueron ellos.',
        valor: 'C',
      },
    ],
  },
  {
    id: 'obr_08',
    categoria: 'responsabilidad',
    pregunta:
      'Te informan con tiempo que se necesita hacer una jornada de horas extra el sábado por un vaciado crítico. ¿Cuál es tu postura?',
    opciones: [
      {
        texto: 'Asisto al compromiso porque entiendo que es vital para la entrega del proyecto.',
        valor: 'A',
      },
      { texto: 'Pongo una excusa a última hora para no ir y quedarme descansando.', valor: 'B' },
      {
        texto: 'Exijo que me paguen el doble de lo legal en efectivo ese mismo día o amenazo con no ir.',
        valor: 'C',
      },
    ],
  },
  {
    id: 'obr_09',
    categoria: 'responsabilidad',
    pregunta:
      'Notas que a la obra están ingresando personas ajenas o que se está perdiendo herramienta pequeña del almacén. ¿Qué haces?',
    opciones: [
      {
        texto: 'Le informo al encargado de obra o al personal de seguridad en privado para que tomen medidas.',
        valor: 'A',
      },
      { texto: 'No me meto en problemas ajenos, mientras no me falte mi herramienta a mí.', valor: 'B' },
      { texto: 'Aprovecho el descontrol para guardarme algo pequeño yo también.', valor: 'C' },
    ],
  },
  {
    id: 'obr_10',
    categoria: 'responsabilidad',
    pregunta:
      'El supervisor sale de la obra por unas horas y la cuadrilla se queda sola sin supervisión directa. ¿Cómo actúas?',
    opciones: [
      { texto: 'Sigo trabajando al mismo ritmo con las tareas que ya me asignaron.', valor: 'A' },
      {
        texto: 'Bajo el ritmo de trabajo y aprovecho para descansar o revisar el teléfono más seguido.',
        valor: 'B',
      },
      {
        texto: 'Dejo de trabajar por completo y convenzo a los demás de hacer hora hasta que regrese.',
        valor: 'C',
      },
    ],
  },
  // Bloque 3: Trabajo en equipo y manejo de conflictos
  {
    id: 'obr_11',
    categoria: 'convivencia',
    pregunta:
      'Un compañero de tu misma cuadrilla trabaja más lento que tú debido a que tiene menos experiencia. ¿Qué haces?',
    opciones: [
      {
        texto: 'Le doy un par de consejos prácticos para ayudarlo a mejorar su velocidad y técnica.',
        valor: 'A',
      },
      { texto: 'Me molesto porque me atrasa el ritmo, pero no le digo nada directamente.', valor: 'B' },
      { texto: 'Me quejo en voz alta con los demás compañeros y me niego a trabajar a su lado.', valor: 'C' },
    ],
  },
  {
    id: 'obr_12',
    categoria: 'convivencia',
    pregunta:
      'Un compañero te pide prestada una herramienta que tienes asignada bajo tu responsabilidad. ¿Cómo actúas?',
    opciones: [
      {
        texto:
          'Se la presto anotando mentalmente y asegurándome de que me la devuelva limpia al final del turno.',
        valor: 'A',
      },
      { texto: 'Se la niego de mala manera para evitar cualquier riesgo con mi equipo.', valor: 'B' },
      { texto: 'Se la tiro o se la dejo en el suelo para que la busque él mismo.', valor: 'C' },
    ],
  },
  {
    id: 'obr_13',
    categoria: 'convivencia',
    pregunta:
      'Tienes una fuerte diferencia de opiniones con otro trabajador sobre cómo se debe realizar una tarea en la obra. ¿Cómo lo resuelven?',
    opciones: [
      {
        texto: 'Hablamos con calma y, si no nos ponemos de acuerdo, le consultamos al maestro de obra.',
        valor: 'A',
      },
      {
        texto: 'Hago el trabajo a mi manera cuando él se descuide para demostrar que tengo razón.',
        valor: 'B',
      },
      { texto: 'Le grito, lo insulto o lo reto a solucionar el problema fuera de la obra.', valor: 'C' },
    ],
  },
  {
    id: 'obr_14',
    categoria: 'convivencia',
    pregunta:
      'El maestro de obra te pide que apoyes temporalmente a otra cuadrilla en una tarea pesada que no te corresponde directamente. ¿Qué haces?',
    opciones: [
      {
        texto: 'Voy con buena actitud, entiendo que somos un mismo equipo y el proyecto debe avanzar.',
        valor: 'A',
      },
      { texto: 'Voy de mala gana y hago el mínimo esfuerzo posible en esa tarea.', valor: 'B' },
      { texto: 'Me niego rotundamente diciendo que ese no es mi trabajo ni mi problema.', valor: 'C' },
    ],
  },
  {
    id: 'obr_15',
    categoria: 'convivencia',
    pregunta:
      'Durante la hora del almuerzo, escuchas a un grupo de compañeros hablando mal del ingeniero o inventando chismes de la empresa. ¿Qué haces?',
    opciones: [
      { texto: 'Me mantengo al margen de los comentarios y me enfoco en descansar para mi turno.', valor: 'A' },
      { texto: 'Me quedo escuchando el chisme y asiento con la cabeza para no quedar mal.', valor: 'B' },
      { texto: 'Me uno a la conversación agregando más quejas e insultos sobre la empresa.', valor: 'C' },
    ],
  },
  // Bloque 4: Adaptabilidad, herramientas y datos del obrero
  {
    id: 'obr_16',
    categoria: 'herramientas',
    pregunta:
      'Al final del día, notas que la carretilla o herramienta que usaste está muy sucia de cemento o mezcla fresca. ¿Qué haces?',
    opciones: [
      { texto: 'La lavo y la limpio bien antes de guardarla en el almacén para que no se dañe.', valor: 'A' },
      { texto: 'La guardo así, mañana con un golpe de martillo se le cae la mezcla seca.', valor: 'B' },
      { texto: 'La dejo tirada en el sitio de trabajo para que el almacenista la busque.', valor: 'C' },
    ],
  },
  {
    id: 'obr_17',
    categoria: 'adaptabilidad',
    pregunta:
      'El plano o las instrucciones del proyecto cambian a mitad de camino y debes deshacer un trabajo que ya habías terminado. ¿Cómo reaccionas?',
    opciones: [
      {
        texto:
          'Comprendo que los cambios pasan en las obras, mantengo la calma y empiezo a rehacerlo según las nuevas órdenes.',
        valor: 'A',
      },
      { texto: 'Me quejo todo el día mientras arranco el trabajo de mala gana.', valor: 'B' },
      {
        texto:
          'Suelto las herramientas y amenazo con renunciar porque considero que me están haciendo perder el tiempo.',
        valor: 'C',
      },
    ],
  },
  {
    id: 'obr_18',
    categoria: 'datos_obrero',
    pregunta:
      'Con respecto a tu experiencia manejando planos mecánicos, eléctricos o de construcción civil simples:',
    opciones: [
      { texto: 'Sé leer planos básicos perfectamente y guiarme con ellos en el campo.', valor: 'A' },
      {
        texto:
          'Entiendo muy poco los planos, prefiero recibir instrucciones verbales directas de lo que debo hacer.',
        valor: 'B',
      },
      { texto: 'No sé leer planos en absoluto.', valor: 'C' },
    ],
  },
  {
    id: 'obr_19',
    categoria: 'datos_obrero',
    pregunta:
      'Si la empresa organiza cursos de capacitación los fines de semana sobre seguridad industrial o nuevas técnicas de construcción:',
    opciones: [
      { texto: 'Me inscribiría de inmediato, me interesa mucho aprender y mejorar en mi oficio.', valor: 'A' },
      { texto: 'Asistiría únicamente si es obligatorio para mantener mi puesto de trabajo.', valor: 'B' },
      { texto: 'No me interesa asistir, yo ya sé cómo hacer mi trabajo en el campo.', valor: 'C' },
    ],
  },
  {
    id: 'obr_20',
    categoria: 'datos_obrero',
    pregunta: 'Ante una situación de emergencia médica de un compañero dentro de la obra, ¿cómo actuarías?',
    opciones: [
      {
        texto:
          'Sé dar primeros auxilios básicos, mantengo la calma, ayudo al compañero y pido que llamen a la ambulancia.',
        valor: 'A',
      },
      {
        texto: 'Busco corriendo al encargado de obra o al vigilante para que ellos resuelvan la situación.',
        valor: 'B',
      },
      {
        texto: 'Me asusto, me quedo paralizado viendo o me alejo del lugar para no ver el accidente.',
        valor: 'C',
      },
    ],
  },
];

/** 20 ítems fijos (Likert 1–5): estabilidad emocional, trabajo en equipo, integridad operativa. */
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

const LOGICA_TECNICO: PreguntaLogica[] = [
  {
    id: 'lt1',
    texto: 'Antes de trabajar en un circuito alimentado, ¿qué debe verificarse primero?',
    opciones: [
      'Solo el color del cable',
      'Orden de fase en tablero',
      'Ausencia de tensión (puesta a tierra / bloqueo LOTO cuando aplique)',
      'Temperatura ambiente',
    ],
    correcta: 2,
  },
  {
    id: 'lt2',
    texto: 'En instalación de cámaras IP en exterior, ¿qué factor es crítico además de la resolución?',
    opciones: ['Solo el precio del monitor', 'Índice de protección (IP) y sellado', 'Color del empaque', 'Número de ventiladores RGB'],
    correcta: 1,
  },
  {
    id: 'lt3',
    texto: 'Un cable UTP para Gigabit en canal horizontal típico debería ser como mínimo:',
    opciones: ['Cat5 (sin más)', 'Cat5e o superior según norma del proyecto', 'Cable coaxial RG59', 'Par telefónico plano'],
    correcta: 1,
  },
  {
    id: 'lt4',
    texto: 'Medición de tierra de protección: buscamos resistencia:',
    opciones: ['Infinita', 'La más baja posible dentro de norma', 'Igual a la fase', 'Aleatoria'],
    correcta: 1,
  },
  {
    id: 'lt5',
    texto: 'Señal débil en punto de acceso inalámbrico. ¿Qué hipótesis revisar primero?',
    opciones: [
      'Cambiar logo de la empresa',
      'Fuente de alimentación PoE, canal RF, obstáculos y orientación de antenas',
      'Solo reiniciar el router del vecino',
      'Pintar la pared',
    ],
    correcta: 1,
  },
];

export type ExamenAdaptativoResult = ExamenGenerado | PreguntaObrero[];

export function esExamenObrero(examen: ExamenAdaptativoResult): examen is PreguntaObrero[] {
  return Array.isArray(examen);
}

function obtenerPreguntasTech(rol: RolExamen): ExamenGenerado {
  const logica = rol === 'programador' ? LOGICA_PROGRAMADOR : LOGICA_TECNICO;
  return {
    rol,
    personalidad: PREGUNTAS_PERSONALIDAD,
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
 * - programador / técnico: 20 Likert + 5 lógica
 * - obrero / vigilante: 20 situacionales ABC (`PREGUNTAS_OBRERO`)
 */
export function generarExamenAdaptativo(rol: string): ExamenAdaptativoResult {
  switch (rol) {
    case 'programador':
    case 'tecnico':
      return obtenerPreguntasTech(rol);
    case 'obrero':
    case 'vigilante':
      return PREGUNTAS_OBRERO;
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

export function puntajePersonalidad(respuestas: Record<string, number>): number {
  const ids = PREGUNTAS_PERSONALIDAD.map((p) => p.id);
  let sum = 0;
  let n = 0;
  for (const id of ids) {
    const v = respuestas[id];
    if (typeof v === 'number' && v >= 1 && v <= 5) {
      sum += v;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const avg = sum / n;
  return ((avg - 1) / 4) * 100;
}

export function puntajeLogica(
  rol: RolExamen,
  respuestas: Record<string, number>,
): { puntaje: number; correctas: number; gma0a5: number } {
  const qs = rol === 'programador' ? LOGICA_PROGRAMADOR : LOGICA_TECNICO;
  let correctas = 0;
  for (const q of qs) {
    const r = respuestas[q.id];
    if (typeof r === 'number' && r === q.correcta) correctas += 1;
  }
  const gma0a5 = correctas;
  return { puntaje: (correctas / qs.length) * 100, correctas, gma0a5 };
}

/** Ítems de personalidad usados para riesgo integridad (1–5 Likert; baja respuesta ⇒ más riesgo). */
const IDS_INTEGRIDAD_RIESGO = ['p05', 'p06', 'p09', 'p17', 'p18', 'p19'] as const;

/**
 * Nivel de riesgo de integridad 0–10 (mayor = peor).
 * Basado en respuestas bajas en ítems de ética, seguridad y conducta bajo presión.
 */
export function nivelIntegridadRiesgo(respuestas: Record<string, number>): number {
  let suma = 0;
  let n = 0;
  for (const id of IDS_INTEGRIDAD_RIESGO) {
    const v = respuestas[id];
    if (typeof v === 'number' && v >= 1 && v <= 5) {
      suma += 5 - v;
      n += 1;
    } else {
      suma += 3;
      n += 1;
    }
  }
  const maxRaw = IDS_INTEGRIDAD_RIESGO.length * 4;
  return Math.round(((suma / maxRaw) * 10 + Number.EPSILON) * 100) / 100;
}

/** Combinación lineal simple (ajustable). */
export function puntajeTotal(pers: number, log: number): number {
  return pers * 0.45 + log * 0.55;
}
