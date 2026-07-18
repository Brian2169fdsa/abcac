export const PORTAL_PREVIEW_COOKIE = "abcac_portal_preview";

const DEFAULT_PREVIEW_CODE = "216933";
const TOKEN_NAMESPACE = "abcac-member-portal-preview-v1";

function configuredPreviewCode() {
  return process.env.MEMBER_PORTAL_PREVIEW_CODE?.trim() || DEFAULT_PREVIEW_CODE;
}

export function isValidPortalPreviewCode(code: string) {
  return code.trim() === configuredPreviewCode();
}

export async function createPortalPreviewToken() {
  const source = `${TOKEN_NAMESPACE}:${configuredPreviewCode()}`;
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isValidPortalPreviewToken(token: string | undefined) {
  if (!token) return false;
  return token === await createPortalPreviewToken();
}
