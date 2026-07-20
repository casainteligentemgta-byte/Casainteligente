/** Checklist operativo: programa del suegro → OneDrive → Casa Inteligente. */

export const CHECKLIST_EXPORT_SUEGRO = [
  {
    id: 'export',
    titulo: 'Exportar en el programa CCO',
    detalle:
      'Generar el maestro completo (GASTO, INGRESO, CONTRATO, PRESUPUESTO). El archivo debe incluir la columna ID (la misma del SQLite).',
  },
  {
    id: 'id',
    titulo: 'Verificar columna ID',
    detalle:
      'Sin ID, Casa Inteligente inventa hashes y un reimport puede desalinearse. Obligatorio para espejo 1:1.',
  },
  {
    id: 'onedrive',
    titulo: 'Publicar / guardar en OneDrive',
    detalle:
      'Carpeta acordada (ej. OneDrive/CasaInteligente/CCO). Nombre tipico: MAESTRO_….csv',
  },
  {
    id: 'obra',
    titulo: 'Elegir la misma obra en CI',
    detalle: 'Rancho Flamboyant u otra — un proyecto_id por obra del programa del suegro.',
  },
  {
    id: 'import',
    titulo: 'Importar en Contabilidad → CCO → Importar CSV',
    detalle:
      'O automático: npm run cco:import-onedrive (lee la carpeta sincronizada de OneDrive).',
  },
  {
    id: 'comparar',
    titulo: 'Comparar Contabilidad Oficial',
    detalle:
      'Ingresos, gastos netos y devaluación (~−25,6 %). Reimportar el mismo CSV actualiza, no duplica.',
  },
] as const;

export const COMANDO_IMPORT_ONEDRIVE =
  'npm run cco:import-onedrive -- --dir "C:\\\\Users\\\\…\\\\OneDrive\\\\CasaInteligente\\\\CCO" --proyecto-id <UUID>';

/** Cobertura de IDs explícitos del CSV (0–1). */
export function coberturaIdsExplicitos(conIdExplicit: number, total: number): number {
  if (total <= 0) return 0;
  return conIdExplicit / total;
}

export function mensajeAdvertenciaIds(conIdExplicit: number, total: number): string | null {
  if (total <= 0) return null;
  if (conIdExplicit <= 0) {
    return (
      'El CSV no trae columna ID (o está vacía). El reimport puede crear duplicados o montos distintos. ' +
      'Pida al programa del suegro exportar con ID.'
    );
  }
  const cov = coberturaIdsExplicitos(conIdExplicit, total);
  if (cov < 0.9) {
    return `Solo ${conIdExplicit} de ${total} filas tienen ID (${Math.round(cov * 100)}%). Conviene reexportar el maestro completo con ID en todas las filas.`;
  }
  return null;
}
