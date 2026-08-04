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

const GENERAL: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'Al final del día la carretilla o herramienta quedó llena de cemento o mezcla. ¿Qué haces?',
    'La lavo bien antes de guardarla, para que no se dañe.',
    'La guardo así: mañana con el martillo se le cae lo seco.',
    'La dejo tirada para que el almacenista la busque.',
  ),
  q(
    'obr_17',
    'oficio',
    'Cambian el plano o la orden y tienes que deshacer un trabajo que ya habías terminado. ¿Qué haces?',
    'Me calmo: en obra eso pasa, y lo rehago como digan ahora.',
    'Me quejo todo el día y lo hago de mala gana.',
    'Suelto las herramientas y amenazo con irme.',
  ),
  q(
    'obr_18',
    'oficio',
    'Sobre leer planos sencillos de obra:',
    'Sí sé leer planos básicos y guiarme con ellos en el campo.',
    'Entiendo poco: prefiero que me digan de palabra qué hacer.',
    'No sé leer planos.',
  ),
  q(
    'obr_19',
    'oficio',
    'Si la empresa da cursos el fin de semana de seguridad o de oficio:',
    'Voy: me gusta aprender y mejorar.',
    'Voy solo si es obligatorio para no perder el puesto.',
    'No voy: yo ya sé hacer mi trabajo.',
  ),
  q(
    'obr_20',
    'oficio',
    'Un compañero tiene una emergencia médica en la obra. ¿Qué haces?',
    'Mantengo la calma, ayudo como pueda y pido que llamen la ambulancia.',
    'Corro a buscar al encargado o al vigilante para que ellos vean.',
    'Me asusto, me quedo quieto o me alejo para no ver.',
  ),
];

const OBRA_CIVIL: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'Vas a subir a un andamio y ves que una tabla está floja o podrida. ¿Qué haces?',
    'Paro, aviso al encargado y no subo hasta que lo arreglen.',
    'Subo con cuidado por el otro lado para no atrasar.',
    'Subo igual: “así hemos trabajado siempre”.',
  ),
  q(
    'obr_17',
    'oficio',
    'La mezcla te quedó muy aguada / muy seca y puede dañar el muro o el piso. ¿Qué haces?',
    'Lo digo al encargado y corrijo la mezcla antes de seguir.',
    'La uso igual para no botar material.',
    'La tiro escondido y pido otra sin decir por qué.',
  ),
  q(
    'obr_18',
    'oficio',
    'Te mandan a picar o demoler cerca de donde puede haber tubería o cable. ¿Qué haces?',
    'Pregunto y reviso antes de picar; si hay duda, paro.',
    'Pico despacio y “ojalá no haya nada”.',
    'Pico fuerte para acabar rápido.',
  ),
  q(
    'obr_19',
    'oficio',
    'Al vaciar o pañetar, te sobra material y el encargado no está. ¿Qué haces?',
    'Lo dejo bien tapado/ordenado y le aviso cuando vuelva.',
    'Lo dejo tirado donde estoy.',
    'Me llevo un poco “por si acaso en la casa”.',
  ),
  q(
    'obr_20',
    'oficio',
    'Un compañero quiere quitar el puntal o el soporte antes de tiempo. ¿Qué haces?',
    'Le digo que no; avisamos al encargado primero.',
    'Lo dejo: él sabrá.',
    'Lo ayudo a quitarlo para irnos más temprano.',
  ),
];

const ELECTRICIDAD: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'Vas a trabajar un tablero o cable y no sabes si hay corriente. ¿Qué haces?',
    'Verifico que esté sin corriente (o pido que corten) antes de tocar.',
    'Toco con cuidado “a ver si pega”.',
    'Empiezo de una vez para no perder tiempo.',
  ),
  q(
    'obr_17',
    'oficio',
    'Te falta el casco o los guantes aislantes para un trabajo eléctrico. ¿Qué haces?',
    'No arranco sin protección; pido el EPP al encargado.',
    'Hago solo “lo rapidito” sin guantes.',
    'Trabajo sin eso: total es un rato.',
  ),
  q(
    'obr_18',
    'oficio',
    'Ves un cable pelado o una caja abierta al alcance de cualquiera. ¿Qué haces?',
    'Aviso y lo aseguro / tapo según me indiquen.',
    'Sigo mi trabajo: no es mío.',
    'Lo dejo así; mañana alguien lo ve.',
  ),
  q(
    'obr_19',
    'oficio',
    'Te piden energizar o probar algo y no estás seguro del conexionado. ¿Qué haces?',
    'Paro y le pregunto al encargado o al eléctrico de mayor rango.',
    'Pruebo a ver qué pasa.',
    'Le echo la culpa al ayudante si sale mal.',
  ),
  q(
    'obr_20',
    'oficio',
    'Al terminar, dejan herramientas o sobrantes de cable en el piso del área eléctrica. ¿Qué haces?',
    'Recojo, ordeno y dejo el área segura.',
    'Arrimo un poco con el pie.',
    'Me voy: que lo recoja otro.',
  ),
];

const PLOMERIA: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'Vas a abrir una tubería y no sabes si hay presión o agua caliente. ¿Qué haces?',
    'Cierro llaves, desahogo y confirmo antes de abrir.',
    'Abro despacio a ver qué sale.',
    'Abro de una: si moja, se limpia.',
  ),
  q(
    'obr_17',
    'oficio',
    'Hay una fuga y el agua está mojando un área eléctrica o de paso. ¿Qué haces?',
    'Aviso al encargado, corto el agua si puedo y resguardo el área.',
    'Sigo con otra cosa y “luego veo”.',
    'Escondo la fuga con trapo y no digo nada.',
  ),
  q(
    'obr_18',
    'oficio',
    'Te mandan pegar o soldar tubería en un sitio cerrado sin ventilación. ¿Qué haces?',
    'Pido ventilación / EPP y no trabajo a humo cerrado.',
    'Aguanto un rato y ya.',
    'Enciendo fuego o químico igual, total es rápido.',
  ),
  q(
    'obr_19',
    'oficio',
    'Al probar la instalación, gotea una unión. ¿Qué haces?',
    'Lo reporto y lo corrijo antes de dar por bueno.',
    'Lo dejo: “casi no gotea”.',
    'Lo tapo con cinta y digo que quedó perfecto.',
  ),
  q(
    'obr_20',
    'oficio',
    'Sobran codos, pegamento o piezas del almacén al final del día. ¿Qué haces?',
    'Los devuelvo o los dejo anotados con el encargado.',
    'Los dejo tirados en la zona.',
    'Me llevo un par “para la casa”.',
  ),
];

const ESTRUCTURAS: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'Vas a amarrar o soldar y el andamio / plataforma se siente flojo. ¿Qué haces?',
    'Paro y pido que aseguren antes de seguir.',
    'Sigo con cuidado.',
    'Sigo igual: hay que entregar hoy.',
  ),
  q(
    'obr_17',
    'oficio',
    'La cabilla o el hierro no coincide con lo que dijo el encargado / plano. ¿Qué haces?',
    'Pregunto antes de cortar o armar mal.',
    'Arreglo “a ojo” para no parar.',
    'Corto igual y si sobra se botará.',
  ),
  q(
    'obr_18',
    'oficio',
    'Vas a soldar cerca de material inflamable o sin careta en regla. ¿Qué haces?',
    'Aseguro el área, uso protección y no soldo a la ligera.',
    'Hago un poquito sin careta.',
    'Soldadura aunque haya cartón o thinner cerca.',
  ),
  q(
    'obr_19',
    'oficio',
    'Al bajar hierro o encofrado, un compañero está debajo sin aviso. ¿Qué haces?',
    'Paro, aviso y bajamos coordinados.',
    'Sigo: él debería mirar.',
    'Lo aventó para que se quite.',
  ),
  q(
    'obr_20',
    'oficio',
    'Quedan puntas de cabilla o clavos salidos en el paso. ¿Qué haces?',
    'Los doblo/protejo o aviso para que no pinchen a nadie.',
    'Los dejo: no es mi zona.',
    'Los escondo con tierra para que no se vean.',
  ),
];

const EQUIPOS: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'Antes de operar máquina o vehículo, notas algo raro (freno, fuga, alarma). ¿Qué haces?',
    'No opero; aviso al encargado / mantenimiento.',
    'Lo uso igual “suavecito”.',
    'Lo uso: hay que sacar la producción.',
  ),
  q(
    'obr_17',
    'oficio',
    'Te piden mover equipo con gente cerca o sin señalero. ¿Qué haces?',
    'Pido área despejada y señalero antes de mover.',
    'Avanzo despacio y toco pito.',
    'Avanzo rápido para acabar.',
  ),
  q(
    'obr_18',
    'oficio',
    'Al final del turno, la máquina queda con fallas o sin combustible anotado. ¿Qué haces?',
    'Lo reporto y dejo constancia al encargado.',
    'No digo nada: que lo vea el de mañana.',
    'Lo dejo botado donde sea.',
  ),
  q(
    'obr_19',
    'oficio',
    'Te ofrecen “acelerar” sin permiso o fuera de la norma de la obra. ¿Qué haces?',
    'No lo hago; cumplo la norma y lo digo si insiste.',
    'Lo hago solo un poco.',
    'Lo hago si me pagan aparte en efectivo.',
  ),
  q(
    'obr_20',
    'oficio',
    'Hay un derrame de aceite/combustible en el piso. ¿Qué haces?',
    'Aviso, contengo y limpio según indiquen (riesgo de resbalón/fuego).',
    'Lo tapo con tierra y sigo.',
    'Lo dejo: no fue mío.',
  ),
];

const VIGILANCIA: BloqueFamiliaAbc = [
  q(
    'obr_16',
    'oficio',
    'Alguien quiere entrar a la obra sin identificación ni permiso. ¿Qué haces?',
    'No dejo pasar; aviso al encargado o a seguridad.',
    'Lo dejo “solo un momentito”.',
    'Lo dejo pasar si me cae bien.',
  ),
  q(
    'obr_17',
    'oficio',
    'Ves que se llevan herramienta o material sin nota de salida. ¿Qué haces?',
    'Detengo el procedimiento y aviso de una vez.',
    'Miro para otro lado.',
    'Pido una “colaboración” para dejarlos pasar.',
  ),
  q(
    'obr_18',
    'oficio',
    'En tu ronda encuentras una reja abierta o una luz apagada donde no debe. ¿Qué haces?',
    'Lo reporto y lo dejo anotado / asegurado.',
    'Sigo la ronda y ya.',
    'Lo dejo: no quiero problemas.',
  ),
  q(
    'obr_19',
    'oficio',
    'Un compañero te pide que marques su entrada aunque no vino. ¿Qué haces?',
    'No lo hago y digo la verdad.',
    'Lo marco solo esta vez.',
    'Lo marco siempre si me cae bien.',
  ),
  q(
    'obr_20',
    'oficio',
    'Hay una emergencia (incendio, pelea, accidente) en la puerta. ¿Qué haces?',
    'Sigo el protocolo: aviso, pido ayuda y no abandono el puesto sin orden.',
    'Salgo corriendo y dejo la puerta sola.',
    'Me escondo y no aviso.',
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
