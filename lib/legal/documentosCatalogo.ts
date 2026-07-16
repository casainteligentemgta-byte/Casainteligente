export const LEGAL_TIPOS_DOCUMENTO = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'finiquito', label: 'Finiquito / liquidación' },
  { value: 'poder', label: 'Poder' },
  { value: 'carta', label: 'Carta / comunicación' },
  { value: 'escrito', label: 'Escrito / diligencia' },
  { value: 'acta', label: 'Acta' },
  { value: 'notificacion', label: 'Notificación' },
  { value: 'otro', label: 'Otro' },
] as const;

export const LEGAL_ESTADOS_DOCUMENTO = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'revision', label: 'En revisión' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'firmado', label: 'Firmado' },
  { value: 'archivado', label: 'Archivado' },
  { value: 'cancelado', label: 'Cancelado' },
] as const;

export type LegalPlantillaVariable = {
  key: string;
  label: string;
};

/** Sustituye {{clave}} en la plantilla. */
export function aplicarVariablesPlantilla(
  cuerpo: string,
  valores: Record<string, string | number | null | undefined>,
): string {
  return (cuerpo || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = valores[key];
    if (v == null || String(v).trim() === '') return `{{${key}}}`;
    return String(v);
  });
}
