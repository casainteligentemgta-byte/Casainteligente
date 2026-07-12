export type CategoriaNominaProyecto = 'obrero' | 'empleado';

export const ROLES_NOMINA_OBRERO = [
  { value: 'oficial', label: 'Oficial' },
  { value: 'ayudante', label: 'Ayudante' },
  { value: 'peon', label: 'Peón' },
  { value: 'vigilante', label: 'Vigilante' },
  { value: 'maquinista', label: 'Maquinista' },
  { value: 'electricista', label: 'Electricista' },
  { value: 'plomero', label: 'Plomero' },
  { value: 'carpintero', label: 'Carpintero' },
] as const;

export const ROLES_NOMINA_EMPLEADO = [
  { value: 'ingeniero_residente', label: 'Ingeniero residente' },
  { value: 'depositario', label: 'Depositario' },
  { value: 'supervisor', label: 'Supervisor de obra' },
  { value: 'coordinador', label: 'Coordinador' },
  { value: 'residente_calidad', label: 'Residente de calidad' },
  { value: 'seguridad', label: 'Seguridad industrial' },
  { value: 'logistica', label: 'Logística' },
  { value: 'administrativo', label: 'Administrativo' },
] as const;

export function rolesSugeridosNomina(categoria: CategoriaNominaProyecto) {
  return categoria === 'obrero' ? ROLES_NOMINA_OBRERO : ROLES_NOMINA_EMPLEADO;
}

export function etiquetaRolNomina(rol: string): string {
  const t = rol.trim();
  const todos = [...ROLES_NOMINA_OBRERO, ...ROLES_NOMINA_EMPLEADO];
  const hit = todos.find((r) => r.value === t);
  if (hit) return hit.label;
  return t.replace(/_/g, ' ');
}

export function esCategoriaNominaValida(v: string): v is CategoriaNominaProyecto {
  return v === 'obrero' || v === 'empleado';
}
