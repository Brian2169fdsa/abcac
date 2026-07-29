import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import type { BlogPostSummary } from "@/lib/blog";

interface BlogCardProps {
  post: BlogPostSummary;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.6rem] border border-ink/10 bg-surface shadow-[0_24px_60px_-46px_rgba(13,34,63,0.65)] transition duration-300 hover:-translate-y-1 hover:border-brand/25 hover:shadow-[0_30px_70px_-42px_rgba(13,34,63,0.55)]">
      <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/9] overflow-hidden bg-info">
        <Image
          src={post.featuredImage}
          alt={post.featuredImageAlt}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-[1.035]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-info/20 via-transparent to-transparent" aria-hidden />
      </Link>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full border border-brand/15 bg-brand/[0.055] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-brand">
            {post.category}
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="h-1 w-1 rounded-full bg-brand/45" aria-hidden />
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {post.readingTime}
            </span>
          </div>
        </div>
        <h2 className="mt-4 line-clamp-3 text-lg leading-snug transition-colors group-hover:text-brand sm:text-xl">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h2>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">{post.excerpt}</p>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand transition-colors hover:text-brand-600"
        >
          Read article
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
