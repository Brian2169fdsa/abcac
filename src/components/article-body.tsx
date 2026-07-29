import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Site-token styling for long-form markdown articles (no typography plugin).
export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="text-base leading-relaxed text-muted md:text-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: (p) => <h2 className="mt-10 font-display text-xl font-bold text-ink sm:text-2xl" {...p} />,
          h3: (p) => <h3 className="mt-8 font-display text-lg font-bold text-ink sm:text-xl" {...p} />,
          p: (p) => <p className="mt-4" {...p} />,
          ul: (p) => <ul className="mt-4 list-disc space-y-2 pl-6" {...p} />,
          ol: (p) => <ol className="mt-4 list-decimal space-y-2 pl-6" {...p} />,
          li: (p) => <li className="[&>p]:mt-0" {...p} />,
          strong: (p) => <strong className="font-semibold text-ink" {...p} />,
          a: (p) => <a className="font-semibold text-brand underline underline-offset-2 hover:text-brand-600" {...p} />,
          blockquote: (p) => (
            <blockquote className="mt-6 rounded-r-xl border-l-4 border-brand bg-surface px-5 py-4 [&>p]:mt-0 [&>p+p]:mt-3" {...p} />
          ),
          hr: () => <hr className="my-10 border-line" />,
          table: (p) => (
            <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full text-sm" {...p} />
            </div>
          ),
          thead: (p) => <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted" {...p} />,
          th: (p) => <th className="px-4 py-3 font-semibold" {...p} />,
          td: (p) => <td className="border-t border-line px-4 py-3 align-top" {...p} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
