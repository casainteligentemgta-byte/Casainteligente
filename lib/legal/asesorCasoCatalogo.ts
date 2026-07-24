/**
 * Catálogo de módulos / submódulos del Asesor de casos (entrevista dinámica).
 * La categoría alinea con LEGAL_CATEGORIAS (filtro RAG).
 * Ramas principales: Laboral, Civil, Mercantil, Tributario, Corporativo (+ Internacional).
 */

import { LEGAL_CATEGORIAS, type LegalCategoria } from '@/lib/legal/legalKnowledgeMetadata';

export const ASESOR_MAX_PREGUNTAS = 8;
export const ASESOR_MIN_PREGUNTAS_DICTAMEN = 4;

export type AsesorSubmodulo = {
  id: string;
  label: string;
  descripcion: string;
};

export type AsesorModulo = {
  id: LegalCategoria;
  label: string;
  submodulos: AsesorSubmodulo[];
};

export const ASESOR_MODULOS: AsesorModulo[] = [
  {
    id: 'laboral',
    label: 'Laboral',
    submodulos: [
      {
        id: 'despido',
        label: 'Despido / reenganche',
        descripcion: 'Terminación, estabilidad, reenganche, indemnizaciones',
      },
      {
        id: 'prestaciones',
        label: 'Prestaciones y liquidación',
        descripcion: 'Prestación de antigüedad, vacaciones, utilidades, finiquito',
      },
      {
        id: 'accidente_lopcymat',
        label: 'Accidente / LOPCYMAT',
        descripcion: 'Seguridad y salud en el trabajo, inspecciones, responsabilidades',
      },
      {
        id: 'contrato_trabajo',
        label: 'Contrato de trabajo',
        descripcion: 'Modalidades, cláusulas, modificación de condiciones',
      },
      {
        id: 'sanciones_disciplinarias',
        label: 'Sanciones disciplinarias',
        descripcion: 'Amonestaciones, suspensiones, procedimiento interno',
      },
      {
        id: 'otro_laboral',
        label: 'Otro laboral',
        descripcion: 'Otros conflictos o consultas laborales',
      },
    ],
  },
  {
    id: 'civil',
    label: 'Civil',
    submodulos: [
      {
        id: 'contratos_obra',
        label: 'Contratos de obra / servicios',
        descripcion: 'Incumplimiento, resolución, daños y perjuicios',
      },
      {
        id: 'cobro',
        label: 'Cobro / obligaciones',
        descripcion: 'Deudas, mora, garantías, títulos',
      },
      {
        id: 'responsabilidad_civil',
        label: 'Responsabilidad civil',
        descripcion: 'Daños a terceros, extracontractual',
      },
      {
        id: 'otro_civil',
        label: 'Otro civil',
        descripcion: 'Otros asuntos civiles',
      },
    ],
  },
  {
    id: 'mercantil',
    label: 'Mercantil',
    submodulos: [
      {
        id: 'sociedades',
        label: 'Sociedades',
        descripcion: 'Estatutos, socios, representación',
      },
      {
        id: 'contratos_mercantiles',
        label: 'Contratos mercantiles',
        descripcion: 'Compraventa, distribución, suministro',
      },
      {
        id: 'otro_mercantil',
        label: 'Otro mercantil',
        descripcion: 'Otros asuntos mercantiles',
      },
    ],
  },
  {
    id: 'tributario',
    label: 'Tributario',
    submodulos: [
      {
        id: 'islr',
        label: 'ISLR / retención',
        descripcion: 'Impuesto sobre la renta, retenciones, anticipos',
      },
      {
        id: 'iva',
        label: 'IVA',
        descripcion: 'Impuesto al valor agregado, créditos y débitos fiscales',
      },
      {
        id: 'fiscalizacion',
        label: 'Fiscalización / SENIAT',
        descripcion: 'Actas, reparos, recursos administrativos',
      },
      {
        id: 'municipales',
        label: 'Tributos municipales',
        descripcion: 'Patente, aseo, inmuebles urbanos',
      },
      {
        id: 'otro_tributario',
        label: 'Otro tributario',
        descripcion: 'Otros asuntos fiscales o aduaneros',
      },
    ],
  },
  {
    id: 'corporativo',
    label: 'Corporativo',
    submodulos: [
      {
        id: 'gobierno_corporativo',
        label: 'Gobierno corporativo',
        descripcion: 'Asambleas, juntas directivas, actas, poderes',
      },
      {
        id: 'fusiones_reestructuracion',
        label: 'Fusiones / reestructuración',
        descripcion: 'Transformación, fusión, escisión, liquidación',
      },
      {
        id: 'compliance',
        label: 'Compliance / due diligence',
        descripcion: 'Políticas internas, riesgos, revisión documental',
      },
      {
        id: 'contratos_corporativos',
        label: 'Contratos corporativos',
        descripcion: 'Acuerdos de socios, NDAs, JV, prestación de servicios',
      },
      {
        id: 'otro_corporativo',
        label: 'Otro corporativo',
        descripcion: 'Otros asuntos societarios o de empresa',
      },
    ],
  },
  {
    id: 'internacional',
    label: 'Internacional',
    submodulos: [
      {
        id: 'contratos_internacionales',
        label: 'Contratos internacionales',
        descripcion: 'Ley aplicable, jurisdicción, ejecución',
      },
      {
        id: 'otro_internacional',
        label: 'Otro internacional',
        descripcion: 'Otros asuntos con elemento extranjero',
      },
    ],
  },
];

export function moduloPorCategoria(categoria: string | null | undefined): AsesorModulo | null {
  if (!categoria) return null;
  return ASESOR_MODULOS.find((m) => m.id === categoria) ?? null;
}

export function submoduloLabel(
  categoria: string | null | undefined,
  submoduloId: string | null | undefined,
): string | null {
  if (!categoria || !submoduloId) return null;
  const mod = moduloPorCategoria(categoria);
  return mod?.submodulos.find((s) => s.id === submoduloId)?.label ?? submoduloId;
}

export function esCategoriaAsesor(v: unknown): v is LegalCategoria {
  return typeof v === 'string' && (LEGAL_CATEGORIAS as readonly string[]).includes(v);
}

export function esSubmoduloDeCategoria(
  categoria: string | null | undefined,
  submoduloId: string | null | undefined,
): boolean {
  if (!categoria || !submoduloId) return false;
  const mod = moduloPorCategoria(categoria);
  return Boolean(mod?.submodulos.some((s) => s.id === submoduloId));
}
