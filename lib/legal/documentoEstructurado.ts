/**
 * Documento legal estructurado (bloques tipados).
 *
 * Ejemplo:
 * {
 *   "document_title": "Contrato de Prestación de Servicios",
 *   "blocks": [
 *     {"type": "title", "content": "CLÁUSULA PRIMERA: OBJETO DEL CONTRATO"},
 *     {"type": "paragraph", "content": "LA EMPRESA XX se compromete a realizar..."},
 *     {"type": "clause", "content": "El pago será de Bs. XXX pagadero mensualmente..."},
 *     {"type": "table", "content": [{"col1": "Concepto", "col2": "Monto"}, ...]}
 *   ]
 * }
 */

export const LEGAL_BLOCK_TYPES = [
  'title',
  'paragraph',
  'clause',
  'table',
  'subtitle',
  'signature',
  'list',
] as const;

export type LegalBlockType = (typeof LEGAL_BLOCK_TYPES)[number];

export type LegalTableRow = Record<string, string | number | null | undefined>;

export type LegalDocumentBlock =
  | { type: 'title' | 'subtitle' | 'paragraph' | 'clause' | 'signature'; content: string }
  | { type: 'table'; content: LegalTableRow[] }
  | { type: 'list'; content: string[] };

export type LegalDocumentStructured = {
  document_title: string;
  blocks: LegalDocumentBlock[];
};

export const LEGAL_DOCUMENT_ESTRUCTURADO_EJEMPLO: LegalDocumentStructured = {
  document_title: 'Contrato de Prestación de Servicios',
  blocks: [
    { type: 'title', content: 'CLÁUSULA PRIMERA: OBJETO DEL CONTRATO' },
    {
      type: 'paragraph',
      content: 'LA EMPRESA XX se compromete a realizar...',
    },
    {
      type: 'clause',
      content: 'El pago será de Bs. XXX pagadero mensualmente...',
    },
    {
      type: 'table',
      content: [
        { col1: 'Concepto', col2: 'Monto' },
        { col1: 'Servicio A', col2: '100' },
      ],
    },
  ],
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v != null && !Array.isArray(v);
}

export function parseDocumentoEstructurado(
  raw: unknown,
): LegalDocumentStructured | null {
  if (!isRecord(raw)) return null;
  const title = String(raw.document_title ?? '').trim();
  const blocksRaw = raw.blocks;
  if (!title || !Array.isArray(blocksRaw)) return null;

  const blocks: LegalDocumentBlock[] = [];
  for (const b of blocksRaw) {
    if (!isRecord(b)) continue;
    const type = String(b.type ?? '').trim() as LegalBlockType;
    if (!LEGAL_BLOCK_TYPES.includes(type)) continue;

    if (type === 'table') {
      if (!Array.isArray(b.content)) continue;
      const rows = b.content.filter(isRecord).map((row) => {
        const out: LegalTableRow = {};
        for (const [k, v] of Object.entries(row)) {
          out[k] = v == null ? '' : String(v);
        }
        return out;
      });
      blocks.push({ type: 'table', content: rows });
      continue;
    }

    if (type === 'list') {
      const items = Array.isArray(b.content)
        ? b.content.map((x) => String(x))
        : String(b.content ?? '')
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean);
      blocks.push({ type: 'list', content: items });
      continue;
    }

    blocks.push({
      type: type as 'title' | 'subtitle' | 'paragraph' | 'clause' | 'signature',
      content: String(b.content ?? ''),
    });
  }

  if (!blocks.length) return null;
  return { document_title: title, blocks };
}

/** JSON estructurado → markdown (compat con editor actual). */
export function estructuradoToMarkdown(doc: LegalDocumentStructured): string {
  const lines: string[] = [`# ${doc.document_title}`, ''];

  for (const block of doc.blocks) {
    switch (block.type) {
      case 'title':
        lines.push(`## ${block.content}`, '');
        break;
      case 'subtitle':
        lines.push(`### ${block.content}`, '');
        break;
      case 'paragraph':
        lines.push(block.content, '');
        break;
      case 'clause':
        lines.push(`> ${block.content}`, '');
        break;
      case 'signature':
        lines.push('', '______________________________', block.content, '');
        break;
      case 'list':
        for (const item of block.content) lines.push(`- ${item}`);
        lines.push('');
        break;
      case 'table': {
        const rows = block.content;
        if (!rows.length) break;
        const keys = Object.keys(rows[0]!);
        lines.push(`| ${keys.join(' | ')} |`);
        lines.push(`| ${keys.map(() => '---').join(' | ')} |`);
        for (const row of rows) {
          lines.push(`| ${keys.map((k) => String(row[k] ?? '')).join(' | ')} |`);
        }
        lines.push('');
        break;
      }
      default:
        break;
    }
  }

  return lines.join('\n').trim() + '\n';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** JSON estructurado → HTML tipográfico para impresión. */
export function estructuradoToHtml(doc: LegalDocumentStructured): string {
  const parts: string[] = [
    `<h1 class="doc-title">${esc(doc.document_title)}</h1>`,
  ];

  for (const block of doc.blocks) {
    switch (block.type) {
      case 'title':
        parts.push(`<h2 class="clause-title">${esc(block.content)}</h2>`);
        break;
      case 'subtitle':
        parts.push(`<h3>${esc(block.content)}</h3>`);
        break;
      case 'paragraph':
        parts.push(`<p class="paragraph">${esc(block.content)}</p>`);
        break;
      case 'clause':
        parts.push(`<p class="clause">${esc(block.content)}</p>`);
        break;
      case 'signature':
        parts.push(
          `<div class="signature"><div class="line"></div><p>${esc(block.content)}</p></div>`,
        );
        break;
      case 'list':
        parts.push(
          `<ul>${block.content.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`,
        );
        break;
      case 'table': {
        const rows = block.content;
        if (!rows.length) break;
        const keys = Object.keys(rows[0]!);
        const head = keys.map((k) => `<th>${esc(k)}</th>`).join('');
        const body = rows
          .map(
            (row) =>
              `<tr>${keys.map((k) => `<td>${esc(String(row[k] ?? ''))}</td>`).join('')}</tr>`,
          )
          .join('');
        parts.push(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
        break;
      }
      default:
        break;
    }
  }

  return parts.join('\n');
}

export function documentoEstructuradoPrintHtml(doc: LegalDocumentStructured): string {
  const body = estructuradoToHtml(doc);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${esc(doc.document_title)}</title>
<style>
  body { font-family: "Times New Roman", Times, serif; max-width: 720px; margin: 2rem auto; color: #111; line-height: 1.45; }
  .doc-title { font-size: 1.4rem; text-align: center; text-transform: uppercase; margin-bottom: 1.5rem; }
  .clause-title { font-size: 1.05rem; margin-top: 1.4rem; text-transform: uppercase; }
  .paragraph, .clause { text-align: justify; margin: 0.6rem 0; }
  .clause { padding-left: 0.5rem; border-left: 2px solid #ccc; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.95rem; }
  th, td { border: 1px solid #333; padding: 0.35rem 0.5rem; text-align: left; }
  th { background: #f3f3f3; }
  .signature { margin-top: 2.5rem; }
  .signature .line { border-top: 1px solid #111; width: 240px; margin-bottom: 0.35rem; }
  @media print { body { margin: 1.2cm; } }
</style>
</head>
<body>
${body}
<script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}
