import React from 'react';
import { createRoot } from 'react-dom/client';
import { IDS } from './stubs/supabase-client';

const q = new URLSearchParams(location.search);
const pantalla = q.get('p') ?? 'lista';
const tema = q.get('t') ?? 'dark';
document.documentElement.setAttribute('data-theme', tema);
try { localStorage.setItem('ci-tema', tema === 'light' ? 'claro' : 'oscuro'); } catch {}

const rutas: Record<string, { pathname: string; params: Record<string, string>; cargar: () => Promise<any> }> = {
  lista: { pathname: '/clientes', params: {}, cargar: () => import('@/app/clientes/page') },
  ficha: { pathname: `/clientes/${IDS.C1}`, params: { id: IDS.C1 }, cargar: () => import('@/app/clientes/[id]/page') },
  nuevo: { pathname: '/clientes/nuevo', params: {}, cargar: () => import('@/components/clientes/NuevoClienteForm') },
  editar: { pathname: `/clientes/${IDS.C2}/editar`, params: { id: IDS.C2 }, cargar: () => import('@/app/clientes/[id]/editar/page') },
};
const r = rutas[pantalla];
(globalThis as any).__VISOR__ = { pathname: r.pathname, params: r.params, search: '' };

document.body.className = 'font-sans antialiased text-[var(--label-primary)]';
r.cargar().then((m) => {
  const Pantalla = m.default;
  createRoot(document.getElementById('raiz')!).render(
    <div className="min-h-screen app-root-bg" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className={`min-h-screen pb-8${q.get('sinTema') ? '' : ' ci-tema'}`}>
        <Pantalla />
      </div>
    </div>,
  );
});
