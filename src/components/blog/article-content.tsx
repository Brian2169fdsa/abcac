import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight } from "lucide-react";
import { slugifyHeading } from "@/lib/blog";

interface ArticleContentProps {
  content: string;
}

function ArticleLink({ href = "", children, ...props }: ComponentPropsWithoutRef<"a">) {
  const external = href.startsWith("http");
  const directLink = external || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#");
  const className = "font-semibold text-brand underline decoration-brand/25 decoration-2 underline-offset-4 transition hover:text-brand-600 hover:decoration-brand";

  if (directLink) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={className}
        {...props}
      >
        {children}
        {external && <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" aria-hidden />}
      </a>
    );
  }

  return <Link href={href} className={className}>{children}</Link>;
}

export function ArticleContent({ content }: ArticleContentProps) {
  return (
    <div className="article-content text-[1.04rem] leading-[1.85] text-ink/82">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: () => null,
          h2: ({ children }) => {
            const title = String(children);
            return (
              <h2 id={slugifyHeading(title)} className="scroll-mt-32 border-t border-ink/10 pt-10 text-[1.85rem] first:border-0 first:pt-0 sm:text-[2.1rem]">
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const title = String(children);
            return <h3 id={slugifyHeading(title)} className="scroll-mt-32 text-[1.35rem]">{children}</h3>;
          },
          p: ({ children }) => <p>{children}</p>,
          a: ArticleLink,
          ul: ({ children }) => <ul className="list-disc space-y-2 pl-6 marker:text-brand">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-2 pl-6 marker:font-bold marker:text-brand">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
          em: ({ children }) => <em className="text-muted">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="rounded-r-2xl border-l-4 border-brand bg-brand/[0.055] px-6 py-5 text-ink shadow-sm">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-ink/10" />,
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-2xl border border-ink/10 shadow-sm">
              <table className="w-full min-w-[42rem] border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-info text-white">{children}</thead>,
          th: ({ children }) => <th className="px-4 py-3 font-bold">{children}</th>,
          td: ({ children }) => <td className="border-t border-ink/10 px-4 py-3 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
