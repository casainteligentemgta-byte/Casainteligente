/** Schema JSON para Gemini (responseSchema) — Metron. */

export const METRON_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    disciplina: {
      type: 'string',
      description: 'arq | est | ele | san | red | cctv | mixta | desconocida',
    },
    especialidades: {
      type: 'array',
      items: { type: 'string' },
      description: 'Disciplinas detectadas en el plano',
    },
    titulo_plano: { type: 'string' },
    escala_detectada: { type: 'string' },
    resumen: { type: 'string' },
    supuestos: {
      type: 'array',
      items: { type: 'string' },
    },
    alertas: {
      type: 'array',
      items: { type: 'string' },
    },
    computos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          codigo_sugerido: { type: 'string' },
          descripcion: { type: 'string' },
          unidad: { type: 'string' },
          cantidad: { type: 'number' },
          precio_unitario_estimado: { type: 'number' },
          monto_estimado: { type: 'number' },
          capitulo_sugerido: { type: 'string' },
          supuesto: { type: 'string' },
          confianza: { type: 'number' },
          disciplina: { type: 'string' },
        },
        required: [
          'descripcion',
          'unidad',
          'cantidad',
          'precio_unitario_estimado',
          'monto_estimado',
          'confianza',
          'disciplina',
        ],
      },
    },
  },
  required: ['disciplina', 'resumen', 'computos'],
} as const;
