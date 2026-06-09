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
    <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="break-words">{title}</h3>
      <p className="mt-2 flex-1 text-muted">{description}</p>
      {href && (
        <Link href={href} className="mt-4 inline-flex min-h-[44px] items-center gap-1 font-semibold text-brand hover:text-brand-600">
          {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
