/**
 * Cargos típicos de empleado / administrativo para requisiciones (no tabulador de obra).
 * Códigos estables para `recruitment_needs.cargo_codigo`.
 */
export type CargoEmpleadoCatalogo = {
  codigo: string;
  nombre: string;
};

export const CATALOGO_EMPLEADOS: CargoEmpleadoCatalogo[] = [
  { codigo: 'ADM-RRHH', nombre: 'Analista / asistente de RRHH' },
  { codigo: 'ADM-CONT', nombre: 'Contador / contabilidad' },
  { codigo: 'ADM-ADM', nombre: 'Asistente administrativo' },
  { codigo: 'ADM-SEC', nombre: 'Secretaria / secretario ejecutivo' },
  { codigo: 'ADM-LOG', nombre: 'Coordinador logístico / almacén' },
  { codigo: 'ADM-COM', nombre: 'Compras / abastecimiento' },
  { codigo: 'ADM-LEG', nombre: 'Asistente legal / tramitador' },
  { codigo: 'ADM-SIS', nombre: 'Soporte TI / sistemas' },
  { codigo: 'ADM-OPE', nombre: 'Coordinador de operaciones (oficina)' },
];
