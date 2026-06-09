// ABCAC — document VISION parsing for the automation agent-eval step.
//
// This is the net-new Claude capability: read an uploaded CEU certificate /
// member document from Supabase Storage and return STRUCTURED FIELDS + a
// CONFIDENCE score that the agent pass (see dispatch.ts / types.ts) can fold
// into a tier decision.
//
// GRACEFUL DEGRADATION: like the conversational assistant, nothing here reads
// the API key at module load. When `ANTHROPIC_API_KEY` is unset we return a
// deterministic low-confidence "not_configured" result instead of throwing, so
// the build and the automation engine keep working with no env vars set. The
// model is ALSO never given a write path — it only emits fields/confidence that
// a deterministic caller acts on.

import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_MODEL, isAssistantConfigured, getAnthropicClient } from "../assistant/anthropic";

/** Bump this when the extraction prompt changes — it rides on `modelVersion`. */
export const VISION_PROMPT_VERSION = "vision-1";

/** Model id + prompt version, recorded on every result for auditability. */
export const VISION_MODEL_VERSION = `${ASSISTANT_MODEL}/${VISION_PROMPT_VERSION}`;

/** Storage buckets that may hold parseable documents. */
export type DocumentBucket = "member-documents" | "ceu-certificates";

/**
 * A field the model should extract. Description guides the model; `key` is the
 * property name returned under `fields`.
 */
export interface SchemaField {
  key: string;
  description: string;
}

export interface DocumentSchema {
  /** Short label, e.g. "CEU completion certificate". */
  label: string;
  fields: SchemaField[];
}

/** Structured output of a parse. `confidence` is 0..1, never out of range. */
export interface VisionResult {
  fields: Record<string, unknown>;
  confidence: number;
  anomalies: string[];
  modelVersion: string;
}

export interface ParseDocumentInput {
  bucket: DocumentBucket;
  path: string;
  schema: DocumentSchema;
}

export interface ParseCeuInput {
  bucket: DocumentBucket;
  path: string;
}

// --- Pure helpers (network-free, unit-tested) ---------------------------------

/**
 * The content-block source kind we send to Claude. PDFs go as a `document`
 * block; raster images as an `image` block. Returns `null` for unsupported
 * extensions so the caller can fail closed.
 */
export type MediaKind =
  | { block: "image"; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }
  | { block: "document"; mediaType: "application/pdf" };

/** Infer the Claude content block + media type from a file path's extension. */
export function inferMediaKind(path: string): MediaKind | null {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf":
      return { block: "document", mediaType: "application/pdf" };
    case "jpg":
    case "jpeg":
      return { block: "image", mediaType: "image/jpeg" };
    case "png":
      return { block: "image", mediaType: "image/png" };
    case "gif":
      return { block: "image", mediaType: "image/gif" };
    case "webp":
      return { block: "image", mediaType: "image/webp" };
    default:
      return null;
  }
}

/** A failed/empty parse, stamped with the current model version. */
export function parseErrorResult(reason = "parse_error"): VisionResult {
  return { fields: {}, confidence: 0, anomalies: [reason], modelVersion: VISION_MODEL_VERSION };
}

/** Clamp any value to a finite number in [0, 1]; non-numbers become 0. */
export function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Defensively pull the first balanced JSON object out of model text. Handles
 * ```json fences, leading/trailing prose, and braces inside strings. Returns
 * `null` when no parseable object is present.
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  if (typeof text !== "string" || text.length === 0) return null;

  // Walk to the first `{` and find its matching `}`, respecting string literals
  // and escapes so braces inside JSON strings don't end the scan early.
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          // keep scanning for a later balanced object
        }
        return null;
      }
    }
  }
  return null;
}

/**
 * Normalize a raw parsed model object into a VisionResult. Missing/invalid keys
 * degrade to safe defaults rather than throwing.
 */
export function normalizeVisionResult(raw: Record<string, unknown> | null): VisionResult {
  if (!raw) return parseErrorResult();
  const fields =
    raw.fields && typeof raw.fields === "object" && !Array.isArray(raw.fields)
      ? (raw.fields as Record<string, unknown>)
      : {};
  const anomalies = Array.isArray(raw.anomalies)
    ? raw.anomalies.filter((a): a is string => typeof a === "string")
    : [];
  return {
    fields,
    confidence: clampConfidence(raw.confidence),
    anomalies,
    modelVersion: VISION_MODEL_VERSION,
  };
}

/**
 * `true` when a `YYYY-MM-DD`-style completion date parses to a day strictly
 * after `now`. Unparseable / empty values are NOT future-dated (return false).
 */
export function isFutureDated(completionDate: unknown, now: Date = new Date()): boolean {
  if (typeof completionDate !== "string" || completionDate.trim() === "") return false;
  const ts = Date.parse(completionDate);
  if (Number.isNaN(ts)) return false;
  return ts > now.getTime();
}

/** Convert a Blob (from Storage `.download()`) to a base64 string. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return buffer.toString("base64");
}

/** Build the strict-JSON extraction prompt for a schema. */
export function buildPrompt(schema: DocumentSchema): string {
  const lines = schema.fields.map((f) => `  - "${f.key}": ${f.description}`);
  return [
    `You are extracting structured data from a ${schema.label}.`,
    "Read the attached document/image and extract the following fields:",
    ...lines,
    "",
    "Respond with STRICT JSON only — no prose, no markdown fences — of the shape:",
    '{ "fields": { ...the fields above... }, "confidence": <number 0..1>, "anomalies": [<string>, ...] }',
    "Use null for any field you cannot read. `confidence` is your overall",
    "confidence that the extracted fields are correct. List anything suspicious",
    "(illegible text, mismatched dates, altered-looking documents) in `anomalies`.",
  ].join("\n");
}

// --- CEU schema ---------------------------------------------------------------

export const CEU_SCHEMA: DocumentSchema = {
  label: "CEU completion certificate",
  fields: [
    { key: "provider", description: "The name of the CEU provider / issuing organization." },
    { key: "course_title", description: "The title of the course or activity completed." },
    { key: "hours", description: "Number of CEU hours/credits awarded, as a number." },
    { key: "completion_date", description: "Date the course was completed, as YYYY-MM-DD." },
    {
      key: "categories",
      description: "Array of CEU category names/codes the credit applies to, if shown.",
    },
  ],
};

// --- Network entry points -----------------------------------------------------

/**
 * Download the file, send it to Claude, and return structured fields + a
 * confidence score. Never throws: any error (download failure, unsupported
 * type, model/JSON failure, or unconfigured key) yields a low-confidence
 * result with an `anomalies` reason. Always stamps `modelVersion`.
 */
export async function parseDocument(
  admin: SupabaseClient,
  { bucket, path, schema }: ParseDocumentInput,
): Promise<VisionResult> {
  if (!isAssistantConfigured()) {
    return parseErrorResult("not_configured");
  }

  const media = inferMediaKind(path);
  if (!media) {
    return parseErrorResult("unsupported_media_type");
  }

  let base64: string;
  try {
    const { data, error } = await admin.storage.from(bucket).download(path);
    if (error || !data) {
      return parseErrorResult("download_error");
    }
    base64 = await blobToBase64(data as Blob);
  } catch {
    return parseErrorResult("download_error");
  }

  const prompt = buildPrompt(schema);

  // The document/image content block alongside the strict-JSON text prompt.
  const fileBlock =
    media.block === "document"
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: media.mediaType, data: base64 },
        }
      : {
          type: "image" as const,
          source: { type: "base64" as const, media_type: media.mediaType, data: base64 },
        };

  try {
    const client: Anthropic = getAnthropicClient();
    const response = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [fileBlock as any, { type: "text", text: prompt }],
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return normalizeVisionResult(extractJsonObject(text));
  } catch {
    return parseErrorResult("model_error");
  }
}

/**
 * Convenience wrapper that parses a CEU certificate against `CEU_SCHEMA` and
 * adds cheap, deterministic anomaly flags on top of the model's output
 * (currently `future_dated` when the completion date is in the future).
 */
export async function parseCeuCertificate(
  admin: SupabaseClient,
  { bucket, path }: ParseCeuInput,
): Promise<VisionResult> {
  const result = await parseDocument(admin, { bucket, path, schema: CEU_SCHEMA });

  const extra: string[] = [];
  if (isFutureDated(result.fields.completion_date)) {
    extra.push("future_dated");
  }

  if (extra.length === 0) return result;
  // De-dupe in case the model already flagged the same anomaly.
  const anomalies = Array.from(new Set([...result.anomalies, ...extra]));
  return { ...result, anomalies };
}
