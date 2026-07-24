import type { AgendaToolName } from '@/lib/gemini/agendaTools';

export const AGENDA_TOOL_SCHEMA = {
  guardarFechaEspecial: {
    name: 'guardarFechaEspecial' as AgendaToolName,
    description:
      'Guarda un cumpleaños, cita, recordatorio o fecha especial en la base de datos de Supabase del usuario.',
    parameters: {
      type: 'object',
      properties: {
        titulo: {
          type: 'string',
          description:
            'El nombre del evento o de la persona. Ej: "Cumpleaños de Luis Arturo" o "Cita Médica".',
        },
        categoria: {
          type: 'string',
          enum: ['birthday', 'appointment', 'reminder', 'holiday'],
          description: 'La categoría del evento.',
        },
        fecha: {
          type: 'string',
          description:
            'La fecha del evento en formato YYYY-MM-DD. Si el usuario dice "mañana" o "el próximo martes", calcula la fecha real basándote en el día de hoy.',
        },
        hora: {
          type: 'string',
          description:
            'Opcional. La hora del evento en formato HH:MM:SS si aplica (ej: para citas).',
        },
        notas: {
          type: 'string',
          description: 'Opcional. Cualquier detalle adicional o contexto que aporte el usuario.',
        },
      },
      required: ['titulo', 'categoria', 'fecha'],
    },
  },
  consultarFechasEspeciales: {
    name: 'consultarFechasEspeciales' as AgendaToolName,
    description:
      'Consulta los cumpleaños o recordatorios guardados en un rango de fechas o por categoría.',
    parameters: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          enum: ['birthday', 'appointment', 'reminder', 'holiday'],
          description: 'Opcional. Filtrar por tipo (ej: "birthday").',
        },
        mes: {
          type: 'integer',
          description:
            'Opcional. Número del mes (1-12) para consultar eventos de un mes específico.',
        },
      },
    },
  },
} as const;

export function buildAgendaSystemPrompt(today: string): string {
  return [
    'Eres el asistente de agenda personal de Casa Inteligente.',
    'Ayudas a guardar y consultar cumpleaños, citas, recordatorios y fechas especiales.',
    `La fecha de hoy es ${today}.`,
    'Usa las herramientas disponibles cuando el usuario quiera registrar o consultar eventos.',
    'Responde siempre en español, de forma clara y breve.',
    'Si guardas un evento, confirma título, categoría y fecha.',
    'Si consultas eventos, resume los resultados de forma legible.',
  ].join('\n');
}
