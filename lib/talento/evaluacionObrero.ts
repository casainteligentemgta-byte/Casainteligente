/**
 * Evaluación de talento — personal de campo (obrero).
 * DISC por colores (4 opciones, una por color, sin mostrar el nombre),
 * razonamiento lógico contextual, confiabilidad operativa.
 */

export type ColorPerfilObrero = 'Rojo' | 'Amarillo' | 'Verde' | 'Azul';

export type OpcionDiscObrero = { texto: string; color: ColorPerfilObrero };

export type PreguntaDiscObrero = {
  id: string;
  /** Situación corta de obra. */
  pregunta: string;
  /** Una conducta por color. El obrero no ve la etiqueta de color. */
  opciones: [OpcionDiscObrero, OpcionDiscObrero, OpcionDiscObrero, OpcionDiscObrero];
};

/** @deprecated Compat; el banco actual es PreguntaDiscObrero (4 opciones). */
export type ParDiscObrero = PreguntaDiscObrero;

export type PreguntaLogicaObrero = {
  id: string;
  texto: string;
  opciones: [string, string, string, string];
  correcta: 0 | 1 | 2 | 3;
};

export type PreguntaConfObrero = {
  id: string;
  texto: string;
  opciones: [string, string, string];
  /** Índice de la respuesta más alineada con protocolo / integridad. */
  mejor: 0 | 1 | 2;
};

function disc4(
  id: string,
  pregunta: string,
  rojo: string,
  amarillo: string,
  verde: string,
  azul: string,
): PreguntaDiscObrero {
  return {
    id,
    pregunta,
    opciones: [
      { texto: rojo, color: 'Rojo' },
      { texto: amarillo, color: 'Amarillo' },
      { texto: verde, color: 'Verde' },
      { texto: azul, color: 'Azul' },
    ],
  };
}

/**
 * 10 situaciones × 4 respuestas (Rojo / Amarillo / Verde / Azul).
 * Sin mostrar el color en pantalla: solo la conducta.
 */
export const PREGUNTAS_DISC_OBRERO: PreguntaDiscObrero[] = [
  disc4(
    'd01',
    'El día se atrasa y hay que entregar. ¿Qué haces tú?',
    'Apuro y decido rápido para alcanzar.',
    'Animo a la cuadrilla para que no se caiga el ánimo.',
    'Sigo el paso que dijo el encargado, sin apurar de más.',
    'Reviso medidas y material antes de seguir.',
  ),
  disc4(
    'd02',
    'Hay un lío en la cuadrilla. ¿Qué haces?',
    'Corto el lío y digo cómo se hace.',
    'Hablo con todos y calmo las aguas.',
    'Me mantengo en lo mío y espero la orden.',
    'Miro el problema con detalle y propongo un arreglo claro.',
  ),
  disc4(
    'd03',
    'El encargado aún no llega y hay que empezar. ¿Qué haces?',
    'Arranco ya con lo que hay.',
    'Organizo a la gente y les hablo.',
    'Espero la orden para no salirme.',
    'Reviso el área y dejo todo listo y ordenado.',
  ),
  disc4(
    'd04',
    'Hay duda de seguridad. ¿Qué haces?',
    'Busco la forma más rápida de seguir.',
    'Lo comento con la cuadrilla y vemos juntos.',
    'Paro y espero lo que diga el encargado.',
    'Paro, reviso bien y no sigo hasta estar seguro.',
  ),
  disc4(
    'd05',
    'Te mandan un trabajo repetitivo todo el día. ¿Qué haces?',
    'Lo saco rápido para pasar a otra cosa.',
    'Hablo y hago ambiente mientras trabajo.',
    'Sigo con paciencia, paso a paso.',
    'Cuido que cada pieza quede bien hecha.',
  ),
  disc4(
    'd06',
    'Hay que elegir cómo hacer una tarea. ¿Qué haces?',
    'Decido ya y seguimos.',
    'Oigo a todos y busco que todos estén de acuerdo.',
    'Hago lo que me mandaron, aunque piense otra cosa.',
    'Miro cuál opción queda más limpia y correcta.',
  ),
  disc4(
    'd07',
    'La obra está pesada y el ánimo bajo. ¿Qué haces?',
    'Empujo para que no se paren.',
    'Levanto el ánimo: hablo, animo, rio.',
    'Me acomodo al ritmo del grupo sin pelear.',
    'Me concentro en dejar el trabajo bien parejo.',
  ),
  disc4(
    'd08',
    'Ves un atajo que puede ahorrar tiempo. ¿Qué haces?',
    'Lo tomo si sirve para entregar hoy.',
    'Lo comento con la cuadrilla.',
    'No me salgo de lo acordado.',
    'Solo lo uso si es seguro y queda bien hecho.',
  ),
  disc4(
    'd09',
    'Al final del día, ¿qué te importa más?',
    'Ver avance y meta cumplida.',
    'Que la cuadrilla se vaya a gusto.',
    'Haber cumplido lo que me mandaron.',
    'Que el trabajo haya quedado limpio y bien hecho.',
  ),
  disc4(
    'd10',
    'Te piden apoyar a otra cuadrilla. ¿Qué haces?',
    'Voy y empujo para acabar rápido.',
    'Voy, saludo y me integro con la gente.',
    'Voy y hago lo que me indiquen.',
    'Voy y cuido que lo que haga quede bien.',
  ),
];

/** Alias del banco (4 opciones por pregunta). */
export const PARES_DISC_OBRERO = PREGUNTAS_DISC_OBRERO;

export const PREGUNTAS_LOGICA_OBRERO: PreguntaLogicaObrero[] = [
  {
    id: 'l01',
    texto: 'Muro de 3 m de alto × 4 m de ancho. Van 12 ladrillos por m². ¿Cuántos ladrillos?',
    opciones: ['144', '120', '168', '132'],
    correcta: 0,
  },
  {
    id: 'l02',
    texto: 'Escalera contra la pared: la pata quedó muy lejos. ¿Qué riesgo hay?',
    opciones: [
      'Se ve más bonita',
      'Puede resbalar o voltearse',
      'Subes más rápido',
      'Gastas menos material',
    ],
    correcta: 1,
  },
  {
    id: 'l03',
    texto: 'Varillas: 1 m, 2 m, 3 m, 4 m. ¿Cuál sigue?',
    opciones: ['4,5 m', '5 m', '6 m', '4 m'],
    correcta: 1,
  },
  {
    id: 'l04',
    texto: '48 bloques. Cada fila usa 8. ¿Cuántas filas completas?',
    opciones: ['5', '6', '7', '8'],
    correcta: 1,
  },
  {
    id: 'l05',
    texto: 'Dos cargan una viga. Uno suelta de golpe. ¿Qué hacer?',
    opciones: [
      'Soltar los dos sin avisar',
      'Contar 1-2-3 y bajar juntos',
      'Que cargue uno solo',
      'Dejarla en el aire',
    ],
    correcta: 1,
  },
  {
    id: 'l06',
    texto: 'Mezcla: 2 sacos de cemento y 6 de arena. ¿Qué proporción es?',
    opciones: [
      '1 cemento por 4 arena',
      '1 cemento por 3 arena',
      '2 cemento por 8 arena',
      '1 cemento por 6 arena',
    ],
    correcta: 1,
  },
];

export const PREGUNTAS_CONFIABILIDAD_OBRERO: PreguntaConfObrero[] = [
  {
    id: 'c01',
    texto: 'Hallaste un paquete caro que no es de tu cuadrilla. ¿Qué haces?',
    opciones: [
      'Se lo aviso al encargado.',
      'Me lo llevo a la casa.',
      'Lo vendo o lo reparto entre nosotros.',
    ],
    mejor: 0,
  },
  {
    id: 'c02',
    texto: 'Te piden firmar asistencia de un día que no viniste. ¿Qué haces?',
    opciones: [
      'No firmo. Digo la verdad.',
      'Firmo si todos firman.',
      'Firmo para no quedar mal.',
    ],
    mejor: 0,
  },
  {
    id: 'c03',
    texto: 'Hay un atajo peligroso que ahorra tiempo. ¿Qué haces?',
    opciones: [
      'No lo uso. Aviso al encargado.',
      'Lo uso si nadie me ve.',
      'Lo uso siempre que sea más rápido.',
    ],
    mejor: 0,
  },
  {
    id: 'c04',
    texto: 'Cometiste un error que puede dañar el trabajo. ¿Qué haces?',
    opciones: [
      'Aviso de una vez al encargado.',
      'Callo si nadie se dio cuenta.',
      'Le echo la culpa a otro.',
    ],
    mejor: 0,
  },
];

const ORDEN_DESEMPATE: ColorPerfilObrero[] = ['Azul', 'Verde', 'Amarillo', 'Rojo'];

const COLORES: ColorPerfilObrero[] = ['Rojo', 'Amarillo', 'Verde', 'Azul'];

export function esColorPerfilObrero(v: string): v is ColorPerfilObrero {
  return (COLORES as readonly string[]).includes(v);
}

/** Rota el orden visual para que el mismo color no quede siempre primero. */
export function opcionesDiscVisibles(q: PreguntaDiscObrero, idxPregunta: number): OpcionDiscObrero[] {
  const rot = ((idxPregunta % 4) + 4) % 4;
  const arr = [...q.opciones];
  return [...arr.slice(rot), ...arr.slice(0, rot)];
}

export function colorPredominanteDisc(
  respuestas: Record<string, ColorPerfilObrero | string>,
): ColorPerfilObrero {
  const cont: Record<ColorPerfilObrero, number> = {
    Rojo: 0,
    Amarillo: 0,
    Verde: 0,
    Azul: 0,
  };
  for (const q of PREGUNTAS_DISC_OBRERO) {
    const r = respuestas[q.id];
    if (typeof r === 'string' && esColorPerfilObrero(r)) cont[r] += 1;
  }
  let max = -1;
  const candidatos: ColorPerfilObrero[] = [];
  for (const c of COLORES) {
    if (cont[c] > max) {
      max = cont[c];
      candidatos.length = 0;
      candidatos.push(c);
    } else if (cont[c] === max && max >= 0) {
      candidatos.push(c);
    }
  }
  if (candidatos.length === 1) return candidatos[0]!;
  for (const c of ORDEN_DESEMPATE) {
    if (candidatos.includes(c)) return c;
  }
  return 'Verde';
}

export function puntajeLogicaObrero(respuestas: Record<string, number>): {
  correctas: number;
  total: number;
  porcentaje: number;
} {
  let correctas = 0;
  for (const q of PREGUNTAS_LOGICA_OBRERO) {
    const v = respuestas[q.id];
    if (typeof v === 'number' && v === q.correcta) correctas += 1;
  }
  const total = PREGUNTAS_LOGICA_OBRERO.length;
  return {
    correctas,
    total,
    porcentaje: total === 0 ? 0 : Math.round((correctas / total) * 10000) / 100,
  };
}

/** 0–100: 100 si elige la mejor opción, 50 si la intermedia, 0 si la peor. */
export function puntajeConfiabilidadObrero(respuestas: Record<string, number>): {
  porcentaje: number;
  puntosSuma: number;
} {
  let suma = 0;
  const maxPorPregunta = 100;
  for (const q of PREGUNTAS_CONFIABILIDAD_OBRERO) {
    const v = respuestas[q.id];
    if (typeof v !== 'number' || v < 0 || v > 2) continue;
    const dist = Math.abs(v - q.mejor);
    const p = dist === 0 ? 100 : dist === 1 ? 50 : 0;
    suma += p;
  }
  const n = PREGUNTAS_CONFIABILIDAD_OBRERO.length;
  const porcentaje = n === 0 ? 0 : Math.round((suma / (n * maxPorPregunta)) * 10000) / 100;
  return { porcentaje, puntosSuma: suma };
}

export function idsDiscObrero(): string[] {
  return PREGUNTAS_DISC_OBRERO.map((p) => p.id);
}

export function idsLogicaObrero(): string[] {
  return PREGUNTAS_LOGICA_OBRERO.map((p) => p.id);
}

export function idsConfObrero(): string[] {
  return PREGUNTAS_CONFIABILIDAD_OBRERO.map((p) => p.id);
}

export function totalPasosEvaluacionObrero(): number {
  return (
    PREGUNTAS_DISC_OBRERO.length + PREGUNTAS_LOGICA_OBRERO.length + PREGUNTAS_CONFIABILIDAD_OBRERO.length
  );
}

export function validarRespuestasCompletasObrero(body: {
  disc?: Record<string, string>;
  logica?: Record<string, number>;
  confiabilidad?: Record<string, number>;
}): string | null {
  for (const id of idsDiscObrero()) {
    const v = body.disc?.[id];
    if (!v || !esColorPerfilObrero(v)) return `Falta respuesta de color (${id})`;
  }
  for (const id of idsLogicaObrero()) {
    const v = body.logica?.[id];
    if (typeof v !== 'number' || v < 0 || v > 3) return `Falta respuesta lógica (${id})`;
  }
  for (const id of idsConfObrero()) {
    const v = body.confiabilidad?.[id];
    if (typeof v !== 'number' || v < 0 || v > 2) return `Falta respuesta confiabilidad (${id})`;
  }
  return null;
}

export function procesarEvaluacionObrero(body: {
  disc: Record<string, ColorPerfilObrero | string>;
  logica: Record<string, number>;
  confiabilidad: Record<string, number>;
}): {
  perfil_color: ColorPerfilObrero;
  puntuacion_logica: number;
  puntuacion_confiabilidad: number;
  gma_0_5: number;
  nivel_integridad_riesgo: number;
} {
  const perfil_color = colorPredominanteDisc(body.disc);
  const { porcentaje: puntuacion_logica, correctas } = puntajeLogicaObrero(body.logica);
  const { porcentaje: puntuacion_confiabilidad } = puntajeConfiabilidadObrero(body.confiabilidad);
  const totalL = PREGUNTAS_LOGICA_OBRERO.length;
  const gma_0_5 =
    totalL === 0 ? 0 : Math.min(5, Math.max(0, Math.round((correctas / totalL) * 5)));
  const nivel_integridad_riesgo = Math.round(10 * (1 - puntuacion_confiabilidad / 100) * 100) / 100;
  return {
    perfil_color,
    puntuacion_logica,
    puntuacion_confiabilidad,
    gma_0_5,
    nivel_integridad_riesgo,
  };
}
