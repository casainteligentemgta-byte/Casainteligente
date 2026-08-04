import {
  etiquetaFamiliaOficio,
  familiaOficioDesdeCargo,
  type FamiliaOficioObrero,
} from '@/lib/talento/familiaOficioObrero';

/** Misma forma que `PreguntaObrero` en exam.ts (evita import circular). */
export type PreguntaAbcObrero = {
  id: string;
  categoria: string;
  pregunta: string;
  opciones: { texto: string; valor: string }[];
};

/** Bloque de oficio: siempre `obr_16`…`obr_20` (mismas claves; cambia el texto). */
export type BloqueFamiliaAbc = readonly [
  PreguntaAbcObrero,
  PreguntaAbcObrero,
  PreguntaAbcObrero,
  PreguntaAbcObrero,
  PreguntaAbcObrero,
];

function q(
  id: string,
  categoria: string,
  pregunta: string,
  a: string,
  b: string,
  c: string,
): PreguntaAbcObrero {
  return {
    id,
    categoria,
    pregunta,
    opciones: [
      { texto: a, valor: 'A' },
      { texto: b, valor: 'B' },
      { texto: c, valor: 'C' },
    ],
  };
}

/** Frases cortas: escena + acción. Sin sermón. */

const GENERAL: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'La carretilla quedó llena de cemento. ¿Qué haces?',
    'La lavo antes de guardarla.',
    'La guardo así.',
    'La dejo tirada.',
  ),
  q(
    'obr_17',
    'oficio',
    'Cambian la orden y hay que deshacer tu trabajo. ¿Qué haces?',
    'Lo rehago como digan ahora.',
    'Me quejo todo el día.',
    'Amenazo con irme.',
  ),
  q(
    'obr_18',
    'oficio',
    '¿Sabes leer un plano sencillo de obra?',
    'Sí, me guío con él.',
    'Poco: prefiero que me digan de palabra.',
    'No.',
  ),
  q(
    'obr_19',
    'oficio',
    'Hay curso el sábado de seguridad u oficio. ¿Qué haces?',
    'Voy.',
    'Voy solo si es obligatorio.',
    'No voy.',
  ),
  q(
    'obr_20',
    'oficio',
    'Un compañero se accidentó. ¿Qué haces?',
    'Ayudo y pido que llamen la ambulancia.',
    'Corro a buscar al encargado.',
    'Me alejo.',
  ),
];

const OBRA_CIVIL: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'El andamio tiene una tabla floja. ¿Qué haces?',
    'No subo. Aviso al encargado.',
    'Subo por el otro lado.',
    'Subo igual.',
  ),
  q(
    'obr_17',
    'oficio',
    'La mezcla te quedó mal. ¿Qué haces?',
    'Aviso y la corrijo.',
    'La uso igual.',
    'La tiro escondido.',
  ),
  q(
    'obr_18',
    'oficio',
    'Te mandan a picar donde puede haber tubería. ¿Qué haces?',
    'Pregunto antes de picar.',
    'Pico despacio.',
    'Pico fuerte para acabar.',
  ),
  q(
    'obr_19',
    'oficio',
    'Sobró material y el encargado no está. ¿Qué haces?',
    'Lo dejo ordenado y aviso después.',
    'Lo dejo tirado.',
    'Me llevo un poco.',
  ),
  q(
    'obr_20',
    'oficio',
    'Quieren quitar el puntal antes de tiempo. ¿Qué haces?',
    'Digo que no y avisamos al encargado.',
    'Lo dejo: él sabrá.',
    'Ayudo a quitarlo.',
  ),
];

const ELECTRICIDAD: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'No sabes si el cable tiene corriente. ¿Qué haces?',
    'Verifico o pido que corten antes de tocar.',
    'Toco con cuidado.',
    'Empiezo de una vez.',
  ),
  q(
    'obr_17',
    'oficio',
    'Te faltan guantes o casco para el trabajo eléctrico. ¿Qué haces?',
    'No arranco sin protección.',
    'Hago “lo rapidito” sin eso.',
    'Trabajo sin protección.',
  ),
  q(
    'obr_18',
    'oficio',
    'Ves un cable pelado al alcance de cualquiera. ¿Qué haces?',
    'Aviso y lo aseguro.',
    'Sigo: no es mío.',
    'Lo dejo así.',
  ),
  q(
    'obr_19',
    'oficio',
    'Te piden probar algo y no estás seguro. ¿Qué haces?',
    'Pregunto al encargado antes.',
    'Pruebo a ver qué pasa.',
    'Si sale mal, culpo al ayudante.',
  ),
  q(
    'obr_20',
    'oficio',
    'Al terminar dejaron cables y herramientas en el piso. ¿Qué haces?',
    'Recojo y ordeno.',
    'Arrimo un poco con el pie.',
    'Me voy.',
  ),
];

const PLOMERIA: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'Vas a abrir una tubería y no sabes si hay presión. ¿Qué haces?',
    'Cierro llaves y desahogo antes.',
    'Abro despacio.',
    'Abro de una.',
  ),
  q(
    'obr_17',
    'oficio',
    'Hay una fuga mojando un área de paso o eléctrica. ¿Qué haces?',
    'Aviso y corto el agua si puedo.',
    'Sigo con otra cosa.',
    'La escondo con un trapo.',
  ),
  q(
    'obr_18',
    'oficio',
    'Te mandan pegar tubería en un sitio cerrado sin aire. ¿Qué haces?',
    'Pido ventilación antes.',
    'Aguanto un rato.',
    'Trabajo igual.',
  ),
  q(
    'obr_19',
    'oficio',
    'Al probar, gotea una unión. ¿Qué haces?',
    'La corrijo antes de dar por bueno.',
    'La dejo: casi no gotea.',
    'La tapo con cinta y digo que quedó.',
  ),
  q(
    'obr_20',
    'oficio',
    'Sobran piezas del almacén. ¿Qué haces?',
    'Las devuelvo o las anoto.',
    'Las dejo tiradas.',
    'Me llevo un par.',
  ),
];

const ESTRUCTURAS: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'La plataforma se siente floja. ¿Qué haces?',
    'Paro y pido que la aseguren.',
    'Sigo con cuidado.',
    'Sigo igual.',
  ),
  q(
    'obr_17',
    'oficio',
    'La cabilla no cuadra con lo que dijeron. ¿Qué haces?',
    'Pregunto antes de cortar.',
    'Arreglo a ojo.',
    'Corto igual.',
  ),
  q(
    'obr_18',
    'oficio',
    'Vas a soldar cerca de material que puede prender. ¿Qué haces?',
    'Aseguro el área y uso protección.',
    'Hago un poquito sin careta.',
    'Soldadura igual.',
  ),
  q(
    'obr_19',
    'oficio',
    'Vas a bajar hierro y hay alguien debajo. ¿Qué haces?',
    'Paro, aviso y bajamos juntos.',
    'Sigo: él debería mirar.',
    'Lo aviento para que se quite.',
  ),
  q(
    'obr_20',
    'oficio',
    'Quedan puntas de cabilla en el paso. ¿Qué haces?',
    'Las doblo o aviso.',
    'Las dejo.',
    'Las tapo con tierra.',
  ),
];

const EQUIPOS: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'La máquina o el vehículo tiene algo raro. ¿Qué haces?',
    'No opero. Aviso.',
    'Lo uso suavecito.',
    'Lo uso igual.',
  ),
  q(
    'obr_17',
    'oficio',
    'Te piden mover equipo con gente cerca y sin señalero. ¿Qué haces?',
    'Pido área libre y señalero.',
    'Avanzo despacio y toco pito.',
    'Avanzo rápido.',
  ),
  q(
    'obr_18',
    'oficio',
    'Al final del turno la máquina quedó mala. ¿Qué haces?',
    'Se lo digo al encargado.',
    'No digo nada.',
    'La dejo botada.',
  ),
  q(
    'obr_19',
    'oficio',
    'Te piden hacer algo fuera de la norma de la obra. ¿Qué haces?',
    'No lo hago.',
    'Lo hago un poco.',
    'Lo hago si me pagan aparte.',
  ),
  q(
    'obr_20',
    'oficio',
    'Hay aceite o combustible en el piso. ¿Qué haces?',
    'Aviso y limpio / contengo.',
    'Lo tapo con tierra.',
    'Lo dejo.',
  ),
];

const VIGILANCIA: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'Alguien quiere entrar sin permiso. ¿Qué haces?',
    'No dejo pasar. Aviso.',
    'Lo dejo un momentito.',
    'Lo dejo pasar si me cae bien.',
  ),
  q(
    'obr_17',
    'oficio',
    'Se llevan herramienta sin nota. ¿Qué haces?',
    'Los detengo y aviso.',
    'Miro para otro lado.',
    'Pido plata para dejarlos.',
  ),
  q(
    'obr_18',
    'oficio',
    'En la ronda hallas una reja abierta. ¿Qué haces?',
    'La reporto y la aseguro.',
    'Sigo la ronda.',
    'La dejo.',
  ),
  q(
    'obr_19',
    'oficio',
    'Te piden marcar la entrada de alguien que no vino. ¿Qué haces?',
    'No lo hago.',
    'Lo marco solo esta vez.',
    'Lo marco siempre.',
  ),
  q(
    'obr_20',
    'oficio',
    'Hay una emergencia en la puerta. ¿Qué haces?',
    'Aviso, pido ayuda y cuido el puesto.',
    'Salgo corriendo y dejo la puerta sola.',
    'Me escondo.',
  ),
];

const BLOQUES: Record<FamiliaOficioObrero, BloqueFamiliaAbc> = {
  general: GENERAL,
  obra_civil: OBRA_CIVIL,
  electricidad: ELECTRICIDAD,
  plomeria: PLOMERIA,
  estructuras: ESTRUCTURAS,
  equipos: EQUIPOS,
  vigilancia: VIGILANCIA,
};

export function bloqueAbcPorFamilia(familia: FamiliaOficioObrero): BloqueFamiliaAbc {
  return BLOQUES[familia] ?? GENERAL;
}

export function armarPreguntasAbcObrero(opts: {
  nucleo: readonly PreguntaAbcObrero[];
  cargo?: string | null;
  rolExamen?: string | null;
  codigoGoE?: string | null;
}): { preguntas: PreguntaAbcObrero[]; familia: FamiliaOficioObrero; etiquetaFamilia: string } {
  const familia = familiaOficioDesdeCargo({
    cargo: opts.cargo,
    rolExamen: opts.rolExamen,
    codigoGoE: opts.codigoGoE,
  });
  const bloque = bloqueAbcPorFamilia(familia);
  return {
    preguntas: [...opts.nucleo, ...bloque],
    familia,
    etiquetaFamilia: etiquetaFamiliaOficio(familia),
  };
}
