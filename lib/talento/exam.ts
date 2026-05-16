import type {
  ExamenGenerado,
  PreguntaExamenMovil,
  PreguntaLogica,
  PreguntaPersonalidad,
  RolExamen,
} from '@/types/talento';

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

export const PREGUNTAS_OBRERO = [
  {
    id: "obr_01",
    categoria: "seguridad",
    pregunta: "Estás trabajando en altura y notas que tu arnés de seguridad tiene una costura rota. ¿Qué haces?",
    opciones: [
      { texto: "Dejo de trabajar de inmediato, notifico al supervisor y pido un cambio de equipo.", valor: "A" },
      { texto: "Sigo usándolo con cuidado para no retrasar el avance del día.", valor: "B" },
      { texto: "No digo nada y espero a que el supervisor se dé cuenta en la revisión.", valor: "C" }
    ]
  },
  {
    id: "obr_02",
    categoria: "seguridad",
    pregunta: "Ves a un compañero fumando en un área con materiales inflamables. ¿Qué haces?",
    opciones: [
      { texto: "Le pido que apague el cigarrillo y aviso al supervisor.", valor: "A" },
      { texto: "Me alejo del área para no estar en riesgo.", valor: "B" },
      { texto: "No digo nada para no tener problemas con él.", valor: "C" }
    ]
  },
  {
    id: "obr_03",
    categoria: "herramientas",
    pregunta: "Encuentras una herramienta costosa tirada en el suelo y nadie la está usando. ¿Qué haces?",
    opciones: [
      { texto: "La recojo y la entrego al almacén o al supervisor.", valor: "A" },
      { texto: "La dejo donde está para que su dueño la encuentre.", valor: "B" },
      { texto: "La guardo en mi bolso para usarla después.", valor: "C" }
    ]
  },
  {
    id: "obr_04",
    categoria: "seguridad",
    pregunta: "El supervisor te pide realizar una tarea para la que no tienes el equipo de protección adecuado. ¿Qué haces?",
    opciones: [
      { texto: "Le explico que necesito el equipo de protección antes de empezar.", valor: "A" },
      { texto: "Hago la tarea rápido para no perder tiempo.", valor: "B" },
      { texto: "La hago sin decir nada para no contradecir al jefe.", valor: "C" }
    ]
  },
  {
    id: "obr_05",
    categoria: "puntualidad",
    pregunta: "Te das cuenta de que vas a llegar tarde a tu turno por un problema con el transporte. ¿Qué haces?",
    opciones: [
      { texto: "Aviso a mi supervisor antes de la hora de entrada.", valor: "A" },
      { texto: "Llego y pido disculpas al entrar.", valor: "B" },
      { texto: "Entro a trabajar sin decir nada para que no lo noten.", valor: "C" }
    ]
  },
  {
    id: "obr_06",
    categoria: "seguridad",
    pregunta: "Notas que un cable de una máquina eléctrica está pelado. ¿Qué haces?",
    opciones: [
      { texto: "Desconecto la máquina y reporto el daño de inmediato.", valor: "A" },
      { texto: "Tengo cuidado de no tocar esa parte del cable.", valor: "B" },
      { texto: "Sigo usando la máquina para terminar el trabajo.", valor: "C" }
    ]
  },
  {
    id: "obr_07",
    categoria: "integridad",
    pregunta: "Un compañero te pide que firmes la lista de asistencia por él porque llegará tarde. ¿Qué haces?",
    opciones: [
      { texto: "Me niego y le digo que debe firmar él mismo.", valor: "A" },
      { texto: "Le digo que le avise al supervisor.", valor: "B" },
      { texto: "Firma por él para ayudarlo.", valor: "C" }
    ]
  },
  {
    id: "obr_08",
    categoria: "orden",
    pregunta: "Al terminar la jornada sobra una pequeña cantidad de material. ¿Qué haces?",
    opciones: [
      { texto: "Lo devuelvo al almacén o lo dejo en el área designada.", valor: "A" },
      { texto: "Lo dejo en el sitio donde estaba trabajando.", valor: "B" },
      { texto: "Me lo llevo a casa ya que es poco y no se notará.", valor: "C" }
    ]
  },
  {
    id: "obr_09",
    categoria: "seguridad",
    pregunta: "Ves a una persona desconocida caminando por la obra sin casco ni identificación. ¿Qué haces?",
    opciones: [
      { texto: "Aviso de inmediato al personal de seguridad o al supervisor.", valor: "A" },
      { texto: "Le pregunto qué busca y lo guío.", valor: "B" },
      { texto: "Ignoro a la persona y sigo con mi trabajo.", valor: "C" }
    ]
  },
  {
    id: "obr_10",
    categoria: "equipo",
    pregunta: "Tu compañero de cuadrilla se quita los lentes de seguridad porque dice que le molestan. ¿Qué haces?",
    opciones: [
      { texto: "Le recuerdo que es obligatorio y peligroso no usarlos.", valor: "A" },
      { texto: "No le digo nada, es su decisión.", valor: "B" },
      { texto: "Me quito los míos también para estar igual.", valor: "C" }
    ]
  },
  {
    id: "obr_11",
    categoria: "operacion",
    pregunta: "Te asignan una tarea nueva que nunca has realizado y no estás seguro de cómo hacerla. ¿Qué haces?",
    opciones: [
      { texto: "Pido a un compañero experimentado o al supervisor que me explique.", valor: "A" },
      { texto: "Intento hacerla observando a otros.", valor: "B" },
      { texto: "Digo que sé hacerla y trato de adivinar.", valor: "C" }
    ]
  },
  {
    id: "obr_12",
    categoria: "seguridad",
    pregunta: "Encuentras un charco de aceite en un pasillo transitado. ¿Qué haces?",
    opciones: [
      { texto: "Limpio el área o coloco una señalización y aviso.", valor: "A" },
      { texto: "Camino con cuidado para no pisarlo.", valor: "B" },
      { texto: "Paso de largo sin hacer nada.", valor: "C" }
    ]
  },
  {
    id: "obr_13",
    categoria: "conducta",
    pregunta: "Un grupo de compañeros está hablando mal de la empresa y del supervisor. ¿Qué haces?",
    opciones: [
      { texto: "No participo en la conversación y me concentro en mi trabajo.", valor: "A" },
      { texto: "Escucho sin opinar.", valor: "B" },
      { texto: "Me uno a ellos y comparto mis quejas.", valor: "C" }
    ]
  },
  {
    id: "obr_14",
    categoria: "responsabilidad",
    pregunta: "Te piden quedarte una hora extra para terminar un vaciado crítico. ¿Qué haces?",
    opciones: [
      { texto: "Acepto apoyar al equipo para terminar la tarea.", valor: "A" },
      { texto: "Digo que no puedo y me voy.", valor: "B" },
      { texto: "Me quejo con todos pero me quedo de mala gana.", valor: "C" }
    ]
  },
  {
    id: "obr_15",
    categoria: "seguridad",
    pregunta: "Falta iluminación en el área donde debes trabajar de noche. ¿Qué haces?",
    opciones: [
      { texto: "Reporto la falta de luz y espero a que se solucione.", valor: "A" },
      { texto: "Uso la linterna de mi teléfono.", valor: "B" },
      { texto: "Trabajo a oscuras con más cuidado.", valor: "C" }
    ]
  },
  {
    id: "obr_16",
    categoria: "conducta",
    pregunta: "Un supervisor te llama la atención de forma fuerte e irrespetuosa. ¿Qué haces?",
    opciones: [
      { texto: "Mantengo la calma y reporto el incidente a RRHH después.", valor: "A" },
      { texto: "Le pido que no me hable así.", valor: "B" },
      { texto: "Le grito de vuelta para defenderme.", valor: "C" }
    ]
  },
  {
    id: "obr_17",
    categoria: "seguridad",
    pregunta: "Encuentras el candado de bloqueo de un equipo roto o quitado. ¿Qué haces?",
    opciones: [
      { texto: "No opero el equipo y aviso al encargado de seguridad.", valor: "A" },
      { texto: "Pregunto si ya terminaron de usarlo.", valor: "B" },
      { texto: "Prendo el equipo para ver si funciona.", valor: "C" }
    ]
  },
  {
    id: "obr_18",
    categoria: "integridad",
    pregunta: "Alguien de afuera te ofrece dinero por dejarlo sacar un saco de cemento. ¿Qué haces?",
    opciones: [
      { texto: "Rechazo la oferta y lo reporto de inmediato.", valor: "A" },
      { texto: "Le digo que no y me voy.", valor: "B" },
      { texto: "Acepto el dinero, un saco no hará falta.", valor: "C" }
    ]
  },
  {
    id: "obr_19",
    categoria: "seguridad",
    pregunta: "Ves que el extintor de tu área está vencido. ¿Qué haces?",
    opciones: [
      { texto: "Lo reporto al supervisor para que lo cambien.", valor: "A" },
      { texto: "Espero a que pasen revisando.", valor: "B" },
      { texto: "No le doy importancia, rara vez se usan.", valor: "C" }
    ]
  },
  {
    id: "obr_20",
    categoria: "equipo",
    pregunta: "Un compañero se siente mal y dice que está mareado. ¿Qué haces?",
    opciones: [
      { texto: "Lo ayudo a sentarse y aviso al supervisor o médico.", valor: "A" },
      { texto: "Le digo que descanse un rato.", valor: "B" },
      { texto: "Le digo que siga trabajando para terminar rápido.", valor: "C" }
    ]
  }
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

/**
 * Genera el examen de 25 preguntas: 20 personalidad fijas + 5 lógica según rol.
 */
export function generarExamenAdaptativo(rol: string): any {
  if (rol === 'obrero' || rol === 'vigilante') {
    return {
      rol,
      personalidad: PREGUNTAS_OBRERO,
      logica: [],
    };
  }
  const logica = rol === 'programador' ? LOGICA_PROGRAMADOR : LOGICA_TECNICO;
  return {
    rol,
    personalidad: PREGUNTAS_PERSONALIDAD,
    logica,
  };
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
