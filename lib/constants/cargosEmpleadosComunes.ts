/**
 * Cargos de oficina / administrativos frecuentes en Casa Inteligente.
 * No son tabulador GOE: sirven para afinar Psique y el banco de examen (`empleado` / `programador`).
 */

export type CargoEmpleadoComun = {
  id: string;
  nombre: string;
  /** Área orientativa */
  area: string;
  /** Semilla para Psique / banco de examen */
  rol_examen_sugerido: 'empleado' | 'programador' | 'tecnico';
};

export const CARGOS_EMPLEADOS_COMUNES: readonly CargoEmpleadoComun[] = [
  {
    id: 'contador',
    nombre: 'Contador',
    area: 'Finanzas',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'auxiliar-contable',
    nombre: 'Auxiliar contable',
    area: 'Finanzas',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'administrador',
    nombre: 'Administrador',
    area: 'Administración',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'ayudante-oficina',
    nombre: 'Ayudante de oficina',
    area: 'Administración',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'asistente-administrativo',
    nombre: 'Asistente administrativo',
    area: 'Administración',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'recepcionista',
    nombre: 'Recepcionista',
    area: 'Administración',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'dibujante',
    nombre: 'Dibujante / delineante',
    area: 'Técnico oficina',
    rol_examen_sugerido: 'tecnico',
  },
  {
    id: 'arquitecto',
    nombre: 'Arquitecto',
    area: 'Técnico oficina',
    rol_examen_sugerido: 'tecnico',
  },
  {
    id: 'ingeniero-residente',
    nombre: 'Ingeniero residente',
    area: 'Técnico oficina',
    rol_examen_sugerido: 'tecnico',
  },
  {
    id: 'project-manager',
    nombre: 'Project manager / coordinador de obra',
    area: 'Técnico oficina',
    rol_examen_sugerido: 'tecnico',
  },
  {
    id: 'comprador',
    nombre: 'Comprador / procura',
    area: 'Compras',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'almacenista',
    nombre: 'Almacenista',
    area: 'Logística',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'analista-rrhh',
    nombre: 'Analista de RRHH',
    area: 'Talento',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'chofer-admin',
    nombre: 'Chofer administrativo',
    area: 'Logística',
    rol_examen_sugerido: 'empleado',
  },
  {
    id: 'programador',
    nombre: 'Programador / desarrollador',
    area: 'TI',
    rol_examen_sugerido: 'programador',
  },
  {
    id: 'soporte-ti',
    nombre: 'Soporte TI',
    area: 'TI',
    rol_examen_sugerido: 'programador',
  },
] as const;

export function buscarCargoEmpleadoComun(idOrNombre: string): CargoEmpleadoComun | null {
  const q = idOrNombre.trim().toLowerCase();
  if (!q) return null;
  return (
    CARGOS_EMPLEADOS_COMUNES.find(
      (c) => c.id === q || c.nombre.toLowerCase() === q,
    ) ?? null
  );
}
