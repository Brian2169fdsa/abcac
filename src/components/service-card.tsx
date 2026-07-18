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
    <div className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_18px_50px_-34px_rgba(13,34,63,0.5)] transition duration-300 hover:-translate-y-1 hover:border-brand/20 hover:shadow-[0_24px_60px_-30px_rgba(13,34,63,0.32)] sm:p-6">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-600 text-white shadow-lg shadow-brand/15">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="break-words text-lg">{title}</h3>
      <p className="mt-3 flex-1 leading-relaxed text-muted">{description}</p>
      {href && (
        <Link href={href} className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand hover:text-brand-600">
          {linkLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
    </div>
  );
}
