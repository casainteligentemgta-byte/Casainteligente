// Cliente de Supabase de mentira con datos inventados (ningún cliente real).

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
    { id: 'b1000000-0000-4000-8000-000000000001', customer_id: C1, subtotal: 8450.5, status: 'pagado', created_at: '2026-03-04T15:00:00Z', items: [{ product_id: 1, qty: 2, unit_price: 48 }] },
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
  products: [
    { id: 1, nombre: 'Cámara domo IP 4MP de ejemplo', categoria: 'C.C.T.V', subcategoria: 'Cámaras IP', modelo: 'EJ-CAM-4MP', proveedor_url: 'https://electronica.com.ve/ejemplo/1-camara-de-ejemplo.html', marca: 'Marca Demo', descripcion: 'Cámara de demostración para interiores.', costo: 40, precio: 40, utilidad: 0, cantidad: 0, imagen: null, disponibilidad_proveedor: 'disponible' },
    { id: 2, nombre: 'Switch 8 puertos PoE de ejemplo', categoria: 'Network', modelo: 'EJ-SW-8P', proveedor_url: 'https://electronica.com.ve/ejemplo/2-switch-de-ejemplo.html', marca: 'Marca Demo', descripcion: 'Switch de demostración.', costo: 60, precio: 60, utilidad: 0, cantidad: 0, imagen: null, disponibilidad_proveedor: 'no_disponible' },
    { id: 3, nombre: 'Cerradura inteligente de ejemplo', categoria: 'Domótica', modelo: 'EJ-CERR-1', proveedor_url: 'https://electronica.com.ve/ejemplo/3-cerradura-de-ejemplo.html', marca: 'Marca Demo', descripcion: 'Cerradura con huella y tarjeta.', costo: 90, precio: 150, utilidad: 60, cantidad: 0, imagen: null, disponibilidad_proveedor: 'en_transito', manual_instrucciones: 'Paso 1: instalar la placa.\nPaso 2: registrar la huella.' },
    { id: 4, nombre: 'Instalación de punto de cámara (ejemplo)', categoria: 'Servicio', modelo: null, marca: null, descripcion: 'Mano de obra por punto instalado.', costo: 10, precio: 25, utilidad: 15, cantidad: 0, imagen: null },
    { id: 5, nombre: 'Energizador de cerco de ejemplo', categoria: 'Cercos Eléctricos', modelo: 'EJ-CERCO-5', proveedor_url: 'https://electronica.com.ve/ejemplo/5-energizador-de-ejemplo.html', marca: 'Marca Demo', descripcion: '', costo: 70, precio: 110, utilidad: 40, cantidad: 0, imagen: null },
    { id: 6, nombre: 'Tubo conduit PVC 1/2" de ejemplo', categoria: 'Materiales', modelo: null, marca: null, descripcion: null, costo: null, precio: null, utilidad: null, cantidad: 0, imagen: null },
    { id: 7, nombre: 'Cable UTP cat 6 de ejemplo (caja)', categoria: '', modelo: 'EJ-UTP-6', marca: 'Marca Demo', descripcion: 'Caja de 305 m.', costo: 80, precio: 80, utilidad: 0, cantidad: 0, imagen: null },
    { id: 8, nombre: 'Cámara domo IP 4MP de ejemplo', categoria: 'C.C.T.V', subcategoria: 'Cámaras IP', modelo: 'EJ-CAM-4MP-B', marca: 'Marca Demo', descripcion: 'Copia repetida para el ejemplo.', costo: 42, precio: 42, utilidad: 0, cantidad: 0, imagen: null },
    { id: 9, nombre: 'Disco duro 2TB de vigilancia (ejemplo)', categoria: 'C.C.T.V', subcategoria: 'Otros dispositivos', modelo: 'EJ-HDD-2T', marca: 'Marca Demo', descripcion: 'Disco para grabador.', costo: 65, precio: 65, utilidad: 0, cantidad: 0, imagen: null },
  ],
  product_categories: [
    ...['C.C.T.V', 'Servicio', 'Cercos Eléctricos', 'Internet', 'Domótica', 'Network', 'Materiales', 'Herramientas', 'Insumos', 'Consumibles'].map((name, i) => ({ id: `cat-${i}`, name, kind: 'comercial', sort_order: (i + 1) * 10, parent_id: null, created_at: '2026-01-01T00:00:00Z' })),
    ...['Cámaras IP', 'Cámaras Análogas', 'Otros dispositivos', 'Accesorios'].map((name, i) => ({ id: `sub-${i}`, name, kind: 'comercial', sort_order: (i + 1) * 10, parent_id: 'cat-0', created_at: '2026-01-01T00:00:00Z' })),
  ],
  global_inventory: [],
  ventas: [],
  empresas: [],
};

type Fila = Record<string, any>;

/** Consulta de mentira: filtra en memoria lo básico y deja pasar lo que no entiende. */
class Consulta implements PromiseLike<any> {
  private filas: Fila[];
  private conCuenta = false;
  private unica: 'maybe' | 'single' | null = null;
  private rango: [number, number] | null = null;
  private escritura = false;
  constructor(tabla: string) {
    this.filas = JSON.parse(JSON.stringify((tablas as Record<string, Fila[]>)[tabla] ?? []));
  }
  select(_cols?: string, opts?: { count?: string }) { if (opts?.count) this.conCuenta = true; return this; }
  eq(col: string, v: unknown) { if (!this.escritura) this.filas = this.filas.filter((f) => String(f[col] ?? '') === String(v ?? '')); return this; }
  neq() { return this; }
  in(col: string, vs: unknown[]) { const set = new Set(vs.map(String)); this.filas = this.filas.filter((f) => set.has(String(f[col] ?? ''))); return this; }
  ilike(col: string, patron: string) { const t = patron.replace(/%/g, '').toLowerCase(); this.filas = this.filas.filter((f) => String(f[col] ?? '').toLowerCase().includes(t)); return this; }
  or(expr: string) {
    const m = /ilike\.%([^%]*)%/.exec(expr);
    if (m) { const t = m[1].toLowerCase(); this.filas = this.filas.filter((f) => ['nombre', 'marca', 'modelo'].some((c) => String(f[c] ?? '').toLowerCase().includes(t))); }
    return this;
  }
  not() { return this; }
  is() { return this; }
  gte() { return this; }
  contains(col: string, valor: string) {
    try {
      const pid = JSON.parse(valor)[0]?.product_id;
      this.filas = this.filas.filter((f) => Array.isArray(f[col]) && f[col].some((it: Fila) => it.product_id === pid));
    } catch { /* se deja pasar */ }
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) {
    const asc = o?.ascending !== false;
    this.filas = [...this.filas].sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? ''), 'es', { numeric: true }) * (asc ? 1 : -1));
    return this;
  }
  range(a: number, b: number) { this.rango = [a, b]; return this; }
  limit(n: number) { this.rango = [0, n - 1]; return this; }
  insert() { this.escritura = true; return this; }
  update() { this.escritura = true; return this; }
  upsert() { this.escritura = true; return this; }
  delete() { this.escritura = true; return this; }
  maybeSingle() { this.unica = 'maybe'; return this.ejecutar(); }
  single() { this.unica = 'single'; return this.ejecutar(); }
  then(ok?: any, mal?: any) { return this.ejecutar().then(ok, mal); }
  private async ejecutar() {
    if (this.escritura) return { data: this.unica ? null : [], error: null, count: null };
    const total = this.filas.length;
    const filas = this.rango ? this.filas.slice(this.rango[0], this.rango[1] + 1) : this.filas;
    if (this.unica) return { data: filas[0] ?? null, error: null, count: null };
    return { data: filas, error: null, count: this.conCuenta ? total : null };
  }
}

export function createClient(): any {
  return {
    from: (tabla: string) => new Consulta(tabla),
    auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    storage: { from: () => ({ upload: async () => ({ data: null, error: { message: 'visor' } }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  };
}
export const IDS = { C1, C2, C3, C4 };
