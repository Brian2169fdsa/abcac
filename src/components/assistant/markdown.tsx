"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Styled markdown for assistant replies. Renders GitHub-flavored markdown
 * (headings, bold, lists, tables, code, rules) with ABCAC design tokens so a
 * model response looks like a polished report — dark header rows on tables,
 * clean spacing, maroon accents. Used inside the chat widget's assistant bubble.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-1 font-display text-base font-bold text-ink">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-2 font-display text-[15px] font-bold text-ink">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-2 text-sm font-semibold uppercase tracking-wide text-brand">{children}</h3>
          ),
          p: ({ children }) => <p className="text-sm leading-relaxed text-ink/90">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium text-brand underline underline-offset-2 hover:text-brand-600">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-1 text-sm text-ink/90">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1 text-sm text-ink/90">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          hr: () => <hr className="my-3 border-line" />,
          code: ({ children }) => (
            <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-[12px] text-ink">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-brand/40 pl-3 text-sm text-muted">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-line">
              <table className="w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-ink text-white">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">{children}</th>
          ),
          tbody: ({ children }) => <tbody className="divide-y divide-line">{children}</tbody>,
          tr: ({ children }) => <tr className="even:bg-bg/60">{children}</tr>,
          td: ({ children }) => <td className="px-3 py-2 text-ink/90">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
