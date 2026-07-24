/**
 * Render mínimo de markdown legal → HTML para vista previa / impresión.
 * No pretende ser un parser completo.
 */

export function markdownLegalToHtml(md: string): string {
  const escaped = (md || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      out.push('<br/>');
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return out.join('\n');
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

export function documentoPrintHtml(titulo: string, cuerpoMarkdown: string): string {
  const body = markdownLegalToHtml(cuerpoMarkdown);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${titulo.replace(/</g, '')}</title>
<style>
  body { font-family: "Times New Roman", Times, serif; max-width: 720px; margin: 2rem auto; color: #111; line-height: 1.45; }
  h1 { font-size: 1.35rem; text-align: center; text-transform: uppercase; }
  h2 { font-size: 1.05rem; margin-top: 1.4rem; }
  p { margin: 0.55rem 0; text-align: justify; }
  ul { margin: 0.4rem 0 0.4rem 1.2rem; }
  @media print { body { margin: 1.2cm; } }
</style>
</head>
<body>
${body}
<script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}
