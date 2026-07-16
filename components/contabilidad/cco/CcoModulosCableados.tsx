'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import CargarFacturaCuadroModal from '@/components/contabilidad/CargarFacturaCuadroModal';
import PanelAuditoriaProcuras from '@/components/contabilidad/PanelAuditoriaProcuras';
import CcoKpiMini from '@/components/contabilidad/cco/CcoKpiMini';
import { useCcoModulos } from '@/components/contabilidad/cco/useCcoModulos';
import {
  fmtFecha,
  fmtUsd,
  kpiGrid,
  panelCard,
  tableWrap,
  tdStyle,
  thStyle,
} from '@/components/contabilidad/cco/ccoPanelStyles';

type ProyectoOpt = { id: string; nombre: string };

type CommonProps = {
  proyectoId: string;
  proyectos: ProyectoOpt[];
};

function PanelFrame({
  proyectoId,
  loading,
  error,
  children,
  onRetry,
}: {
  proyectoId: string;
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div style={{ ...panelCard, display: 'flex', alignItems: 'center', gap: 10, color: '#64748B' }}>
        <Loader2 size={18} className="animate-spin" />
        Cargando módulo…
      </div>
    );
  }
  if (error) {
    return (
      <div style={panelCard}>
        <p style={{ color: '#B91C1C', margin: '0 0 12px', fontWeight: 600 }}>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            border: '1px solid #CBD5E1',
            background: '#fff',
            borderRadius: 8,
            padding: '8px 14px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (!proyectoId) {
    return (
      <div style={panelCard}>
        <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>
          Seleccione una obra en el filtro superior para ver el detalle de este módulo. Los totales
          globales siguen visibles en Gráficos.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-block',
        textDecoration: 'none',
        border: '1px solid #BFDBFE',
        background: '#EFF6FF',
        color: '#1D4ED8',
        borderRadius: 999,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {label}
    </Link>
  );
}

export function CcoIngresosPanel({ proyectoId, proyectos: _p }: CommonProps) {
  const { data, loading, error, reload } = useCcoModulos(proyectoId);
  const ing = data?.ingresos;

  return (
    <PanelFrame proyectoId={proyectoId || 'all'} loading={loading} error={error} onRetry={reload}>
      {!ing ? null : (
        <div>
          <div style={kpiGrid}>
            <CcoKpiMini
              title="Total ingresos"
              value={fmtUsd(ing.totalUsd)}
              footnote={`${ing.countInyecciones + ing.countAbonos} registros`}
              accent="#16A34A"
            />
            <CcoKpiMini
              title="Inyecciones CI"
              value={fmtUsd(ing.totalInyeccionesUsd)}
              footnote={`${ing.countInyecciones} movimientos`}
              accent="#2563EB"
            />
            <CcoKpiMini
              title="Abonos cliente"
              value={fmtUsd(ing.totalAbonosUsd)}
              footnote={`${ing.countAbonos} abonos`}
              accent="#0D9488"
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <LinkChip href="/contabilidad/inyecciones" label="Registrar inyección →" />
          </div>

          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Fuente</th>
                  <th style={thStyle}>Detalle</th>
                  <th style={thStyle}>Método</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>USD</th>
                </tr>
              </thead>
              <tbody>
                {ing.filas.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, color: '#94A3B8' }}>
                      Sin ingresos registrados para el filtro actual.
                    </td>
                  </tr>
                ) : (
                  ing.filas.map((f) => (
                    <tr key={`${f.fuente}-${f.id}`}>
                      <td style={tdStyle}>{fmtFecha(f.fecha)}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: f.fuente === 'inyeccion' ? '#1D4ED8' : '#0F766E',
                            background: f.fuente === 'inyeccion' ? '#DBEAFE' : '#CCFBF1',
                            padding: '3px 8px',
                            borderRadius: 999,
                          }}
                        >
                          {f.fuente === 'inyeccion' ? 'INYECCIÓN' : 'ABONO'}
                        </span>
                      </td>
                      <td style={tdStyle}>{f.detalle}</td>
                      <td style={tdStyle}>{f.metodo}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(f.montoUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PanelFrame>
  );
}

export function CcoDeudasPanel({ proyectoId }: CommonProps) {
  const { data, loading, error, reload } = useCcoModulos(proyectoId);
  const d = data?.deudas;

  return (
    <PanelFrame proyectoId={proyectoId} loading={loading} error={error} onRetry={reload}>
      {!d ? null : (
        <div>
          <div style={kpiGrid}>
            <CcoKpiMini
              title="Saldo fondos"
              value={fmtUsd(d.saldoFondosUsd)}
              footnote="Capital disponible"
              accent="#16A34A"
            />
            <CcoKpiMini
              title="Total abonado"
              value={fmtUsd(d.totalAbonadoUsd)}
              footnote="Cliente / inyecciones"
              accent="#2563EB"
            />
            <CcoKpiMini
              title="Egresos obra"
              value={fmtUsd(d.totalEgresosUsd)}
              footnote="Compras registradas"
              accent="#B45309"
            />
            <CcoKpiMini
              title="Pendiente proveedor"
              value={fmtUsd(d.totalPendienteUsd)}
              footnote={`${d.pendientes.length} facturas`}
              accent="#DC2626"
            />
            <CcoKpiMini
              title="Cobertura neta"
              value={fmtUsd(d.coberturaUsd)}
              footnote="Fondos − pendientes"
              accent={d.coberturaUsd >= 0 ? '#CA8A04' : '#EF4444'}
            />
          </div>

          <div style={panelCard}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>
              Cuentas por pagar (estado pendiente)
            </h3>
            <p style={{ margin: '0 0 14px', color: '#64748B', fontSize: 13 }}>
              Facturas de compra con estado pendiente, borrador o por pagar.
            </p>
            <div style={tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Proveedor</th>
                    <th style={thStyle}>Factura</th>
                    <th style={thStyle}>Estado</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>USD</th>
                  </tr>
                </thead>
                <tbody>
                  {d.pendientes.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, color: '#94A3B8' }}>
                        No hay deudas de proveedor abiertas en el filtro.
                      </td>
                    </tr>
                  ) : (
                    d.pendientes.map((p) => (
                      <tr key={p.id}>
                        <td style={tdStyle}>{fmtFecha(p.fecha)}</td>
                        <td style={tdStyle}>{p.proveedor}</td>
                        <td style={tdStyle}>{p.factura}</td>
                        <td style={tdStyle}>{p.estado}</td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {fmtUsd(p.montoUsd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14 }}>
              <LinkChip href="/contabilidad/compras" label="Abrir compras →" />
            </div>
          </div>
        </div>
      )}
    </PanelFrame>
  );
}

export function CcoContratosPanel({ proyectoId }: CommonProps) {
  const { data, loading, error, reload } = useCcoModulos(proyectoId);
  const c = data?.contratos;
  const hrefModulo = proyectoId ? `/proyectos/modulo/${encodeURIComponent(proyectoId)}` : '/proyectos';

  return (
    <PanelFrame proyectoId={proyectoId} loading={loading} error={error} onRetry={reload}>
      {!c ? null : (
        <div style={panelCard}>
          <div style={kpiGrid}>
            <CcoKpiMini
              title="Contrato AD"
              value={c.autorizado ? 'Activo' : c.contrato ? c.contrato.estado : 'Sin AD'}
              footnote={c.autorizado ? 'Logística habilitada' : 'Requiere AD exitoso'}
              accent={c.autorizado ? '#16A34A' : '#DC2626'}
            />
            <CcoKpiMini
              title="Honorarios"
              value={
                c.contrato?.honorarios_admin_pct != null
                  ? `${Number(c.contrato.honorarios_admin_pct).toFixed(1)}%`
                  : '—'
              }
              footnote="Admin delegada"
              accent="#B45309"
            />
            <CcoKpiMini
              title="Contratos obrero"
              value={String(c.contratosObrero)}
              footnote="Express en la obra"
              accent="#2563EB"
            />
          </div>

          {c.contrato ? (
            <div
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: 14,
                marginBottom: 14,
                background: '#F8FAFC',
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Entidad ejecutora</p>
              <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                {c.contrato.entidad?.nombre ?? '—'}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748B' }}>
                Creado {fmtFecha(c.contrato.created_at)} · ID {c.contrato.id.slice(0, 8)}…
              </p>
            </div>
          ) : (
            <p style={{ color: '#64748B', fontSize: 14, marginTop: 0 }}>
              Esta obra aún no tiene contrato de Administración Delegada. Regístrelo en el módulo del
              proyecto para habilitar compras y despacho.
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <LinkChip href={hrefModulo} label="Abrir módulo de obra →" />
            <LinkChip href="/rrhh/contratacion" label="RRHH contratación →" />
          </div>
        </div>
      )}
    </PanelFrame>
  );
}

export function CcoPresupuestosPanel({ proyectoId }: CommonProps) {
  const { data, loading, error, reload } = useCcoModulos(proyectoId);
  const p = data?.presupuestos;
  const hrefLulo = proyectoId
    ? `/proyectos/modulo/${encodeURIComponent(proyectoId)}/lulo?tab=presupuesto`
    : '/presupuestos';

  return (
    <PanelFrame proyectoId={proyectoId} loading={loading} error={error} onRetry={reload}>
      {!p ? null : (
        <div>
          <div style={kpiGrid}>
            <CcoKpiMini
              title="Presupuestos Lulo"
              value={String(p.presupuestos.length)}
              footnote="Versiones en la obra"
              accent="#7C3AED"
            />
            <CcoKpiMini
              title="Partidas"
              value={String(p.partidasCount)}
              footnote={`Fuente: ${p.fuentePartidas}`}
              accent="#2563EB"
            />
            <CcoKpiMini
              title="Monto estimado"
              value={fmtUsd(p.presupuestoTotalUsd)}
              footnote="Suma partidas"
              accent="#0D9488"
            />
          </div>

          <div style={panelCard}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Versiones Lulo</h3>
            <div style={tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Código OBR</th>
                    <th style={thStyle}>Nombre</th>
                    <th style={thStyle}>Principal</th>
                    <th style={thStyle}>Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {p.presupuestos.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, color: '#94A3B8' }}>
                        Sin presupuestos Lulo. Impórtelos desde el módulo de la obra.
                      </td>
                    </tr>
                  ) : (
                    p.presupuestos.map((row) => (
                      <tr key={row.id}>
                        <td style={tdStyle}>{row.codigo_obr}</td>
                        <td style={tdStyle}>{row.nombre}</td>
                        <td style={tdStyle}>{row.es_principal ? 'Sí' : '—'}</td>
                        <td style={tdStyle}>{fmtFecha(row.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <LinkChip href={hrefLulo} label="Abrir Lulo / presupuesto →" />
              <LinkChip href="/presupuestos" label="Presupuestos ventas →" />
            </div>
          </div>
        </div>
      )}
    </PanelFrame>
  );
}

export function CcoEditorMaestroPanel({ proyectoId }: CommonProps) {
  const { data, loading, error, reload } = useCcoModulos(proyectoId);
  const e = data?.editor;
  const hrefLulo = proyectoId
    ? `/proyectos/modulo/${encodeURIComponent(proyectoId)}/lulo`
    : '/almacen/maestros';

  return (
    <PanelFrame proyectoId={proyectoId || 'all'} loading={loading} error={error} onRetry={reload}>
      {!e ? null : (
        <div style={panelCard}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Editor maestro</h3>
          <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: 13 }}>
            Catálogo Lulo global y partidas de la obra seleccionada. Use el módulo Lulo para editar
            APU, capítulos e insumos.
          </p>
          <div style={kpiGrid}>
            <CcoKpiMini
              title="Capítulos catálogo"
              value={String(e.catalogoCapitulos)}
              footnote="lulo_catalogo_capitulos"
              accent="#7C3AED"
            />
            <CcoKpiMini
              title="Partidas catálogo"
              value={String(e.catalogoPartidas)}
              footnote="Maestro APU"
              accent="#2563EB"
            />
            <CcoKpiMini
              title="Insumos catálogo"
              value={String(e.catalogoInsumos)}
              footnote="Precios base"
              accent="#0D9488"
            />
            <CcoKpiMini
              title="Partidas obra"
              value={String(e.partidasObra)}
              footnote="Presupuesto cargado"
              accent="#B45309"
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <LinkChip href={hrefLulo} label="Abrir editor Lulo →" />
            <LinkChip href="/almacen/maestros" label="Maestros almacén →" />
          </div>
        </div>
      )}
    </PanelFrame>
  );
}

export function CcoImportarPdfPanel({ proyectoId, proyectos }: CommonProps) {
  const { data, loading, error, reload } = useCcoModulos(proyectoId);
  const imp = data?.importar;
  const [open, setOpen] = useState(false);

  return (
    <PanelFrame proyectoId={proyectoId || 'all'} loading={loading} error={error} onRetry={reload}>
      {!imp ? null : (
        <div>
          <div style={panelCard}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Importar PDF / CSV</h3>
            <p style={{ margin: '0 0 14px', color: '#64748B', fontSize: 13 }}>
              Extrae tablas históricas de compras (PDF/imagen con IA o CSV desde Excel) y las guarda
              en Contabilidad de la obra sin afectar stock.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setOpen(true)}
                style={{
                  border: 'none',
                  background: '#2563EB',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Abrir importador
              </button>
              <LinkChip href="/contabilidad/compras" label="Ir a Compras CI →" />
              <LinkChip href="/contabilidad/compras/canal" label="Canal Telegram →" />
            </div>
            <div style={kpiGrid}>
              <CcoKpiMini
                title="Importados detectados"
                value={String(imp.countImportados)}
                footnote="Origen CSV/tabla/PDF"
                accent="#2563EB"
              />
              <CcoKpiMini
                title="Últimos mostrados"
                value={String(imp.importsRecientes.length)}
                footnote="Vista rápida"
                accent="#0D9488"
              />
            </div>
          </div>

          <div style={{ ...panelCard, marginTop: 14 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Registros recientes</h3>
            <div style={tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Proveedor</th>
                    <th style={thStyle}>Factura</th>
                    <th style={thStyle}>Origen</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>USD</th>
                  </tr>
                </thead>
                <tbody>
                  {imp.importsRecientes.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ ...tdStyle, color: '#94A3B8' }}>
                        Aún no hay compras para mostrar. Use el importador.
                      </td>
                    </tr>
                  ) : (
                    imp.importsRecientes.map((r) => (
                      <tr key={r.id}>
                        <td style={tdStyle}>{fmtFecha(r.fecha)}</td>
                        <td style={tdStyle}>{r.proveedor}</td>
                        <td style={tdStyle}>{r.factura}</td>
                        <td style={tdStyle}>{r.origen}</td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {fmtUsd(r.montoUsd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <CargarFacturaCuadroModal
            open={open}
            onClose={() => setOpen(false)}
            proyectos={proyectos}
            proyectoIdInicial={proyectoId || null}
            onGuardado={() => {
              setOpen(false);
              void reload();
            }}
          />
        </div>
      )}
    </PanelFrame>
  );
}

export function CcoDistribucionPanel({ proyectoId }: CommonProps) {
  const { data, loading, error, reload } = useCcoModulos(proyectoId);
  const d = data?.distribucion;
  const hrefDespacho = '/almacen/despacho';

  return (
    <PanelFrame proyectoId={proyectoId} loading={loading} error={error} onRetry={reload}>
      {!d ? null : (
        <div style={panelCard}>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Distribución masiva</h3>
          <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: 13 }}>
            Reparte cantidades de despacho entre partidas del presupuesto. El flujo operativo vive en
            Almacén › Despacho; aquí ve el techo presupuestario de la obra.
          </p>
          <div style={kpiGrid}>
            <CcoKpiMini
              title="Partidas"
              value={String(d.partidasTotal)}
              footnote="En presupuesto"
              accent="#2563EB"
            />
            <CcoKpiMini
              title="Con monto"
              value={String(d.partidasConPresupuesto)}
              footnote="Listas para imputar"
              accent="#16A34A"
            />
            <CcoKpiMini
              title="Presupuesto"
              value={fmtUsd(d.montoPresupuestadoUsd)}
              footnote="Techo estimado"
              accent="#B45309"
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <LinkChip href={hrefDespacho} label="Abrir despacho / distribución →" />
            {proyectoId ? (
              <LinkChip
                href={`/proyectos/modulo/${encodeURIComponent(proyectoId)}/lulo?tab=presupuesto`}
                label="Ver partidas Lulo →"
              />
            ) : null}
          </div>
        </div>
      )}
    </PanelFrame>
  );
}

export function CcoAuditoriaPanel({ proyectoId }: CommonProps) {
  const { data, loading, error, reload } = useCcoModulos(proyectoId);
  const a = data?.auditoria;

  return (
    <PanelFrame proyectoId={proyectoId || 'all'} loading={loading} error={error} onRetry={reload}>
      {!a ? null : (
        <div>
          <div style={kpiGrid}>
            <CcoKpiMini
              title="Fechas OK"
              value={String(a.countOkMuestra)}
              footnote="Muestra reciente"
              accent="#16A34A"
            />
            <CcoKpiMini
              title="Advertencias"
              value={String(a.countAdvertencia)}
              footnote="Fecha sospechosa"
              accent="#D97706"
            />
            <CcoKpiMini
              title="Críticas"
              value={String(a.countCritico)}
              footnote="Revisar urgente"
              accent="#DC2626"
            />
          </div>

          <div style={{ ...panelCard, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>
              Alertas de fecha en compras
            </h3>
            <div style={tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nivel</th>
                    <th style={thStyle}>Factura</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {a.alertasFecha.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, color: '#94A3B8' }}>
                        Sin alertas de fecha en la muestra actual.
                      </td>
                    </tr>
                  ) : (
                    a.alertasFecha.map((al) => (
                      <tr key={al.id}>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: al.nivel === 'critico' ? '#B91C1C' : '#B45309',
                              background:
                                al.nivel === 'critico' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.15)',
                              padding: '3px 8px',
                              borderRadius: 999,
                              textTransform: 'uppercase',
                            }}
                          >
                            {al.nivel}
                          </span>
                        </td>
                        <td style={tdStyle}>{al.titulo}</td>
                        <td style={tdStyle}>{fmtFecha(al.fecha ?? '')}</td>
                        <td style={tdStyle}>{al.detalle}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14 }}>
              <LinkChip href="/contabilidad/compras" label="Revisar en compras →" />
            </div>
          </div>

          <div
            style={{
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid #1E293B',
              background: '#0F172A',
            }}
          >
            <PanelAuditoriaProcuras />
          </div>
        </div>
      )}
    </PanelFrame>
  );
}
