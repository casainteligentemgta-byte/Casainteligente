// Cliente de Supabase de mentira con datos inventados (ningún cliente real).
import { crearFakeSupabase } from '@/lib/telegram/testing/fakeSupabase';

const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';
const C3 = '33333333-3333-4333-8333-333333333333';
const C4 = '44444444-4444-4444-8444-444444444444';

const tablas = {
  customers: [
    { id: C1, nombre: 'Inversiones Ejemplo Uno, C.A.', razon_social: 'Inversiones Ejemplo Uno, C.A.', customer_type: 'juridico', tipo: 'J', rif: 'J-00000001-0', cedula: null, email: 'compras@ejemplo-uno.test', movil: '0414-0000001', telefono: '0414-0000001', direccion: 'Av. Principal, Torre Ejemplo, piso 4, Caracas', status: 'activo', representante_legal: 'María Demo', genero: null, estado_civil: null, profesion: null, apellido: null, created_at: '2025-02-10T14:00:00Z' },
    { id: C2, nombre: 'Carlos Prueba', apellido: 'Prueba', customer_type: 'natural', tipo: 'V', rif: null, cedula: 'V-00000002', email: 'carlos@prueba.test', movil: '0424-0000002', telefono: '0424-0000002', direccion: 'Urb. Los Ejemplos, calle 2, casa 14', status: 'activo', genero: 'M', estado_civil: 'casado', profesion: 'Ingeniero', created_at: '2026-01-20T14:00:00Z' },
    { id: C3, nombre: 'Ana Muestra', customer_type: 'natural', tipo: 'V', rif: null, cedula: null, email: '', movil: null, telefono: null, direccion: '', status: 'pendiente', genero: 'F', created_at: '2026-06-01T14:00:00Z' },
    { id: C4, nombre: 'Comercial Demostración, S.A.', razon_social: 'Comercial Demostración, S.A.', customer_type: 'juridico', tipo: 'J', rif: 'J-00000004-0', email: 'admin@demostracion.test', movil: '0212-0000004', direccion: 'Zona Industrial, galpón 7', status: 'inactivo', created_at: '2024-09-01T14:00:00Z' },
  ],
  budgets: [
    { id: 'b1000000-0000-4000-8000-000000000001', customer_id: C1, subtotal: 8450.5, status: 'pagado', created_at: '2026-03-04T15:00:00Z' },
    { id: 'b1000000-0000-4000-8000-000000000002', customer_id: C1, subtotal: 1200, status: 'cobrado', created_at: '2026-07-18T15:00:00Z' },
    { id: 'b1000000-0000-4000-8000-000000000003', customer_id: C1, subtotal: 640, status: 'parcialmente_pagado', created_at: '2026-08-02T15:00:00Z' },
    { id: 'b1000000-0000-4000-8000-000000000004', customer_id: C1, subtotal: 3100, status: 'enviado', created_at: '2026-09-21T15:00:00Z' },
    { id: 'b1000000-0000-4000-8000-000000000005', customer_id: C1, subtotal: 950, status: 'no_aprobado', created_at: '2026-05-11T15:00:00Z' },
    { id: 'b1000000-0000-4000-8000-000000000006', customer_id: C1, subtotal: 2000, status: 'aprobado', created_at: '2026-10-01T15:00:00Z' },
    { id: 'b1000000-0000-4000-8000-000000000007', customer_id: C1, subtotal: 400, status: 'no_enviado', created_at: '2026-10-05T15:00:00Z' },
  ],
  ci_proyectos: [
    { id: 'a1000000-0000-4000-8000-000000000001', customer_id: C1, nombre: 'Obra de ejemplo · Torre A', estado: 'ejecucion', tipo_proyecto: 'talento', monto_aproximado: 25000, obra_precio_venta_usd: 0, entidad_id: 'e1', ci_entidades: { nombre: 'Patrono Demo, C.A.', rif: 'J-00000009-0' }, created_at: '2026-02-01T00:00:00Z' },
    { id: 'a1000000-0000-4000-8000-000000000002', customer_id: C1, nombre: 'Obra de ejemplo · Local 3', estado: 'presupuestado', tipo_proyecto: null, monto_aproximado: 0, entidad_id: null, ci_entidades: null, created_at: '2026-08-01T00:00:00Z' },
    { id: 'a1000000-0000-4000-8000-000000000003', customer_id: C2, nombre: 'Casa de ejemplo', estado: 'nuevo', created_at: '2026-08-01T00:00:00Z' },
  ],
  ventas: [],
  empresas: [],
};

export function createClient(): any {
  const fake: any = crearFakeSupabase(JSON.parse(JSON.stringify(tablas)));
  return {
    from(tabla: string) {
      const q: any = fake.from(tabla);
      q.neq = function (col: string, v: unknown) { return this; };
      return q;
    },
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
  };
}
export const IDS = { C1, C2, C3, C4 };
