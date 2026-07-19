export const PORTAL_PREVIEW_COOKIE = "abcac_portal_preview";

const DEFAULT_PREVIEW_CODE = "216933";
const TOKEN_NAMESPACE = "abcac-member-portal-preview-v1";

function configuredPreviewCode() {
  return process.env.MEMBER_PORTAL_PREVIEW_CODE?.trim() || DEFAULT_PREVIEW_CODE;
}

/**
 * The preview gate is disabled (portal fully open) when the env var is set to
 * "off" — the launch switch. Flip MEMBER_PORTAL_PREVIEW_CODE=off in Vercel to
 * open member signup/portal access without a deploy.
 */
export function isPortalPreviewGateDisabled() {
  return configuredPreviewCode().toLowerCase() === "off";
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
