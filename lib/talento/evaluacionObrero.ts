/**
 * Evaluación de talento — personal de campo (obrero).
 * DISC por colores (pares forzados), razonamiento lógico contextual, confiabilidad operativa.
 */

export type ColorPerfilObrero = 'Rojo' | 'Amarillo' | 'Verde' | 'Azul';

export type ParDiscObrero = {
  id: string;
  a: { texto: string; color: ColorPerfilObrero };
  b: { texto: string; color: ColorPerfilObrero };
};

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

/** Textos en léxico de obra (Venezuela): corto, claro, sin palabras de oficina. */
export const PARES_DISC_OBRERO: ParDiscObrero[] = [
  {
    id: 'd01',
    a: { texto: 'Quiero terminar lo del día aunque tenga que decidir rápido.', color: 'Rojo' },
    b: { texto: 'Mido y reviso el material antes de seguir, aunque me tarde un poco más.', color: 'Azul' },
  },
  {
    id: 'd02',
    a: { texto: 'Animo a la cuadrilla cuando el trabajo está pesado.', color: 'Amarillo' },
    b: { texto: 'Sigo el ritmo y hago lo que dice el encargado, paso a paso.', color: 'Verde' },
  },
  {
    id: 'd03',
    a: { texto: 'Si vamos atrasados, apuro para recuperar tiempo y cumplir.', color: 'Rojo' },
    b: { texto: 'Si vamos atrasados, pregunto y arreglo con calma para no fallar.', color: 'Verde' },
  },
  {
    id: 'd04',
    a: { texto: 'Digo en voz alta qué voy a hacer para que todos sepan.', color: 'Amarillo' },
    b: { texto: 'Me concentro en hacer bien lo que quedó escrito o acordado.', color: 'Azul' },
  },
  {
    id: 'd05',
    a: { texto: 'Decido ahí mismo, sin esperar mucha reunión.', color: 'Rojo' },
    b: { texto: 'Prefiero que digan cómo se hace y yo no me salgo de eso.', color: 'Verde' },
  },
  {
    id: 'd06',
    a: { texto: 'Me gusta hablar con la gente y arreglar líos en la cuadrilla.', color: 'Amarillo' },
    b: { texto: 'Me gusta dejar el trabajo limpio, parejo y bien hecho.', color: 'Azul' },
  },
  {
    id: 'd07',
    a: { texto: 'Si hay duda de seguridad, paro y pido que me digan qué hacer.', color: 'Azul' },
    b: { texto: 'Si hay duda de seguridad, busco cómo seguir sin parar la obra.', color: 'Rojo' },
  },
  {
    id: 'd08',
    a: { texto: 'Prefiero que la cuadrilla esté a gusto aunque vayamos más despacio.', color: 'Amarillo' },
    b: { texto: 'Prefiero que cada quien haga lo suyo, sin tanta vuelta.', color: 'Rojo' },
  },
  {
    id: 'd09',
    a: { texto: 'Hago lo que me mandan, aunque yo piense otra cosa.', color: 'Verde' },
    b: { texto: 'Si veo una forma más rápida y segura, la digo.', color: 'Rojo' },
  },
  {
    id: 'd10',
    a: { texto: 'Me gusta el ambiente con la cuadrilla, hablar y reír.', color: 'Amarillo' },
    b: { texto: 'Me gusta dejar las filas o la instalación bien derechas.', color: 'Azul' },
  },
  {
    id: 'd11',
    a: { texto: 'Prefiero ver avance hoy, aunque queden detalles chiquitos.', color: 'Rojo' },
    b: { texto: 'Prefiero acabar bien los detalles, aunque avance menos el día.', color: 'Azul' },
  },
  {
    id: 'd12',
    a: { texto: 'Oigo a todos antes de hacer algo.', color: 'Amarillo' },
    b: { texto: 'Sigo trabajando con paciencia, aunque el oficio se repita mucho.', color: 'Verde' },
  },
  {
    id: 'd13',
    a: { texto: 'Me gusta que digan que mi trabajo queda bien hecho y a norma.', color: 'Azul' },
    b: { texto: 'Me gusta levantar el ánimo cuando el día está feo o pesado.', color: 'Amarillo' },
  },
  {
    id: 'd14',
    a: { texto: 'Me acomodo al ritmo de la cuadrilla sin pelear.', color: 'Verde' },
    b: { texto: 'Empujo a la cuadrilla a ir más rápido cuando hay que entregar.', color: 'Rojo' },
  },
];

export const PREGUNTAS_LOGICA_OBRERO: PreguntaLogicaObrero[] = [
  {
    id: 'l01',
    texto:
      'Un muro mide 3 metros de alto y 4 metros de ancho. Si cada metro cuadrado lleva 12 ladrillos, ¿cuántos ladrillos hacen falta?',
    opciones: ['144', '120', '168', '132'],
    correcta: 0,
  },
  {
    id: 'l02',
    texto: 'Pones una escalera contra la pared. Si la pata queda muy lejos de la pared, ¿qué puede pasar?',
    opciones: [
      'Que se vea más bonita',
      'Que resbale o se voltee',
      'Que subas más rápido',
      'Que gastes menos material',
    ],
    correcta: 1,
  },
  {
    id: 'l03',
    texto: 'Trozos de varilla: 1 m, 2 m, 3 m, 4 m. ¿Cuál sigue?',
    opciones: ['4,5 m', '5 m', '6 m', '4 m'],
    correcta: 1,
  },
  {
    id: 'l04',
    texto: 'Tienes 48 bloques. Cada fila del muro usa 8. ¿Cuántas filas completas sales?',
    opciones: ['5', '6', '7', '8'],
    correcta: 1,
  },
  {
    id: 'l05',
    texto: 'Dos cargan una viga, uno en cada punta. Si uno suelta de golpe, el otro siente casi todo el peso. ¿Qué es lo correcto?',
    opciones: [
      'Soltar los dos sin avisar',
      'Contar «1-2-3» y bajar juntos',
      'Que cargue uno solo para ir más rápido',
      'Dejar la viga en el aire sin apoyo',
    ],
    correcta: 1,
  },
  {
    id: 'l06',
    texto: 'La mezcla lleva 2 sacos de cemento y 6 de arena. ¿Cuánto cemento va por cada parte de arena?',
    opciones: ['1 de cemento por 4 de arena', '1 de cemento por 3 de arena', '2 de cemento por 8 de arena', '1 de cemento por 6 de arena'],
    correcta: 1,
  },
];

export const PREGUNTAS_CONFIABILIDAD_OBRERO: PreguntaConfObrero[] = [
  {
    id: 'c01',
    texto: 'Encuentras en la obra un paquete de material caro que no es de tu cuadrilla y nadie lo reclama. ¿Qué haces?',
    opciones: [
      'Se lo aviso al encargado y lo dejo anotado o por WhatsApp del trabajo.',
      'Me lo llevo a la casa hasta que alguien pregunte.',
      'Lo vendo o lo reparto con compañeros para sacar plata.',
    ],
    mejor: 0,
  },
  {
    id: 'c02',
    texto: 'Te piden firmar la asistencia de un día que tú no trabajaste. ¿Qué haces?',
    opciones: [
      'No firmo y digo la verdad.',
      'Firmo solo si todos firman.',
      'Firmo para no quedar mal.',
    ],
    mejor: 0,
  },
  {
    id: 'c03',
    texto: 'Ves un atajo que rompe una norma de seguridad, pero ahorra tiempo. ¿Qué haces?',
    opciones: [
      'No lo uso. Le digo al encargado otra forma segura.',
      'Lo uso solo si nadie me ve.',
      'Lo uso siempre que sea más rápido.',
    ],
    mejor: 0,
  },
  {
    id: 'c04',
    texto: 'Cometes un error que puede dañar el trabajo. ¿Qué es lo mejor?',
    opciones: [
      'Avisar de una vez para corregirlo con el encargado.',
      'Callarlo si nadie se dio cuenta.',
      'Echarle la culpa al que trajo el material, aunque no sepas.',
    ],
    mejor: 0,
  },
];

const ORDEN_DESEMPATE: ColorPerfilObrero[] = ['Azul', 'Verde', 'Amarillo', 'Rojo'];

export function colorPredominanteDisc(respuestas: Record<string, 'a' | 'b'>): ColorPerfilObrero {
  const cont: Record<ColorPerfilObrero, number> = {
    Rojo: 0,
    Amarillo: 0,
    Verde: 0,
    Azul: 0,
  };
  for (const par of PARES_DISC_OBRERO) {
    const r = respuestas[par.id];
    if (r === 'a') cont[par.a.color] += 1;
    else if (r === 'b') cont[par.b.color] += 1;
  }
  let max = -1;
  const candidatos: ColorPerfilObrero[] = [];
  for (const c of ['Rojo', 'Amarillo', 'Verde', 'Azul'] as const) {
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
  return PARES_DISC_OBRERO.map((p) => p.id);
}

export function idsLogicaObrero(): string[] {
  return PREGUNTAS_LOGICA_OBRERO.map((p) => p.id);
}

export function idsConfObrero(): string[] {
  return PREGUNTAS_CONFIABILIDAD_OBRERO.map((p) => p.id);
}

export function totalPasosEvaluacionObrero(): number {
  return PARES_DISC_OBRERO.length + PREGUNTAS_LOGICA_OBRERO.length + PREGUNTAS_CONFIABILIDAD_OBRERO.length;
}

export function validarRespuestasCompletasObrero(body: {
  disc?: Record<string, string>;
  logica?: Record<string, number>;
  confiabilidad?: Record<string, number>;
}): string | null {
  for (const id of idsDiscObrero()) {
    const v = body.disc?.[id];
    if (v !== 'a' && v !== 'b') return `Falta respuesta DISC (${id})`;
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
  disc: Record<string, 'a' | 'b'>;
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
