'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Loader2, Menu, PanelLeftClose, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CcoDashboard, CcoKpiBloque } from '@/lib/contabilidad/cargarCcoDashboard';
import { normalizarDevaluacionConfig } from '@/lib/contabilidad/cco/tasas';
import CcoAnalisisJerarquico from '@/components/contabilidad/cco/CcoAnalisisJerarquico';
import CcoImportarCsvPanel from '@/components/contabilidad/cco/CcoImportarCsvPanel';
import CcoExportBar from '@/components/contabilidad/cco/CcoExportBar';
import CcoFormRegistroModal from '@/components/contabilidad/cco/CcoFormRegistroModal';
import CcoImportarPdfPanel from '@/components/contabilidad/cco/CcoImportarPdfPanel';
import CcoImportarV4Panel from '@/components/contabilidad/cco/CcoImportarV4Panel';
import CcoLibroMaestro from '@/components/contabilidad/cco/CcoLibroMaestro';
import CcoSidebarResumen from '@/components/contabilidad/cco/CcoSidebarResumen';
import CcoTabAjustes from '@/components/contabilidad/cco/CcoTabAjustes';
import CcoTabAuditoria from '@/components/contabilidad/cco/CcoTabAuditoria';
import CcoTabContratos from '@/components/contabilidad/cco/CcoTabContratos';
import CcoTabDeudas from '@/components/contabilidad/cco/CcoTabDeudas';
import CcoTabDistribucion from '@/components/contabilidad/cco/CcoTabDistribucion';
import CcoTabEditorMaestro from '@/components/contabilidad/cco/CcoTabEditorMaestro';
import CcoTabEgresos from '@/components/contabilidad/cco/CcoTabEgresos';
import CcoTabIngresos from '@/components/contabilidad/cco/CcoTabIngresos';
import CcoTabPresupuestos from '@/components/contabilidad/cco/CcoTabPresupuestos';
import CcoTabRubros from '@/components/contabilidad/cco/CcoTabRubros';
import CcoTabDatosGraficos from '@/components/contabilidad/cco/CcoTabDatosGraficos';

type NavId =
  | 'dashboard'
  | 'datos'
  | 'rubros'
  | 'egresos'
  | 'distribucion'
  | 'ingresos'
  | 'deudas'
  | 'contratos'
  | 'importar-csv'
  | 'importar-pdf'
  | 'importar-v4'
  | 'libro'
  | 'editor'
  | 'presupuestos'
  | 'auditoria'
  | 'ajustes';

type NavLeaf = { id: NavId; label: string; ready: boolean; hint?: string };
type NavGroup = {
  kind: 'group';
  id: 'importar';
  label: string;
  children: NavLeaf[];
};
type NavEntry = ({ kind?: 'item' } & NavLeaf) | NavGroup;

/** Menú lateral CCO V4 — módulos operativos + importación/configuración. */
const NAV_ITEMS: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', ready: true, hint: 'Gráficos y KPIs' },
  { id: 'datos', label: 'Datos gráficos', ready: true },
  { id: 'rubros', label: 'Lista de rubros', ready: true },
  { id: 'egresos', label: 'Egresos', ready: true },
  { id: 'distribucion', label: 'Distribución masiva', ready: true },
  { id: 'ingresos', label: 'Ingresos', ready: true },
  { id: 'deudas', label: 'Deudas', ready: true },
  { id: 'contratos', label: 'Contratos', ready: true },
  { id: 'presupuestos', label: 'Presupuestos', ready: true },
  { id: 'libro', label: 'Libro maestro', ready: true },
  { id: 'editor', label: 'Editor maestro', ready: true },
  {
    kind: 'group',
    id: 'importar',
    label: 'Importar',
    children: [
      { id: 'importar-csv', label: 'CSV', ready: true, hint: 'OneDrive / maestro' },
      { id: 'importar-pdf', label: 'PDF', ready: true, hint: 'OCR / tabla' },
      { id: 'importar-v4', label: 'V4 SQLite', ready: true, hint: 'JSON ETL' },
    ],
  },
  { id: 'auditoria', label: 'Auditoría', ready: true },
  { id: 'ajustes', label: 'Ajustes CCO', ready: true },
];

const IMPORTAR_NAV_IDS: NavId[] = ['importar-csv', 'importar-pdf', 'importar-v4'];

/** Módulos que necesitan selector de obra fuera del dashboard. */
const MODULOS_CON_OBRA: NavId[] = [
  'datos',
  'rubros',
  'egresos',
  'distribucion',
  'ingresos',
  'deudas',
  'contratos',
  'presupuestos',
  'libro',
  'editor',
  'importar-v4',
  'auditoria',
  'ajustes',
];

type TabId =
  | 'graficos'
  | 'datos'
  | 'rubros'
  | 'egresos'
  | 'distribucion'
  | 'ingresos'
  | 'deudas'
  | 'contratos'
  | 'presupuestos'
  | 'editor'
  | 'importar'
  | 'auditoria';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'graficos', label: 'GRÁFICOS', icon: '📊' },
  { id: 'datos', label: 'DATOS GRÁFICOS', icon: '⚡' },
  { id: 'rubros', label: 'LISTA DE RUBROS', icon: '📁' },
  { id: 'egresos', label: 'EGRESOS', icon: '🔴' },
  { id: 'distribucion', label: 'DISTRIBUCIÓN MASIVA', icon: '📂' },
  { id: 'ingresos', label: 'INGRESOS', icon: '🟢' },
  { id: 'deudas', label: 'DEUDAS', icon: '💳' },
  { id: 'contratos', label: 'CONTRATOS', icon: '📄' },
  { id: 'presupuestos', label: 'PRESUPUESTOS', icon: '📐' },
  { id: 'editor', label: 'EDITOR MAESTRO', icon: '✏️' },
  { id: 'importar', label: 'IMPORTAR PDF', icon: '📤' },
  { id: 'auditoria', label: 'AUDITORÍA', icon: '🛡️' },
];

const TIPOS_GASTO = [
  { key: 'admin', name: 'ADMINISTRACIÓN DELEGADA', color: '#2563EB' },
  { key: 'materiales', name: 'MATERIALES', color: '#DC2626' },
  { key: 'contratista', name: 'CONTRATISTA', color: '#16A34A' },
  { key: 'equipos', name: 'EQUIPOS', color: '#7C3AED' },
  { key: 'insumos', name: 'INSUMOS', color: '#F97316' },
  { key: 'mano', name: 'MANO DE OBRA', color: '#22D3EE' },
  { key: 'transporte', name: 'TRANSPORTE', color: '#F9A8D4' },
  { key: 'permiso', name: 'PERMISOLOGÍA', color: '#EC4899' },
  { key: 'proyecto', name: 'PROYECTO', color: '#A78BFA' },
] as const;

const axisTick = { fill: '#64748B', fontSize: 11 };
const gridStroke = '#E2E8F0';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtUsdTick(n: number): string {
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

function MetricCard({
  title,
  value,
  footnote,
  tone,
}: {
  title: string;
  value: string;
  footnote: string;
  tone: 'green' | 'brown' | 'red' | 'money';
}) {
  const toneDot =
    tone === 'green' ? '#22C55E' : tone === 'brown' ? '#B45309' : tone === 'red' ? '#EF4444' : '#CA8A04';
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.08), 0 4px 14px rgba(15,23,42,0.06)',
        border: '1px solid rgba(15,23,42,0.06)',
        minHeight: 108,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <p
        style={{
          color: '#64748B',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </p>
      <p
        style={{
          color: '#0F172A',
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '8px 0',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: toneDot,
            flexShrink: 0,
          }}
        />
        <span style={{ color: '#64748B', fontSize: 12 }}>{footnote}</span>
      </div>
    </div>
  );
}

function KpiRow({ bloque, honorariosPct, real }: { bloque: CcoKpiBloque; honorariosPct: number; real?: boolean }) {
  const cards = real
    ? [
        { title: 'INGRESOS REALES', value: fmtUsd(bloque.ingresos), footnote: 'Tasa real aplicada', tone: 'green' as const },
        { title: 'GASTOS REALES', value: fmtUsd(bloque.gastosNetos), footnote: 'Proporcional', tone: 'brown' as const },
        { title: 'ADMIN REAL', value: fmtUsd(bloque.adminDelegada), footnote: 'Proporcional', tone: 'brown' as const },
        { title: 'COSTO REAL', value: fmtUsd(bloque.costoTotal), footnote: 'Proporcional', tone: 'red' as const },
        { title: 'SALDO REAL', value: fmtUsd(bloque.saldoCaja), footnote: 'Poder adquisitivo', tone: 'money' as const },
      ]
    : [
        {
          title: 'TOTAL INGRESOS',
          value: fmtUsd(bloque.ingresos),
          footnote: `+ ${bloque.countIngresos} Registros`,
          tone: 'green' as const,
        },
        { title: 'GASTOS NETOS', value: fmtUsd(bloque.gastosNetos), footnote: 'Sin anulados', tone: 'brown' as const },
        {
          title: 'ADMIN DELEGADA',
          value: fmtUsd(bloque.adminDelegada),
          footnote: `Honorarios fila · ${honorariosPct.toFixed(1)}%`,
          tone: 'brown' as const,
        },
        { title: 'COSTO TOTAL', value: fmtUsd(bloque.costoTotal), footnote: 'Gastos + Admin', tone: 'red' as const },
        { title: 'SALDO EN CAJA', value: fmtUsd(bloque.saldoCaja), footnote: 'Disponible', tone: 'money' as const },
      ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
        marginBottom: 22,
      }}
    >
      {cards.map((c) => (
        <MetricCard key={c.title} {...c} />
      ))}
    </div>
  );
}

function ChartCard({
  title,
  children,
  tall,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  tall?: number;
  footer?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        padding: '12px 12px 10px',
        marginBottom: 18,
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{title}</h3>
      <div style={{ width: '100%', height: tall ?? 280, minWidth: 0 }}>{children}</div>
      {footer ? <div style={{ marginTop: 10 }}>{footer}</div> : null}
    </div>
  );
}

const SECUNDARIOS = [
  { title: 'Compras CI', href: '/contabilidad/compras' },
  { title: 'Inyecciones', href: '/contabilidad/inyecciones' },
  { title: 'Gastos entidad', href: '/contabilidad/gastos-entidad' },
  { title: 'Procuras', href: '/contabilidad/procuras' },
  { title: 'Canal Telegram', href: '/contabilidad/compras/canal' },
];

const MQ_DESKTOP = '(min-width: 900px)';
/** Preferencia de menú lateral CCO en desktop (`'1'` abierto, `'0'` cerrado). */
const CCO_MENU_OPEN_KEY = 'ci-cco-menu-open';

function leerMenuOpenGuardado(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CCO_MENU_OPEN_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* private mode / quota */
  }
  return null;
}

function guardarMenuOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CCO_MENU_OPEN_KEY, open ? '1' : '0');
  } catch {
    /* private mode / quota */
  }
}

export default function CcoDashboardClient() {
  const [nav, setNav] = useState<NavId>('dashboard');
  const [tab, setTab] = useState<TabId>('graficos');
  const [proyectoId, setProyectoId] = useState('');
  const [devaluacion, setDevaluacion] = useState(0);
  const [devalManual, setDevalManual] = useState(false);
  const devaluacionRef = React.useRef(devaluacion);
  devaluacionRef.current = devaluacion;
  const [data, setData] = useState<CcoDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodicidad, setPeriodicidad] = useState('Mensual');
  const [modo, setModo] = useState<'acumulado' | 'periodo'>('acumulado');
  /**
   * Menú izquierdo CCO: se oculta/muestra con el icono de tres rayas.
   * Cerrado en móvil por defecto; en desktop respeta localStorage o abre.
   */
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const menuInicializadoRef = React.useRef(false);
  /** Submenú Importar: CSV / PDF / V4 SQLite. */
  const [importarOpen, setImportarOpen] = useState(false);

  /** Deep-link: ?proyecto=&nav=auditoria (p. ej. aviso Telegram del auditor continuo). */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const proy = sp.get('proyecto')?.trim();
      const navQ = sp.get('nav')?.trim() as NavId | null;
      if (proy) setProyectoId(proy);
      if (navQ && (NAV_ITEMS.some((e) => ('children' in e ? e.children.some((c) => c.id === navQ) : e.id === navQ)) || navQ === 'dashboard')) {
        setNav(navQ);
        if (navQ === 'auditoria') setTab('auditoria');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setMenuOpenPersisted = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setMenuOpen((prev) => {
      const open = typeof next === 'function' ? next(prev) : next;
      guardarMenuOpen(open);
      return open;
    });
  }, []);

  useEffect(() => {
    if (IMPORTAR_NAV_IDS.includes(nav)) setImportarOpen(true);
  }, [nav]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(MQ_DESKTOP);
    const apply = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      if (!menuInicializadoRef.current) {
        menuInicializadoRef.current = true;
        if (desktop) {
          const saved = leerMenuOpenGuardado();
          setMenuOpen(saved ?? true);
        } else {
          setMenuOpen(false);
        }
        return;
      }
      // Al pasar a móvil, cerrar el drawer para no dejarlo abierto fuera de pantalla.
      if (!desktop) {
        setMenuOpen(false);
        return;
      }
      // Al volver a desktop, restaurar preferencia guardada (o abierto por defecto).
      const saved = leerMenuOpenGuardado();
      setMenuOpen(saved ?? true);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (isDesktop || !menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isDesktop, menuOpen]);

  const seleccionarNav = useCallback((id: NavId) => {
    setNav(id);
    // En móvil cierra el drawer sin pisar la preferencia desktop en localStorage.
    if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia(MQ_DESKTOP).matches) {
      setMenuOpen(false);
    }
  }, []);

  const proyectosCatalogo = useMemo(
    () => (data?.proyectos ?? []).map((p) => ({ id: p.id, nombre: p.nombre })),
    [data?.proyectos],
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (proyectoId) qs.set('proyecto', proyectoId);
      // Solo forzar devaluación si el usuario la editó; si no, usa config de obra.
      // Siempre enviar forma V4 (−): +34,45 (brecha) → ≈ −25,62.
      if (devalManual) {
        const devalNorm = normalizarDevaluacionConfig(devaluacionRef.current);
        if (devalNorm !== devaluacionRef.current) setDevaluacion(devalNorm);
        qs.set('devaluacion', String(devalNorm));
      }
      const res = await fetch(`/api/contabilidad/cco-dashboard?${qs}`, { cache: 'no-store' });
      const json = (await res.json()) as CcoDashboard & { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al cargar');
      setData(json);
      if (json.devaluacionPromedio != null) {
        const d = normalizarDevaluacionConfig(Number(json.devaluacionPromedio) || 0);
        setDevaluacion((prev) => (prev === d ? prev : d));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, devalManual]);

  useEffect(() => {
    setDevalManual(false);
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!devalManual) return;
    const t = window.setTimeout(() => void cargar(), 350);
    return () => window.clearTimeout(t);
  }, [devaluacion, devalManual, cargar]);

  const flujo = useMemo(() => {
    if (!data) return [];
    return modo === 'acumulado' ? data.flujoAcumulado : data.flujoPeriodo;
  }, [data, modo]);

  const tituloFlujo =
    modo === 'acumulado'
      ? `Flujo de Caja Acumulado (${periodicidad})`
      : `Flujo de Caja por Período (${periodicidad})`;

  return (
    <div
      suppressHydrationWarning
      style={{
        minHeight: '100vh',
        background: '#F1F5F9',
        color: '#0F172A',
        paddingBottom: 100,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          padding: '8px 12px',
          background: '#E2E8F0',
          borderBottom: '1px solid #CBD5E1',
          fontSize: 12,
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setMenuOpenPersisted((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="cco-sidebar"
            aria-label={menuOpen ? 'Ocultar menú CCO' : 'Mostrar menú CCO'}
            title={menuOpen ? 'Ocultar menú' : 'Mostrar menú'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: '1px solid #CBD5E1',
              background: menuOpen ? '#DBEAFE' : '#fff',
              borderRadius: 8,
              padding: '6px 10px',
              fontWeight: 700,
              cursor: 'pointer',
              color: '#334155',
              flexShrink: 0,
              minWidth: 40,
              minHeight: 36,
            }}
          >
            {menuOpen ? (
              <PanelLeftClose size={20} strokeWidth={2.25} />
            ) : (
              <Menu size={20} strokeWidth={2.25} />
            )}
            <span style={{ fontSize: 12 }}>{menuOpen ? 'Ocultar' : 'Menú'}</span>
          </button>
          <Link
            href="/contabilidad"
            style={{
              color: '#2563EB',
              fontWeight: 700,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            ← Hub
          </Link>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          style={{
            border: '1px solid #CBD5E1',
            background: '#fff',
            borderRadius: 8,
            padding: '4px 10px',
            fontWeight: 700,
            cursor: 'pointer',
            color: '#334155',
          }}
        >
          Actualizar
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          minHeight: 'calc(100vh - 42px)',
          maxWidth: 1400,
          margin: '0 auto',
          position: 'relative',
        }}
      >
        {/* Overlay móvil cuando el menú está abierto */}
        {!isDesktop && menuOpen ? (
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpenPersisted(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.45)',
              border: 'none',
              zIndex: 45,
              cursor: 'pointer',
            }}
          />
        ) : null}

        {/* Menú izquierdo: colapsable con las tres rayas; en móvil es drawer */}
        <aside
          id="cco-sidebar"
          aria-hidden={!menuOpen}
          style={{
            ...(isDesktop
              ? {
                  width: menuOpen ? 300 : 0,
                  position: 'relative' as const,
                  transform: 'none',
                }
              : {
                  width: 300,
                  position: 'fixed' as const,
                  top: 0,
                  left: 0,
                  bottom: 0,
                  transform: menuOpen ? 'translateX(0)' : 'translateX(-105%)',
                  zIndex: 50,
                }),
            flexShrink: 0,
            background: '#0F172A',
            color: '#E2E8F0',
            padding: menuOpen ? '18px 12px' : 0,
            borderRight: menuOpen ? '1px solid #1E293B' : 'none',
            overflow: 'hidden',
            overflowY: menuOpen ? 'auto' : 'hidden',
            transition: 'width 0.2s ease, transform 0.2s ease, padding 0.2s ease',
            boxShadow: !isDesktop && menuOpen ? '8px 0 24px rgba(0,0,0,0.35)' : 'none',
            pointerEvents: menuOpen ? 'auto' : 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '0 8px 12px',
              minWidth: 260,
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#64748B',
                margin: 0,
              }}
            >
              Menú CCO
            </p>
            <button
              type="button"
              onClick={() => setMenuOpenPersisted(false)}
              aria-label="Cerrar menú"
              title="Ocultar menú"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: 4,
                display: 'inline-flex',
              }}
            >
              {isDesktop ? <PanelLeftClose size={18} /> : <X size={18} />}
            </button>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
            {NAV_ITEMS.map((entry) => {
              if (entry.kind === 'group') {
                const groupActive = IMPORTAR_NAV_IDS.includes(nav);
                return (
                  <div key={entry.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      type="button"
                      aria-expanded={importarOpen}
                      aria-controls="cco-nav-importar"
                      onClick={() => {
                        setImportarOpen((o) => {
                          const next = !o;
                          if (next && !IMPORTAR_NAV_IDS.includes(nav)) {
                            seleccionarNav('importar-csv');
                          }
                          return next;
                        });
                      }}
                      style={{
                        textAlign: 'left',
                        border: 'none',
                        borderRadius: 10,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: groupActive && !importarOpen ? '#1E3A8A' : 'transparent',
                        color: groupActive ? '#fff' : '#CBD5E1',
                        fontWeight: 700,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span>{entry.label}</span>
                      {importarOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {importarOpen ? (
                      <div id="cco-nav-importar" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {entry.children.map((item) => {
                          const active = nav === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              disabled={!item.ready}
                              title={item.ready ? undefined : 'Próximamente'}
                              onClick={() => {
                                if (item.ready) seleccionarNav(item.id);
                              }}
                              style={{
                                textAlign: 'left',
                                border: 'none',
                                borderRadius: 10,
                                padding: '8px 12px 8px 22px',
                                cursor: item.ready ? 'pointer' : 'not-allowed',
                                background: active ? '#2563EB' : 'transparent',
                                color: item.ready ? (active ? '#fff' : '#94A3B8') : '#475569',
                                fontWeight: 700,
                                fontSize: 12,
                                opacity: item.ready ? 1 : 0.55,
                              }}
                            >
                              <span style={{ display: 'block' }}>{item.label}</span>
                              {item.hint ? (
                                <span
                                  style={{
                                    display: 'block',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    marginTop: 2,
                                    color: active ? 'rgba(255,255,255,0.75)' : '#64748B',
                                  }}
                                >
                                  {item.hint}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              const item = entry;
              const active = nav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.ready}
                  title={item.ready ? undefined : 'Próximamente'}
                  onClick={() => {
                    if (item.ready) seleccionarNav(item.id);
                  }}
                  style={{
                    textAlign: 'left',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: item.ready ? 'pointer' : 'not-allowed',
                    background: active ? '#2563EB' : 'transparent',
                    color: item.ready ? (active ? '#fff' : '#CBD5E1') : '#475569',
                    fontWeight: 700,
                    fontSize: 13,
                    opacity: item.ready ? 1 : 0.55,
                  }}
                >
                  <span style={{ display: 'block' }}>{item.label}</span>
                  {item.hint ? (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 10,
                        fontWeight: 600,
                        marginTop: 2,
                        color: active ? 'rgba(255,255,255,0.75)' : '#64748B',
                      }}
                    >
                      {item.hint}
                    </span>
                  ) : null}
                  {!item.ready ? (
                    <span style={{ display: 'block', fontSize: 10, marginTop: 2, color: '#64748B' }}>
                      Próximamente
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <CcoSidebarResumen proyectoId={proyectoId} onChanged={() => void cargar()} />
        </aside>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            width: '100%',
            padding: isDesktop ? '16px 20px 24px' : '12px 12px 88px',
            overflowX: 'hidden',
          }}
        >
      {nav === 'importar-csv' ? (
        <CcoImportarCsvPanel
          proyectos={proyectosCatalogo}
          proyectoIdInicial={proyectoId || null}
          onImportado={(pid) => {
            if (pid) setProyectoId(pid);
            void cargar();
            setNav('dashboard');
          }}
        />
      ) : null}

      {nav === 'importar-pdf' ? (
        <CcoImportarPdfPanel
          proyectos={proyectosCatalogo}
          proyectoIdInicial={proyectoId || null}
          onImportado={(pid) => {
            if (pid) setProyectoId(pid);
            void cargar();
            setNav('dashboard');
          }}
        />
      ) : null}

      {MODULOS_CON_OBRA.includes(nav) ? (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', maxWidth: 360 }}>
            <span style={labelStyle}>Obra destino</span>
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Seleccionar obra…</option>
              {(data?.proyectos ?? proyectosCatalogo).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {nav === 'importar-v4' ? (
        <CcoImportarV4Panel proyectoId={proyectoId} onDone={() => void cargar()} />
      ) : null}

      {nav === 'libro' ? <CcoLibroMaestro proyectoId={proyectoId} /> : null}

      {nav === 'presupuestos' ? <CcoTabPresupuestos proyectoId={proyectoId} /> : null}

      {nav === 'auditoria' ? <CcoTabAuditoria proyectoId={proyectoId} /> : null}

      {nav === 'egresos' ? <CcoTabEgresos proyectoId={proyectoId} /> : null}
      {nav === 'ingresos' ? <CcoTabIngresos proyectoId={proyectoId} /> : null}
      {nav === 'contratos' ? <CcoTabContratos proyectoId={proyectoId} /> : null}
      {nav === 'deudas' ? <CcoTabDeudas proyectoId={proyectoId} /> : null}
      {nav === 'rubros' ? <CcoTabRubros proyectoId={proyectoId} /> : null}
      {nav === 'distribucion' ? (
        <CcoTabDistribucion proyectoId={proyectoId} onDone={() => void cargar()} />
      ) : null}
      {nav === 'datos' && data ? <CcoTabDatosGraficos data={data} modo={modo} /> : null}

      {nav === 'editor' ? (
        <CcoTabEditorMaestro proyectoId={proyectoId} onSaved={() => void cargar()} />
      ) : null}

      {nav === 'ajustes' ? (
        <CcoTabAjustes
          proyectoId={proyectoId}
          onSaved={(cfg) => {
            setDevaluacion(cfg.devaluacion_pct);
            setDevalManual(false);
            void cargar();
          }}
        />
      ) : null}

      {nav === 'dashboard' ? (
        <>
        <div
          style={{
            background: 'linear-gradient(90deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)',
            borderRadius: 14,
            padding: '18px 22px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            boxShadow: '0 8px 24px rgba(37,99,235,0.28)',
            marginBottom: 16,
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 180px' }}>
            <p
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.02em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Proyecto: {data?.proyectoNombre ?? '…'}
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span style={pill}>{data?.totalRegistros ?? 0} Registros en Total</span>
            <span style={pill}>AD {data ? data.honorariosPct.toFixed(1) : '—'}%</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 18,
            alignItems: 'flex-end',
          }}
        >
          <label style={{ flex: '1 1 220px' }}>
            <span style={labelStyle}>Obra</span>
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Todas las obras</option>
              {(data?.proyectos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: '0 1 180px' }}>
            <span style={labelStyle}>Devaluación V4 (%)</span>
            <input
              type="number"
              step="0.01"
              value={devaluacion}
              onChange={(e) => {
                setDevalManual(true);
                setDevaluacion(Number(e.target.value) || 0);
              }}
              onBlur={() => {
                const norm = normalizarDevaluacionConfig(devaluacion);
                if (norm !== devaluacion) {
                  setDevalManual(true);
                  setDevaluacion(norm);
                }
              }}
              title="Forma V4 (poder adquisitivo). Si pegas la brecha Binance/BCV (+34,45), se convierte a ≈ −25,62."
              style={selectStyle}
            />
          </label>
          <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={labelStyle}>Exportar / registrar</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <CcoExportBar proyectoId={proyectoId} />
              <CcoFormRegistroModal proyectoId={proyectoId} onSaved={() => void cargar()} />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: '#64748B' }}>
            <Loader2 className="animate-spin" size={22} />
            Cargando contabilidad…
          </div>
        ) : null}

        {error ? (
          <p style={{ color: '#DC2626', fontWeight: 600, marginBottom: 16 }}>{error}</p>
        ) : null}

        {data && !loading ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', margin: '0 0 10px' }}>
              Contabilidad Oficial (BCV)
            </p>
            <KpiRow bloque={data.oficial} honorariosPct={data.honorariosPct} />

            <p style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', margin: '0 0 10px' }}>
              Contabilidad Real{' '}
              <span style={{ fontWeight: 600, color: '#475569' }}>
                (Devaluación V4: {normalizarDevaluacionConfig(
                  data.devaluacionPromedio ?? devaluacion,
                ).toFixed(5)}
                %)
              </span>
            </p>
            <KpiRow bloque={data.real} honorariosPct={data.honorariosPct} real />

            <div
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                gap: '4px 2px',
                borderBottom: '1px solid #CBD5E1',
                marginBottom: 18,
                paddingBottom: 2,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                maxWidth: '100%',
              }}
            >
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: active ? '3px solid #EF4444' : '3px solid transparent',
                      color: active ? '#DC2626' : '#334155',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '10px 8px 8px',
                      cursor: 'pointer',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ marginRight: 4 }}>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {tab === 'graficos' ? (
              <div>
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #E2E8F0',
                    padding: '14px 14px 8px',
                    marginBottom: 18,
                    maxWidth: '100%',
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Panel de Análisis Financiero</h2>
                  <p style={{ margin: '6px 0 16px', fontSize: 13, color: '#64748B' }}>
                    Comparativa de Ingresos vs Egresos (Flujo de Caja)
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 16,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Periodicidad del Gráfico</p>
                      <select
                        value={periodicidad}
                        onChange={(e) => setPeriodicidad(e.target.value)}
                        style={selectStyle}
                      >
                        <option>Mensual</option>
                        <option disabled>Semanal (próximamente)</option>
                        <option disabled>Diario (próximamente)</option>
                      </select>
                      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#94A3B8' }}>
                        Series actuales agregadas por mes (YYYY-MM).
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Modo del Gráfico</p>
                      <label style={radioRow}>
                        <input
                          type="radio"
                          checked={modo === 'acumulado'}
                          onChange={() => setModo('acumulado')}
                        />
                        Acumulado (Histórico)
                      </label>
                      <label style={radioRow}>
                        <input
                          type="radio"
                          checked={modo === 'periodo'}
                          onChange={() => setModo('periodo')}
                        />
                        Por Período (Sin Acumular)
                      </label>
                    </div>
                  </div>

                  <ChartCard title={tituloFlujo} tall={340}>
                    {flujo.length === 0 ? (
                      <EmptyChart />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={flujo} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                          <XAxis dataKey="periodo" tick={axisTick} />
                          <YAxis tickFormatter={fmtUsdTick} tick={axisTick} width={48} />
                          <Tooltip formatter={(v) => fmtUsd(Number(v))} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="ingresos"
                            name={modo === 'acumulado' ? 'Ingresos Acumulados' : 'Ingresos'}
                            stroke="#22C55E"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="egresos"
                            name={modo === 'acumulado' ? 'Egresos Acumulados' : 'Egresos'}
                            stroke="#EF4444"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="saldo"
                            name={modo === 'acumulado' ? 'Saldo Acumulado' : 'Saldo'}
                            stroke="#3B82F6"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </div>

                <div
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #E2E8F0',
                    padding: '18px 22px 8px',
                  }}
                >
                  <h2 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800 }}>
                    Distribución y Evolución Detallada
                  </h2>

                  <ChartCard title="Evolución de Gastos por Período (Mensual)" tall={300}>
                    {data.gastosMensual.length === 0 ? (
                      <EmptyChart />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.gastosMensual}>
                          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                          <XAxis dataKey="periodo" tick={axisTick} />
                          <YAxis tickFormatter={fmtUsdTick} tick={axisTick} width={48} />
                          <Tooltip formatter={(v) => fmtUsd(Number(v))} />
                          <Bar dataKey="costo" name="Costo Total (USD)" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard
                    title="Top 10 Proveedores (Costo Total)"
                    tall={!isDesktop ? 360 : 380}
                  >
                    {data.topProveedores.length === 0 ? (
                      <EmptyChart />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={data.topProveedores.map((p) => ({
                            ...p,
                            proveedorFull: p.proveedor,
                            proveedor:
                              p.proveedor.length > (!isDesktop ? 14 : 22)
                                ? `${p.proveedor.slice(0, !isDesktop ? 13 : 21)}…`
                                : p.proveedor,
                          }))}
                          margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
                        >
                          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={fmtUsdTick} tick={axisTick} />
                          <YAxis
                            type="category"
                            dataKey="proveedor"
                            width={!isDesktop ? 86 : 140}
                            tick={{ ...axisTick, fontSize: 10 }}
                            interval={0}
                          />
                          <Tooltip
                            labelFormatter={(_, payload) => {
                              const p = payload?.[0]?.payload as { proveedorFull?: string } | undefined;
                              return p?.proveedorFull ?? '';
                            }}
                            formatter={(v) => fmtUsd(Number(v))}
                          />
                          <Bar dataKey="costo" name="COSTO TOTAL" fill="#1E3A8A" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartCard>

                  <ChartCard
                    title="Distribución por Capítulo (Composición por Tipo de Gasto)"
                    tall={!isDesktop ? Math.max(300, Math.min(data.capitulos.length, 10) * 38 + 40) : 360}
                    footer={
                      data.capitulos.length === 0 ? null : (
                        <ul
                          style={{
                            listStyle: 'none',
                            margin: 0,
                            padding: 0,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                            gap: '6px 10px',
                          }}
                        >
                          {[...TIPOS_GASTO]
                            .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                            .map((t) => (
                            <li
                              key={t.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11,
                                color: '#334155',
                                fontWeight: 600,
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 2,
                                  background: t.color,
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ wordBreak: 'break-word' }}>{t.name}</span>
                            </li>
                          ))}
                        </ul>
                      )
                    }
                  >
                    {data.capitulos.length === 0 ? (
                      <EmptyChart />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        {!isDesktop ? (
                          <BarChart
                            layout="vertical"
                            data={[...data.capitulos]
                              .map((c) => ({
                                ...c,
                                capFull: c.cap,
                                cap: c.cap.length > 16 ? `${c.cap.slice(0, 15)}…` : c.cap,
                              }))
                              .slice(0, 10)}
                            margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                          >
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" tickFormatter={fmtUsdTick} tick={axisTick} />
                            <YAxis
                              type="category"
                              dataKey="cap"
                              width={90}
                              tick={{ ...axisTick, fontSize: 10 }}
                              interval={0}
                            />
                            <Tooltip
                              labelFormatter={(_, payload) => {
                                const p = payload?.[0]?.payload as { capFull?: string } | undefined;
                                return p?.capFull ?? '';
                              }}
                              formatter={(v) => fmtUsd(Number(v))}
                            />
                            {TIPOS_GASTO.map((t) => (
                              <Bar key={t.key} dataKey={t.key} name={t.name} stackId="a" fill={t.color} />
                            ))}
                          </BarChart>
                        ) : (
                          <BarChart data={data.capitulos} margin={{ bottom: 12 }}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                            <XAxis
                              dataKey="cap"
                              tick={{ ...axisTick, fontSize: 10 }}
                              interval={0}
                              angle={-25}
                              textAnchor="end"
                              height={70}
                              tickFormatter={(v) =>
                                String(v).length > 18 ? `${String(v).slice(0, 17)}…` : String(v)
                              }
                            />
                            <YAxis tickFormatter={fmtUsdTick} tick={axisTick} width={48} />
                            <Tooltip formatter={(v) => fmtUsd(Number(v))} />
                            {TIPOS_GASTO.map((t) => (
                              <Bar key={t.key} dataKey={t.key} name={t.name} stackId="a" fill={t.color} />
                            ))}
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    )}
                  </ChartCard>
                </div>

                <CcoAnalisisJerarquico
                  jerarquiaCapitulos={data.jerarquiaCapitulos ?? []}
                  subCapitulosStack={data.subCapitulosStack ?? []}
                  tiposPie={data.tiposPie ?? []}
                  treemapNodos={data.treemapNodos ?? []}
                />
              </div>
            ) : null}

            {tab === 'egresos' ? <CcoTabEgresos proyectoId={proyectoId} /> : null}
            {tab === 'ingresos' ? <CcoTabIngresos proyectoId={proyectoId} /> : null}
            {tab === 'contratos' ? <CcoTabContratos proyectoId={proyectoId} /> : null}
            {tab === 'presupuestos' ? <CcoTabPresupuestos proyectoId={proyectoId} /> : null}
            {tab === 'deudas' ? <CcoTabDeudas proyectoId={proyectoId} /> : null}
            {tab === 'datos' ? <CcoTabDatosGraficos data={data} modo={modo} /> : null}
            {tab === 'rubros' ? <CcoTabRubros proyectoId={proyectoId} /> : null}
            {tab === 'distribucion' ? (
              <CcoTabDistribucion proyectoId={proyectoId} onDone={() => void cargar()} />
            ) : null}
            {tab === 'editor' ? (
              <CcoTabEditorMaestro proyectoId={proyectoId} onSaved={() => void cargar()} />
            ) : null}
            {tab === 'auditoria' ? <CcoTabAuditoria proyectoId={proyectoId} /> : null}
            {tab === 'importar' ? (
              <CcoImportarPdfPanel
                proyectos={proyectosCatalogo}
                proyectoIdInicial={proyectoId || null}
                onImportado={(pid) => {
                  if (pid) setProyectoId(pid);
                  void cargar();
                }}
              />
            ) : null}
            {tab !== 'graficos' &&
            tab !== 'egresos' &&
            tab !== 'ingresos' &&
            tab !== 'contratos' &&
            tab !== 'presupuestos' &&
            tab !== 'deudas' &&
            tab !== 'datos' &&
            tab !== 'rubros' &&
            tab !== 'distribucion' &&
            tab !== 'editor' &&
            tab !== 'auditoria' &&
            tab !== 'importar' ? (
              <SeccionLista
                title={TABS.find((t) => t.id === tab)?.label ?? 'Sección'}
                desc="Menú CCO V4 cableado (Importar → CSV/PDF/V4 SQLite, libro, contratos, exports)."
                href="/contabilidad/compras"
                hrefLabel="Ir a módulos secundarios →"
                lines={[
                  'Import PDF: menú izquierdo o pestaña IMPORTAR PDF',
                  'Exporta Excel/PDF desde la barra superior',
                ]}
              />
            ) : null}

            <div style={{ marginTop: 28 }}>
              <p
                style={{
                  color: '#64748B',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Módulos secundarios · aportan al libro solo si no hay duplicado
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SECUNDARIOS.map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    style={{
                      textDecoration: 'none',
                      border: '1px solid #E2E8F0',
                      background: '#fff',
                      borderRadius: 10,
                      padding: '10px 14px',
                      color: '#334155',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {m.title}
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : null}
        </>
      ) : null}
        </div>
      </div>

    </div>
  );
}

function EmptyChart() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94A3B8',
        fontSize: 13,
        border: '1px dashed #CBD5E1',
        borderRadius: 10,
      }}
    >
      Sin movimientos en el filtro actual
    </div>
  );
}

function SeccionLista({
  title,
  desc,
  lines,
  href,
  hrefLabel,
}: {
  title: string;
  desc: string;
  lines: string[];
  href: string;
  hrefLabel: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: 24,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
      <p style={{ color: '#64748B', fontSize: 13, margin: '8px 0 14px' }}>{desc}</p>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: 14, lineHeight: 1.7 }}>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <Link
        href={href}
        style={{
          display: 'inline-block',
          marginTop: 16,
          color: '#2563EB',
          fontWeight: 700,
          fontSize: 13,
          textDecoration: 'none',
        }}
      >
        {hrefLabel}
      </Link>
    </div>
  );
}

const pill: React.CSSProperties = {
  background: 'rgba(255,255,255,0.18)',
  color: '#fff',
  padding: '8px 14px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid rgba(255,255,255,0.25)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
  marginBottom: 4,
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  background: '#fff',
  color: '#0F172A',
  fontSize: 14,
};

const radioRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  color: '#334155',
  fontWeight: 600,
  cursor: 'pointer',
  marginBottom: 6,
};
