'use client';

import { useMemo } from 'react';
import type {
  LegalDocumentBlock,
  LegalDocumentStructured,
  LegalTableRow,
} from '@/lib/legal/documentoEstructurado';

export type DocumentBlocksViewProps = {
  document: LegalDocumentStructured;
  /** Si true, las cláusulas (y opcionalmente párrafos) son editables. */
  editable?: boolean;
  onChange?: (next: LegalDocumentStructured) => void;
  className?: string;
};

/**
 * Pseudocódigo:
 *   blocks.forEach(block => {
 *     if (block.type === 'title') renderTitle(...)
 *     if (block.type === 'paragraph') renderParagraph(...)
 *     if (block.type === 'clause') renderEditableClause(...)
 *   })
 */
export function handleDocumentResponse(
  jsonResponse: LegalDocumentStructured,
  renderers: {
    renderTitle: (content: string, index: number) => void;
    renderParagraph: (content: string, index: number) => void;
    renderEditableClause: (content: string, index: number) => void;
    renderTable?: (rows: LegalTableRow[], index: number) => void;
    renderOther?: (block: LegalDocumentBlock, index: number) => void;
  },
): void {
  const { blocks } = jsonResponse;
  blocks.forEach((block, index) => {
    if (block.type === 'title') renderers.renderTitle(block.content, index);
    if (block.type === 'paragraph') renderers.renderParagraph(block.content, index);
    if (block.type === 'clause') renderers.renderEditableClause(block.content, index);
    if (block.type === 'table' && renderers.renderTable) {
      renderers.renderTable(block.content, index);
    }
    if (
      block.type !== 'title' &&
      block.type !== 'paragraph' &&
      block.type !== 'clause' &&
      block.type !== 'table' &&
      renderers.renderOther
    ) {
      renderers.renderOther(block, index);
    }
  });
}

function updateBlockContent(
  doc: LegalDocumentStructured,
  index: number,
  content: string | LegalTableRow[] | string[],
): LegalDocumentStructured {
  return {
    ...doc,
    blocks: doc.blocks.map((b, i) => {
      if (i !== index) return b;
      return { ...b, content } as LegalDocumentBlock;
    }),
  };
}

export default function DocumentBlocksView({
  document,
  editable = false,
  onChange,
  className,
}: DocumentBlocksViewProps) {
  const blocks = document.blocks;

  const nodes = useMemo(() => {
    return blocks.map((block, index) => {
      const key = `${block.type}-${index}`;

      if (block.type === 'title') {
        return (
          <h2
            key={key}
            className="mt-6 text-sm font-bold uppercase tracking-wide text-amber-100 first:mt-0"
          >
            {block.content}
          </h2>
        );
      }

      if (block.type === 'subtitle') {
        return (
          <h3 key={key} className="mt-4 text-sm font-semibold text-zinc-200">
            {block.content}
          </h3>
        );
      }

      if (block.type === 'paragraph') {
        if (editable && onChange) {
          return (
            <textarea
              key={key}
              value={block.content}
              onChange={(e) =>
                onChange(updateBlockContent(document, index, e.target.value))
              }
              className="mt-3 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none focus:border-amber-500/35"
              rows={Math.max(2, Math.ceil(block.content.length / 80))}
            />
          );
        }
        return (
          <p key={key} className="mt-3 text-sm leading-relaxed text-zinc-300 text-justify">
            {block.content}
          </p>
        );
      }

      if (block.type === 'clause') {
        // renderEditableClause
        if (editable && onChange) {
          return (
            <div
              key={key}
              className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2"
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">
                Cláusula editable
              </p>
              <textarea
                value={block.content}
                onChange={(e) =>
                  onChange(updateBlockContent(document, index, e.target.value))
                }
                className="w-full resize-y rounded-md border border-white/10 bg-black/40 px-2.5 py-2 text-sm leading-relaxed text-zinc-100 outline-none focus:border-amber-500/40"
                rows={Math.max(2, Math.ceil(block.content.length / 70))}
              />
            </div>
          );
        }
        return (
          <p
            key={key}
            className="mt-3 border-l-2 border-amber-500/40 pl-3 text-sm leading-relaxed text-zinc-200 text-justify"
          >
            {block.content}
          </p>
        );
      }

      if (block.type === 'table') {
        const rows = block.content;
        if (!rows.length) return null;
        const keys = Object.keys(rows[0]!);
        return (
          <div key={key} className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm text-zinc-300">
              <thead>
                <tr>
                  {keys.map((k) => (
                    <th
                      key={k}
                      className="border border-white/15 bg-white/5 px-2 py-1.5 text-left text-xs font-semibold text-zinc-400"
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {keys.map((k) => (
                      <td key={k} className="border border-white/10 px-2 py-1.5">
                        {String(row[k] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (block.type === 'list') {
        return (
          <ul key={key} className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {block.content.map((item, li) => (
              <li key={li}>{item}</li>
            ))}
          </ul>
        );
      }

      if (block.type === 'signature') {
        return (
          <div key={key} className="mt-8">
            <div className="mb-2 h-px w-56 bg-zinc-500" />
            <p className="text-sm text-zinc-400">{block.content}</p>
          </div>
        );
      }

      return null;
    });
  }, [blocks, document, editable, onChange]);

  return (
    <article
      className={
        className ??
        'rounded-2xl border border-white/10 bg-[#0c1018] px-5 py-6 font-serif'
      }
    >
      <h1 className="text-center text-lg font-bold uppercase tracking-wide text-white">
        {document.document_title}
      </h1>
      <div className="mt-6">{nodes}</div>
    </article>
  );
}
