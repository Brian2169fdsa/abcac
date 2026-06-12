"use client";

import Link from "next/link";
import Image from "next/image";
import { Mail, Menu, LogOut, ArrowLeft, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/sign-out-button";
import { NotificationBell } from "@/components/portal/notification-bell";
import type { Notification } from "@/lib/notifications";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/**
 * Maroon top bar + white brand bar, matching the static portal chrome
 * (public/portal/index.html). The hamburger button (mobile only) toggles the
 * sidebar drawer owned by the shell.
 */
export function PortalTopbar({
  memberName,
  messageCount = 0,
  isAdmin = false,
  notificationCount = 0,
  notifications = [],
  onMenuToggle,
}: {
  memberName: string;
  messageCount?: number;
  isAdmin?: boolean;
  notificationCount?: number;
  notifications?: Notification[];
  onMenuToggle: () => void;
}) {
  return (
    <>
      {/* Maroon top bar */}
      <div className="flex h-12 items-center justify-between gap-2 bg-brand px-3 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Back to Site</span>
        </Link>

        <div className="flex items-center gap-2">
        {isAdmin && (
          <>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded bg-white/15 px-2.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/25"
            >
              <Shield className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Admin Console</span>
            </Link>
            <div className="h-6 w-px bg-white/15" aria-hidden />
          </>
        )}
        <Link
          href="/account/messages"
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Mail className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Messages</span>
          {messageCount > 0 && <Badge className="bg-red-600">{messageCount}</Badge>}
        </Link>

        <NotificationBell count={notificationCount} items={notifications} />

        <div className="h-6 w-px bg-white/15" aria-hidden />

        <Link
          href="/account/settings"
          className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-white/10"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-white"
            aria-hidden
          >
            {initials(memberName)}
          </span>
          <span className="hidden sm:inline">{memberName}</span>
        </Link>

        <div className="h-6 w-px bg-white/15" aria-hidden />

        <SignOutButton className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-white/80 transition-colors hover:bg-white/10 hover:text-white">
          <LogOut className="h-4 w-4 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Sign Out</span>
        </SignOutButton>
        </div>
      </div>

      {/* White brand bar */}
      <div className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5 md:gap-4 md:px-6">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Open menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand lg:hidden"
        >
          <Menu className="h-6 w-6" aria-hidden />
        </button>
        <Image
          src="/brand/abcac-logo.jpg"
          alt="ABCAC logo"
          width={48}
          height={48}
          className="h-9 w-9 flex-shrink-0 rounded-lg object-contain md:h-12 md:w-12"
        />
        <div className="leading-tight">
          <h1 className="font-display text-[13px] font-semibold text-brand md:text-[18px]">
            Arizona Board for Certification of Addiction Counselors
          </h1>
          <p className="text-[10px] tracking-wide text-muted md:text-[11px]">
            IC&amp;RC Member Board — Member Portal
          </p>
        </div>
      </div>
    </>
  );
}
