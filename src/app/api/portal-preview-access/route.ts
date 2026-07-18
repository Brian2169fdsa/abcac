import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/public-rate-limit";
import {
  PORTAL_PREVIEW_COOKIE,
  createPortalPreviewToken,
  isValidPortalPreviewCode,
} from "@/lib/portal-preview";

export async function POST(request: Request) {
  const limit = checkRateLimit("portal-preview-access", getClientIp(request));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      },
    );
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!isValidPortalPreviewCode(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: PORTAL_PREVIEW_COOKIE,
    value: await createPortalPreviewToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
