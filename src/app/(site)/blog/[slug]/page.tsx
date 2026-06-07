import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPost, getPosts } from "@/lib/blog";

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug);
  if (!post) return { title: "Not found" };
  return { title: post.title, description: post.excerpt };
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-14 md:px-8">
      <Link href="/blog" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All news
      </Link>
      <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">{fmt(post.date)}</p>
      <h1 className="mt-2">{post.title}</h1>
      <div className="mt-6 space-y-4 text-lg text-muted">
        {post.body.map((para, i) => <p key={i}>{para}</p>)}
      </div>
    </article>
  );
}
