/**
 * Catálogo comercial del Módulo Abogado (producto Legal standalone).
 * Precios en USD orientativos (Venezuela / LatAm); cobro manual o futuro Stripe.
 */

export type PlanLegalComercialId = 'trial' | 'solo' | 'equipo' | 'estudio';

export type PlanLegalComercial = {
  id: PlanLegalComercialId;
  nombre: string;
  precioLabel: string;
  precioUsd: number | null;
  periodo: string;
  asientos: string;
  destacado?: boolean;
  bullets: string[];
  cta: string;
};

export const PLANES_LEGAL_COMERCIALES: PlanLegalComercial[] = [
  {
    id: 'trial',
    nombre: 'Prueba',
    precioLabel: 'Gratis',
    precioUsd: 0,
    periodo: '14 días',
    asientos: '1 abogado',
    bullets: [
      'Casos y bitácora de actuaciones',
      'Documentos y formatos',
      'Asesor legal (RAG)',
      'Cálculo de prestaciones',
    ],
    cta: 'Empezar prueba',
  },
  {
    id: 'solo',
    nombre: 'Solo',
    precioLabel: '$29',
    precioUsd: 29,
    periodo: '/ mes',
    asientos: '1 abogado',
    bullets: [
      'Todo lo de Prueba',
      'IurisVigía (inspecciones)',
      'Envío de contratos',
      'Soporte por correo',
    ],
    cta: 'Solicitar Solo',
  },
  {
    id: 'equipo',
    nombre: 'Equipo',
    precioLabel: '$79',
    precioUsd: 79,
    periodo: '/ mes',
    asientos: 'Hasta 5 asientos',
    destacado: true,
    bullets: [
      'Todo lo de Solo',
      'Varios abogados / asistentes',
      'Cola de casos compartida',
      'Prioridad de soporte',
    ],
    cta: 'Solicitar Equipo',
  },
  {
    id: 'estudio',
    nombre: 'Estudio',
    precioLabel: '$149',
    precioUsd: 149,
    periodo: '/ mes',
    asientos: 'Hasta 15 asientos',
    bullets: [
      'Todo lo de Equipo',
      'Varios despachos / marcas',
      'Onboarding asistido',
      'Contacto comercial directo',
    ],
    cta: 'Hablar con ventas',
  },
];

export function planComercialPorId(id: string): PlanLegalComercial | null {
  return PLANES_LEGAL_COMERCIALES.find((p) => p.id === id) ?? null;
}
