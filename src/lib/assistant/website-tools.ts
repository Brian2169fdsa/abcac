import type { AssistantTool, ToolExecutor } from "./run";
import { getProducts, formatPrice } from "@/lib/catalog";

/**
 * WEBSITE (Level 1, public) tool definitions + executors.
 *
 * SECURITY: these tools are for the UNAUTHENTICATED public assistant. They are
 * strictly READ-ONLY and source ONLY public, non-personal data:
 *   - lookup_fees / list_certifications → the public product catalog
 *     (src/data/products.json via @/lib/catalog).
 *   - suggest_page → a hard-coded allowlist of known PUBLIC routes.
 *
 * There is NO Supabase client here, NO member_id is ever accepted, and nothing
 * reads or exposes any member's account. This is the entire trust boundary for
 * the public surface: it cannot reach personal data because it has no client to
 * do so.
 */

/** Allowlist of known public routes the assistant may point visitors to. */
const PUBLIC_PAGES: Array<{ path: string; title: string; about: string }> = [
  { path: "/", title: "Home", about: "ABCAC overview and main services." },
  { path: "/initial-certification", title: "Initial Certification", about: "How to apply for your first ABCAC credential." },
  { path: "/certification-renewal", title: "Certification Renewal", about: "Renewing your credential every two years with CEUs." },
  { path: "/ceu", title: "CEU & Endorsement", about: "Continuing education and provider/workshop endorsement." },
  { path: "/testing", title: "Testing", about: "Registering for the IC&RC / AZBBHE exam." },
  { path: "/remote-or-inperson", title: "Remote or In-Person Exam", about: "Comparing remote-proctored vs. in-person exam delivery." },
  { path: "/ic-rc", title: "About IC&RC", about: "ABCAC's relationship with IC&RC." },
  { path: "/reciprocity", title: "Reciprocity", about: "Transferring a credential into or out of Arizona." },
  { path: "/store", title: "Store", about: "All certification, exam, and CEU payments." },
  { path: "/faq", title: "FAQ", about: "Answers to common certification questions." },
  { path: "/contact", title: "Contact", about: "Reach the ABCAC office (phone/email)." },
  { path: "/verify", title: "Verify a Credential", about: "Public credential verification request." },
  { path: "/signup", title: "Sign Up", about: "Create an account to start an application or manage a credential." },
];

export function getWebsiteTools(): AssistantTool[] {
  return [
    {
      name: "list_certifications",
      description:
        "List the public certification, renewal, exam, and CEU products ABCAC offers, with their current fees. Use this to describe what certifications/services exist and what they cost. Read-only, public catalog data — no personal information.",
      input_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Optional category filter, e.g. 'Certification', 'Renewal', 'Testing', 'CEU Endorsement', 'Provider Fee', 'Service'.",
          },
        },
      },
    },
    {
      name: "lookup_fees",
      description:
        "Look up the current fee(s) for a certification, exam, renewal, or service by a search term (e.g. 'initial certification', 'renewal', 'sync', 'remote exam'). Returns matching public catalog items with prices. Never quote a fee that this tool does not return.",
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term to match against product names/categories, e.g. 'renewal' or 'remote exam'.",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "suggest_page",
      description:
        "Get the canonical public page to send a visitor to for a topic (e.g. 'apply', 'renew', 'fees', 'exam', 'reciprocity', 'ceu', 'contact', 'sign up'). Returns one or more known public routes with a short description. Use this to guide visitors rather than guessing URLs.",
      input_schema: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "What the visitor wants to do or learn about.",
          },
        },
        required: ["topic"],
      },
    },
  ];
}

function describeProduct(p: ReturnType<typeof getProducts>[number]): string {
  return `${p.name} — ${formatPrice(p)} (${p.category}${p.examMode ? `, ${p.examMode}` : ""}): ${p.short}`;
}

export function getWebsiteExecutors(): Record<string, ToolExecutor> {
  return {
    list_certifications: async (input) => {
      const category = typeof input.category === "string" ? input.category.toLowerCase() : "";
      const products = getProducts().filter(
        (p) => !category || p.category.toLowerCase().includes(category),
      );
      if (products.length === 0) {
        return "No matching catalog items. Suggest the visitor browse the Store (/store) or contact the office.";
      }
      return products.map(describeProduct).join("\n");
    },

    lookup_fees: async (input) => {
      const q = (typeof input.query === "string" ? input.query : "").toLowerCase().trim();
      if (!q) return "Provide a search term, or list all items via list_certifications.";
      const tokens = q.split(/\s+/).filter(Boolean);
      const matches = getProducts().filter((p) => {
        const hay = `${p.name} ${p.category} ${p.examMode ?? ""} ${p.short}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
      if (matches.length === 0) {
        return `No catalog item matched "${q}". Do not guess a fee — point the visitor to the Store (/store) or Contact page (/contact).`;
      }
      return matches.map(describeProduct).join("\n");
    },

    suggest_page: async (input) => {
      const topic = (typeof input.topic === "string" ? input.topic : "").toLowerCase().trim();
      if (!topic) {
        return PUBLIC_PAGES.map((p) => `${p.path} — ${p.title}: ${p.about}`).join("\n");
      }
      const tokens = topic.split(/\s+/).filter(Boolean);
      const scored = PUBLIC_PAGES.map((p) => {
        const hay = `${p.path} ${p.title} ${p.about}`.toLowerCase();
        const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        return { p, score };
      })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      const picks = (scored.length > 0 ? scored.map((x) => x.p) : PUBLIC_PAGES).slice(0, 4);
      return picks.map((p) => `${p.path} — ${p.title}: ${p.about}`).join("\n");
    },
  };
}
