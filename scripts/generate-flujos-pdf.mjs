/**
 * Genera docs/flujos-aplicacion-casa-inteligente.pdf con @react-pdf/renderer
 * Uso: node scripts/generate-flujos-pdf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToFile,
  Font,
} from '@react-pdf/renderer';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pdfPath = path.join(root, 'docs/flujos-aplicacion-casa-inteligente.pdf');

Font.register({
  family: 'Helvetica',
  fonts: [{ src: 'Helvetica' }, { src: 'Helvetica-Bold', fontWeight: 'bold' }],
});

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', lineHeight: 1.45 },
  h1: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  h2: { fontSize: 13, fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: '#007AFF' },
  h3: { fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
  meta: { fontSize: 9, color: '#666', marginBottom: 16 },
  p: { marginBottom: 6 },
  li: { marginBottom: 3, paddingLeft: 8 },
  box: {
    backgroundColor: '#f4f6f8',
    padding: 10,
    marginVertical: 8,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: 'Courier',
  },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #ddd', paddingVertical: 4 },
  th: { flex: 1, fontWeight: 'bold', fontSize: 9 },
  td: { flex: 1, fontSize: 9 },
});

function Li({ children }) {
  return React.createElement(Text, { style: s.li }, `• ${children}`);
}

function FlowBox({ children }) {
  return React.createElement(View, { style: s.box }, React.createElement(Text, null, children));
}

const fecha = new Date().toLocaleDateString('es-VE', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const Doc = () =>
  React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.h1 }, 'Casa Inteligente — Mapa de flujos'),
      React.createElement(
        Text,
        { style: s.meta },
        `Revisión operativa · ${fecha} · casainteligente.company`,
      ),
      React.createElement(Text, { style: s.h2 }, '1. Arquitectura'),
      React.createElement(
        FlowBox,
        null,
        'Telegram Bot + Web Next.js → API Routes → lib/ → Supabase Postgres\nOCR Gemini · Contabilidad · Inventario · Procuras · RRHH',
      ),
      React.createElement(Text, { style: s.h2 }, '2. Procura Telegram (/procura)'),
      React.createElement(Li, null, '1 Capítulo APU → 2 Material → catálogo o Ingresa Material'),
      React.createElement(Li, null, '3 Cantidad → 4 Unidad → 5 Prioridad → 6 CONFIRMACIÓN'),
      React.createElement(Li, null, 'PROCURA REGISTRADA → vía rápida (OC auto) o vía larga (alerta PM)'),
      React.createElement(Text, { style: s.h2 }, '3. Aprobación y abastecimiento'),
      React.createElement(
        FlowBox,
        null,
        'PM aprueba → consulta stock almacén → orden verificación depositario\n' +
          'Stock OK → despacho SAL a obra (recibida)\n' +
          'Sin stock → orden de compra (en_compra)\n' +
          'Parcial → despacho + OC por saldo',
      ),
      React.createElement(Text, { style: s.h2 }, '4. Compras y almacén'),
      React.createElement(Li, null, '/facturas — OCR → contabilidad → precarga almacén'),
      React.createElement(Li, null, '/ingreso — manual, nota, sin nota'),
      React.createElement(Li, null, '/recepcion — sincronía web recepción campo'),
      React.createElement(Li, null, '/liberar — depositario cuarentena → almacén'),
      React.createElement(Li, null, 'Recepción con procura_id → recibida / recibida_parcial'),
      React.createElement(Text, { style: s.h2 }, '5. Despacho'),
      React.createElement(Li, null, '/salida Telegram — transferencia salida_obra'),
      React.createElement(Li, null, 'Web /almacen/despacho — imputación partida'),
      React.createElement(Li, null, '/traspaso — entre almacenes u obras'),
    ),
    React.createElement(
      Page,
      { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.h2 }, '6. Módulos web'),
      React.createElement(
        View,
        { style: s.tableRow },
        React.createElement(Text, { style: s.th }, 'Ruta'),
        React.createElement(Text, { style: s.th }, 'Función'),
      ),
      ...[
        ['/proyectos/modulo', 'Obras, BOT usuarios Telegram, Fast-Track'],
        ['/contabilidad/procuras', 'Cuadro procuras, aprobación lote'],
        ['/contabilidad/compras', 'Facturas e ingreso almacén'],
        ['/almacen', 'Stock, despacho, recepción, trazabilidad'],
        ['/configuracion/telegram', 'Usuarios compras, whitelist'],
      ].flatMap(([ruta, fn]) => [
        React.createElement(
          View,
          { style: s.tableRow, key: ruta },
          React.createElement(Text, { style: s.td }, ruta),
          React.createElement(Text, { style: s.td }, fn),
        ),
      ]),
      React.createElement(Text, { style: s.h2 }, '7. Roles Telegram'),
      React.createElement(Li, null, 'Solicitante — /procura'),
      React.createElement(Li, null, 'Aprobador (PM) — alertas y botones aprobar/rechazar'),
      React.createElement(Li, null, 'Administrador — canal admin + DM'),
      React.createElement(Li, null, 'Comprador — órdenes de compra, /facturas'),
      React.createElement(Li, null, 'Depositario — verificación almacén, /liberar'),
      React.createElement(Text, { style: s.h2 }, '8. Estados procura (FSM)'),
      React.createElement(
        FlowBox,
        null,
        'solicitada → aprobada → recibida | en_compra | recibida_parcial\n' +
          'solicitada → aprobada_directa → en_compra\n' +
          'en_compra → recibida_parcial → recibida\n' +
          'solicitada → rechazada',
      ),
      React.createElement(Text, { style: s.h3 }, 'Diagramas interactivos'),
      React.createElement(
        Text,
        { style: s.p },
        'Abra docs/flujos-aplicacion-casa-inteligente.html en el navegador para ver esquemas Mermaid con zoom.',
      ),
    ),
  );

await renderToFile(React.createElement(Doc), pdfPath);
console.log('PDF generado:', pdfPath);
