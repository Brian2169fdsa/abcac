import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

interface ServiceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}

export function ServiceCard({ icon: Icon, title, description, href, linkLabel = "Learn more" }: ServiceCardProps) {
  return (
    <div className="group modern-surface relative flex h-full flex-col overflow-hidden rounded-[1.5rem] p-5 transition duration-300 hover:-translate-y-1.5 hover:border-brand/20 hover:shadow-[0_28px_70px_-36px_rgba(13,34,63,0.34)] sm:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/45 to-transparent opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-600 text-white shadow-[0_12px_28px_-14px_rgba(123,31,31,0.8)] transition-transform duration-300 group-hover:rotate-[-3deg] group-hover:scale-105">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="break-words text-lg leading-snug">{title}</h3>
      <p className="mt-3 flex-1 leading-relaxed text-muted">{description}</p>
      {href && (
        <Link href={href} className="mt-6 inline-flex min-h-[44px] items-center gap-2 border-t border-line pt-4 text-sm font-semibold text-brand hover:text-brand-600">
          {linkLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
    </div>
  );
}
