import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

const guardarFechaEspecialDeclaration: FunctionDeclaration = {
  name: 'guardarFechaEspecial',
  description:
    'Guarda un cumpleaños, cita, recordatorio o fecha especial en la base de datos de Supabase del usuario.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      titulo: {
        type: SchemaType.STRING,
        description:
          'El nombre del evento o de la persona. Ej: "Cumpleaños de Luis Arturo" o "Cita Médica".',
      },
      categoria: {
        type: SchemaType.STRING,
        format: 'enum',
        description: 'La categoría del evento.',
        enum: ['birthday', 'appointment', 'reminder', 'holiday'],
      },
      fecha: {
        type: SchemaType.STRING,
        description:
          'La fecha del evento en formato YYYY-MM-DD. Si el usuario dice "mañana" o "el próximo martes", calcula la fecha real basándote en el día de hoy.',
      },
      hora: {
        type: SchemaType.STRING,
        description:
          'Opcional. La hora del evento en formato HH:MM:SS si aplica (ej: para citas).',
      },
      notas: {
        type: SchemaType.STRING,
        description: 'Opcional. Cualquier detalle adicional o contexto que aporte el usuario.',
      },
    },
    required: ['titulo', 'categoria', 'fecha'],
  },
};

const consultarFechasEspecialesDeclaration: FunctionDeclaration = {
  name: 'consultarFechasEspeciales',
  description:
    'Consulta los cumpleaños o recordatorios guardados en un rango de fechas o por categoría.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      categoria: {
        type: SchemaType.STRING,
        format: 'enum',
        description: 'Opcional. Filtrar por tipo (ej: "birthday").',
        enum: ['birthday', 'appointment', 'reminder', 'holiday'],
      },
      mes: {
        type: SchemaType.INTEGER,
        description:
          'Opcional. Número del mes (1-12) para consultar eventos de un mes específico.',
      },
    },
  },
};

export const agendaTools = [
  {
    functionDeclarations: [
      guardarFechaEspecialDeclaration,
      consultarFechasEspecialesDeclaration,
    ],
  },
];

export const AGENDA_TOOL_NAMES = [
  'guardarFechaEspecial',
  'consultarFechasEspeciales',
] as const;

export type AgendaToolName = (typeof AGENDA_TOOL_NAMES)[number];
