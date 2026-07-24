/**
 * Primeras 15 ítems del examen «Obrero / técnico obra» (rol tecnico).
 * Situaciones de obra con léxico simple y 4 opciones.
 */

export type PreguntaSituacionalObra = {
  id: string;
  bloque: string;
  texto: string;
  opciones: [string, string, string, string];
  /** Índice de la mejor respuesta (0–3). */
  mejor: 0 | 1 | 2 | 3;
  /** Índice de la respuesta de mayor riesgo (0–3). */
  riesgo: 0 | 1 | 2 | 3;
};

export const PREGUNTAS_SITUACIONALES_OBRA: PreguntaSituacionalObra[] = [
  {
    id: 'to01',
    bloque: 'Seguridad',
    texto: 'Tu casco o arnés está roto. ¿Qué haces?',
    opciones: [
      'Paro, aviso al encargado y pido otro antes de seguir.',
      'Sigo con cuidado para no atrasar la cuadrilla.',
      'No digo nada y espero que nadie se fije.',
      'Me voy a otra área sin avisar.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'to02',
    bloque: 'Seguridad',
    texto: 'Hay cables sueltos y un charco con agua donde te mandan trabajar. ¿Qué haces?',
    opciones: [
      'Le digo al encargado el peligro y espero que corten luz o sequen.',
      'Entro rápido sin pisar el agua.',
      'Hago la faena igual porque «así siempre se ha hecho».',
      'Me niego a la mala y discuto fuerte con el encargado.',
    ],
    mejor: 0,
    riesgo: 2,
  },
  {
    id: 'to03',
    bloque: 'Seguridad',
    texto: 'Un compañero trabaja sin casco ni botas. ¿Qué haces?',
    opciones: [
      'Le recuerdo con respeto que se los ponga.',
      'No me meto, es su problema.',
      'Me río o hablo mal de él con otros.',
      'Le quito el casco a él también «para que sea justo».',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'to04',
    bloque: 'Seguridad',
    texto: 'Te dan una herramienta eléctrica que no conoces. ¿Qué haces?',
    opciones: [
      'Digo que no la sé usar y pido que me enseñen.',
      'La pruebo viendo a otro, sin decir nada.',
      'La uso a mi modo «todas son parecidas».',
      'La guardo y me voy a fumar.',
    ],
    mejor: 0,
    riesgo: 2,
  },
  {
    id: 'to05',
    bloque: 'Seguridad',
    texto: 'Al terminar el día queda basura y material en un pasillo. ¿Qué haces?',
    opciones: [
      'Recojo un poco y dejo el paso libre antes de irme.',
      'Lo empujo con el pie y me voy.',
      'Me voy: ya sonó la hora.',
      'Tiro todo por la ventana del edificio.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'to06',
    bloque: 'Puntualidad',
    texto: 'Vas a llegar tarde por el transporte. ¿Qué haces?',
    opciones: [
      'Llamo o escribo al encargado y digo a qué hora llego.',
      'Llego callado y me uno sin decir nada.',
      'No voy ese día y mañana invento excusa.',
      'Llego tarde y le reclamo al encargado por el retraso.',
    ],
    mejor: 0,
    riesgo: 2,
  },
  {
    id: 'to07',
    bloque: 'Responsabilidad',
    texto: 'Dañas un material por error y nadie lo vio. ¿Qué haces?',
    opciones: [
      'Lo digo al encargado para arreglarlo.',
      'Lo dejo ahí a ver si no se nota.',
      'Lo escondo en el área de otra cuadrilla.',
      'Lo vendo por fuera de la obra.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'to08',
    bloque: 'Responsabilidad',
    texto: 'Piden hora extra un sábado por un vaciado importante. ¿Qué haces?',
    opciones: [
      'Voy si puedo porque la obra lo necesita.',
      'Digo que sí y al final no aparece.',
      'Solo voy si me pagan extra en efectivo ese mismo día o no voy.',
      'Voy pero trabajo lento a propósito.',
    ],
    mejor: 0,
    riesgo: 2,
  },
  {
    id: 'to09',
    bloque: 'Responsabilidad',
    texto: 'Ves que entra gente que no es de la obra o falta herramienta chica. ¿Qué haces?',
    opciones: [
      'Aviso al encargado o al vigilante en privado.',
      'No me meto si a mí no me falta nada.',
      'Aprovecho y me guardo algo también.',
      'Les abro la reja yo mismo.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'to10',
    bloque: 'Responsabilidad',
    texto: 'El encargado sale un rato y la cuadrilla queda sola. ¿Qué haces?',
    opciones: [
      'Sigo con lo que me mandaron.',
      'Bajo el ritmo y miro mucho el teléfono.',
      'Paro y hacemos hora hasta que vuelva.',
      'Nos vamos todos a comprar sin avisar.',
    ],
    mejor: 0,
    riesgo: 2,
  },
  {
    id: 'to11',
    bloque: 'Equipo',
    texto: 'Un compañero va más lento porque es nuevo. ¿Qué haces?',
    opciones: [
      'Le explico un truco corto para ayudarlo.',
      'Me quejo con otros a sus espaldas.',
      'Le quito material para que se atrase más.',
      'Le digo al encargado que lo saquen de la cuadrilla.',
    ],
    mejor: 0,
    riesgo: 2,
  },
  {
    id: 'to12',
    bloque: 'Equipo',
    texto: 'Hay un reclamo fuerte entre dos compañeros cerca tuyo. ¿Qué haces?',
    opciones: [
      'Pido calma y llamo al encargado si no se arregla.',
      'Grabo con el teléfono para mandarlo al grupo.',
      'Me meto a golpes para «defender» a uno.',
      'Incito para que se peleen más.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'to13',
    bloque: 'Equipo',
    texto: 'Te cambian de cuadrilla y no conoces a nadie. ¿Qué haces?',
    opciones: [
      'Me presento y pregunto qué toca hacer.',
      'Me quedo callado y espero órdenes sin preguntar.',
      'Digo que no trabajaré con esa gente.',
      'Falto el primer día «para ver cómo reaccionan».',
    ],
    mejor: 0,
    riesgo: 2,
  },
  {
    id: 'to14',
    bloque: 'Orden',
    texto: 'Te piden guardar herramienta y dejar el área ordenada al cierre. ¿Qué haces?',
    opciones: [
      'Lo hago aunque me tome unos minutos más.',
      'Dejo la herramienta tirada «mañana se recoge».',
      'Escondo herramienta para usarla solo yo.',
      'Tiro escombro en la calle pública.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'to15',
    bloque: 'Emergencia',
    texto: 'Hay un accidente leve con sangre en la obra. ¿Qué haces?',
    opciones: [
      'Pido ayuda, aviso al encargado y cuido al herido si sé cómo.',
      'Sigo trabajando como si nada.',
      'Me asusto, grabo y no aviso a nadie.',
      'Huyo de la obra sin decir nada.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'p16',
    bloque: 'Obra',
    texto: 'Sigo con mi trabajo cuando el encargado no está cerca.',
    opciones: [
      'Siempre sigo con la faena que me tocó.',
      'Casi siempre; a veces bajo un poco el paso.',
      'Solo si la tarea es fácil o me apuran.',
      'Paro, descanso mucho o me distraigo hasta que vuelva.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'p17',
    bloque: 'Obra',
    texto: 'Si veo un problema en la obra, se lo digo al encargado.',
    opciones: [
      'Siempre se lo digo enseguida.',
      'Casi siempre, sobre todo si es grave.',
      'Solo si me lo preguntan o si me afecta a mí.',
      'No digo nada para no meter problemas.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'p18',
    bloque: 'Obra',
    texto: 'Mantengo la calma cuando hay apuros o reclamos.',
    opciones: [
      'Sí, me concentro y busco cómo resolver.',
      'Casi siempre, aunque me estrese un poco.',
      'Me pongo nervioso y discuto con la gente.',
      'Pierdo los nervios y empeoro la situación.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'p19',
    bloque: 'Obra',
    texto: 'Cumplo las reglas de la obra aunque nadie me esté mirando.',
    opciones: [
      'Siempre las cumplo.',
      'Casi siempre.',
      'Solo cuando hay supervisor o cámara.',
      'Si no me ven, hago lo que me conviene.',
    ],
    mejor: 0,
    riesgo: 3,
  },
  {
    id: 'p20',
    bloque: 'Obra',
    texto: 'Trato bien a los compañeros de cuadrilla.',
    opciones: [
      'Siempre con respeto.',
      'Casi siempre.',
      'Solo con los que me caen bien.',
      'A veces los trato mal, los ignoro o peleo.',
    ],
    mejor: 0,
    riesgo: 3,
  },
];

/** @deprecated Usar `PREGUNTAS_SITUACIONALES_OBRA` (ahora incluye p16–p20). */
export const PREGUNTAS_FRECUENCIA_OBRA = PREGUNTAS_SITUACIONALES_OBRA.filter((p) =>
  ['p16', 'p17', 'p18', 'p19', 'p20'].includes(p.id),
);

export function esPreguntaSituacionalObra(
  p: { id: string; mejor?: number; riesgo?: number; opciones?: unknown },
): p is PreguntaSituacionalObra {
  return (
    typeof (p as PreguntaSituacionalObra).mejor === 'number' &&
    typeof (p as PreguntaSituacionalObra).riesgo === 'number' &&
    Array.isArray((p as PreguntaSituacionalObra).opciones) &&
    (p as PreguntaSituacionalObra).opciones.length === 4
  );
}

export function puntajeOpcionSituacionalObra(elegida: number, mejor: number, riesgo: number): number {
  if (elegida === mejor) return 100;
  if (elegida === riesgo) return 0;
  return 50;
}
