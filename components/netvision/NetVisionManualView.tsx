import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import Link from 'next/link'

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 text-3xl font-bold tracking-tight text-white">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-10 border-b border-white/10 pb-2 text-xl font-semibold text-white">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-8 text-lg font-semibold text-[var(--nexus-cyan)]">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-6 text-base font-semibold text-white/90">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mb-4 text-sm leading-relaxed text-[var(--nexus-text-muted)]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm text-[var(--nexus-text-muted)]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-[var(--nexus-text-muted)]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white/90">{children}</strong>,
  a: ({ href, children }) => {
    const isInternal = href?.startsWith('/')
    if (isInternal && href) {
      return (
        <Link href={href} className="text-[var(--nexus-cyan)] underline-offset-2 hover:underline">
          {children}
        </Link>
      )
    }
    return (
      <a
        href={href}
        className="text-[var(--nexus-cyan)] underline-offset-2 hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    )
  },
  blockquote: ({ children }) => (
    <blockquote className="mb-6 rounded-lg border border-[rgba(0,242,254,0.25)] bg-[rgba(0,242,254,0.06)] px-4 py-3 text-sm text-[var(--nexus-text-muted)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-white/10" />,
  code: ({ className, children }) => {
    const isBlock = Boolean(className)
    if (isBlock) {
      return (
        <code className="block whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[var(--nexus-cyan)]/90">
          {children}
        </code>
      )
    }
    return (
      <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-[var(--nexus-cyan)]">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="mb-6 overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-6 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-white/10 px-3 py-2 font-semibold text-white">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-white/5 px-3 py-2 text-[var(--nexus-text-muted)]">{children}</td>
  ),
}

export default function NetVisionManualView({ markdown }: { markdown: string }) {
  return (
    <article className="mx-auto max-w-3xl px-1 pb-16 pt-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </article>
  )
}
