import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the document VISION parsing module (src/lib/automation/vision.ts).
 *
 * The network is fully mocked: `@anthropic-ai/sdk` is replaced with a fake whose
 * `messages.create` delegates to a queueable mock, and the Supabase admin client
 * is a stub whose `storage.from().download()` returns a canned Blob. No real
 * HTTP or Storage calls happen. The pure helpers (media-type inference, JSON
 * extraction, confidence clamping, future-date detection) are tested directly.
 */

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { create };
  }
  return { default: Anthropic };
});

import {
  inferMediaKind,
  extractJsonObject,
  clampConfidence,
  isFutureDated,
  normalizeVisionResult,
  blobToBase64,
  buildPrompt,
  parseErrorResult,
  parseDocument,
  parseCeuCertificate,
  CEU_SCHEMA,
  VISION_MODEL_VERSION,
  type DocumentSchema,
} from "@/lib/automation/vision";

// --- Fake Supabase admin client ----------------------------------------------

function fakeBlob(bytes: string): Blob {
  // Node 18+ exposes Blob globally; arrayBuffer() yields the underlying bytes.
  return new Blob([bytes], { type: "application/octet-stream" });
}

function fakeAdmin(opts: {
  blob?: Blob | null;
  error?: unknown;
  download?: ReturnType<typeof vi.fn>;
}) {
  const download =
    opts.download ??
    vi.fn().mockResolvedValue({ data: opts.blob ?? null, error: opts.error ?? null });
  const from = vi.fn().mockReturnValue({ download });
  // Only `.storage.from(bucket).download(path)` is exercised.
  return { admin: { storage: { from } } as never, download, from };
}

/** Build a fake Anthropic message response with a single text block. */
function textMsg(text: string) {
  return { stop_reason: "end_turn", content: [{ type: "text", text }] };
}

beforeEach(() => {
  create.mockReset();
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Pure helpers -------------------------------------------------------------

describe("inferMediaKind", () => {
  it("maps PDFs to a document block", () => {
    expect(inferMediaKind("certs/foo.pdf")).toEqual({
      block: "document",
      mediaType: "application/pdf",
    });
  });

  it("maps jpg/jpeg/png/gif/webp to image blocks", () => {
    expect(inferMediaKind("a.jpg")?.mediaType).toBe("image/jpeg");
    expect(inferMediaKind("a.jpeg")?.mediaType).toBe("image/jpeg");
    expect(inferMediaKind("a.png")?.mediaType).toBe("image/png");
    expect(inferMediaKind("a.gif")?.mediaType).toBe("image/gif");
    expect(inferMediaKind("a.webp")?.mediaType).toBe("image/webp");
    expect(inferMediaKind("a.png")?.block).toBe("image");
  });

  it("is case-insensitive on the extension", () => {
    expect(inferMediaKind("SCAN.PDF")?.block).toBe("document");
    expect(inferMediaKind("Photo.JPG")?.mediaType).toBe("image/jpeg");
  });

  it("returns null for unsupported / missing extensions", () => {
    expect(inferMediaKind("notes.txt")).toBeNull();
    expect(inferMediaKind("noext")).toBeNull();
    expect(inferMediaKind("")).toBeNull();
  });
});

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json fences and surrounding prose", () => {
    const text = 'Here you go:\n```json\n{"fields":{"x":2},"confidence":0.5}\n```\nthanks';
    expect(extractJsonObject(text)).toEqual({ fields: { x: 2 }, confidence: 0.5 });
  });

  it("handles braces inside string values without ending early", () => {
    const text = '{"note":"a } brace { in a string","ok":true}';
    expect(extractJsonObject(text)).toEqual({ note: "a } brace { in a string", ok: true });
  });

  it("handles nested objects", () => {
    expect(extractJsonObject('prefix {"a":{"b":{"c":1}}} suffix')).toEqual({
      a: { b: { c: 1 } },
    });
  });

  it("returns null when there is no object", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
    expect(extractJsonObject("[1,2,3]")).toBeNull(); // array, not an object
  });

  it("returns null on a malformed object", () => {
    expect(extractJsonObject('{"a": }')).toBeNull();
  });
});

describe("clampConfidence", () => {
  it("passes through in-range numbers", () => {
    expect(clampConfidence(0)).toBe(0);
    expect(clampConfidence(0.42)).toBe(0.42);
    expect(clampConfidence(1)).toBe(1);
  });

  it("clamps out-of-range numbers", () => {
    expect(clampConfidence(-3)).toBe(0);
    expect(clampConfidence(5)).toBe(1);
  });

  it("coerces numeric strings and rejects junk", () => {
    expect(clampConfidence("0.7")).toBe(0.7);
    expect(clampConfidence("not a number")).toBe(0);
    expect(clampConfidence(NaN)).toBe(0);
    expect(clampConfidence(Infinity)).toBe(0);
    expect(clampConfidence(null)).toBe(0);
    expect(clampConfidence(undefined)).toBe(0);
  });
});

describe("isFutureDated", () => {
  it("flags dates strictly after now", () => {
    const now = new Date("2026-06-09T00:00:00Z");
    expect(isFutureDated("2026-06-10", now)).toBe(true);
    expect(isFutureDated("2030-01-01", now)).toBe(true);
  });

  it("does not flag past or same-instant dates", () => {
    const now = new Date("2026-06-09T12:00:00Z");
    expect(isFutureDated("2020-01-01", now)).toBe(false);
    expect(isFutureDated("2026-06-09T12:00:00Z", now)).toBe(false);
  });

  it("treats empty / unparseable / non-string values as not future-dated", () => {
    const now = new Date("2026-06-09T00:00:00Z");
    expect(isFutureDated("", now)).toBe(false);
    expect(isFutureDated("   ", now)).toBe(false);
    expect(isFutureDated("not-a-date", now)).toBe(false);
    expect(isFutureDated(null, now)).toBe(false);
    expect(isFutureDated(12345, now)).toBe(false);
  });
});

describe("normalizeVisionResult", () => {
  it("normalizes a full object and stamps the model version", () => {
    const r = normalizeVisionResult({
      fields: { provider: "X" },
      confidence: 0.8,
      anomalies: ["a", 1, "b"], // non-strings dropped
    });
    expect(r.fields).toEqual({ provider: "X" });
    expect(r.confidence).toBe(0.8);
    expect(r.anomalies).toEqual(["a", "b"]);
    expect(r.modelVersion).toBe(VISION_MODEL_VERSION);
  });

  it("degrades missing/invalid keys to safe defaults", () => {
    const r = normalizeVisionResult({});
    expect(r.fields).toEqual({});
    expect(r.confidence).toBe(0);
    expect(r.anomalies).toEqual([]);
  });

  it("returns a parse_error result for null", () => {
    expect(normalizeVisionResult(null)).toEqual(parseErrorResult());
  });

  it("ignores a non-object / array fields value", () => {
    expect(normalizeVisionResult({ fields: [1, 2] }).fields).toEqual({});
  });
});

describe("blobToBase64", () => {
  it("round-trips bytes to base64", async () => {
    const b64 = await blobToBase64(fakeBlob("hello"));
    expect(b64).toBe(Buffer.from("hello").toString("base64"));
  });
});

describe("buildPrompt", () => {
  it("includes the label, each field key, and the strict-JSON instruction", () => {
    const schema: DocumentSchema = {
      label: "test doc",
      fields: [{ key: "alpha", description: "the alpha field" }],
    };
    const p = buildPrompt(schema);
    expect(p).toContain("test doc");
    expect(p).toContain('"alpha"');
    expect(p).toContain("the alpha field");
    expect(p).toMatch(/STRICT JSON/);
  });
});

// --- parseDocument (network mocked) ------------------------------------------

describe("parseDocument", () => {
  const okInput = { bucket: "ceu-certificates" as const, path: "a.pdf", schema: CEU_SCHEMA };

  it("returns not_configured (no throw) when the API key is absent", async () => {
    const { admin, download } = fakeAdmin({ blob: fakeBlob("x") });
    const r = await parseDocument(admin, okInput);
    expect(r).toEqual({
      fields: {},
      confidence: 0,
      anomalies: ["not_configured"],
      modelVersion: VISION_MODEL_VERSION,
    });
    // Fails fast — never downloads or calls the model.
    expect(download).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("returns unsupported_media_type for a non-image/pdf path", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { admin, download } = fakeAdmin({ blob: fakeBlob("x") });
    const r = await parseDocument(admin, { ...okInput, path: "notes.txt" });
    expect(r.anomalies).toEqual(["unsupported_media_type"]);
    expect(r.confidence).toBe(0);
    expect(download).not.toHaveBeenCalled();
  });

  it("downloads, parses the model's JSON, and returns structured fields", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { admin, from, download } = fakeAdmin({ blob: fakeBlob("PDFBYTES") });
    create.mockResolvedValueOnce(
      textMsg(
        '```json\n{"fields":{"provider":"ABC","hours":2},"confidence":0.9,"anomalies":[]}\n```',
      ),
    );

    const r = await parseDocument(admin, okInput);

    expect(from).toHaveBeenCalledWith("ceu-certificates");
    expect(download).toHaveBeenCalledWith("a.pdf");
    expect(r.fields).toEqual({ provider: "ABC", hours: 2 });
    expect(r.confidence).toBe(0.9);
    expect(r.anomalies).toEqual([]);
    expect(r.modelVersion).toBe(VISION_MODEL_VERSION);

    // PDF was sent as a base64 `document` block alongside the text prompt.
    const sent = create.mock.calls[0][0];
    expect(sent.model).toBeTruthy();
    const content = sent.messages[0].content as Array<Record<string, unknown>>;
    const fileBlock = content[0] as { type: string; source: { type: string; media_type: string; data: string } };
    expect(fileBlock.type).toBe("document");
    expect(fileBlock.source.media_type).toBe("application/pdf");
    expect(fileBlock.source.data).toBe(Buffer.from("PDFBYTES").toString("base64"));
    expect(content[1]).toMatchObject({ type: "text" });
  });

  it("sends a JPG as an image block", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { admin } = fakeAdmin({ blob: fakeBlob("IMG") });
    create.mockResolvedValueOnce(textMsg('{"fields":{},"confidence":0.1,"anomalies":[]}'));

    await parseDocument(admin, { ...okInput, path: "scan.jpg" });

    const content = create.mock.calls[0][0].messages[0].content as Array<Record<string, unknown>>;
    const fileBlock = content[0] as { type: string; source: { media_type: string } };
    expect(fileBlock.type).toBe("image");
    expect(fileBlock.source.media_type).toBe("image/jpeg");
  });

  it("returns download_error when storage returns an error", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { admin } = fakeAdmin({ blob: null, error: { message: "not found" } });
    const r = await parseDocument(admin, okInput);
    expect(r.anomalies).toEqual(["download_error"]);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns download_error when the download throws", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const download = vi.fn().mockRejectedValue(new Error("network"));
    const { admin } = fakeAdmin({ download });
    const r = await parseDocument(admin, okInput);
    expect(r.anomalies).toEqual(["download_error"]);
  });

  it("returns model_error when the model call throws", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { admin } = fakeAdmin({ blob: fakeBlob("x") });
    create.mockRejectedValueOnce(new Error("500"));
    const r = await parseDocument(admin, okInput);
    expect(r.anomalies).toEqual(["model_error"]);
    expect(r.confidence).toBe(0);
  });

  it("returns parse_error when the model emits unparseable text", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { admin } = fakeAdmin({ blob: fakeBlob("x") });
    create.mockResolvedValueOnce(textMsg("I could not read the document."));
    const r = await parseDocument(admin, okInput);
    expect(r.anomalies).toEqual(["parse_error"]);
    expect(r.confidence).toBe(0);
  });

  it("clamps an out-of-range confidence from the model", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const { admin } = fakeAdmin({ blob: fakeBlob("x") });
    create.mockResolvedValueOnce(textMsg('{"fields":{},"confidence":1.7,"anomalies":[]}'));
    const r = await parseDocument(admin, okInput);
    expect(r.confidence).toBe(1);
  });
});

// --- parseCeuCertificate (deterministic anomaly flags) -----------------------

describe("parseCeuCertificate", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
  });

  it("adds future_dated when the completion date is in the future", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T00:00:00Z"));

    const { admin } = fakeAdmin({ blob: fakeBlob("x") });
    create.mockResolvedValueOnce(
      textMsg(
        '{"fields":{"completion_date":"2030-01-01"},"confidence":0.8,"anomalies":[]}',
      ),
    );

    const r = await parseCeuCertificate(admin, { bucket: "ceu-certificates", path: "c.pdf" });
    expect(r.anomalies).toContain("future_dated");
    expect(r.confidence).toBe(0.8);
  });

  it("does not add future_dated for a past completion date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T00:00:00Z"));

    const { admin } = fakeAdmin({ blob: fakeBlob("x") });
    create.mockResolvedValueOnce(
      textMsg('{"fields":{"completion_date":"2025-01-01"},"confidence":0.7,"anomalies":[]}'),
    );

    const r = await parseCeuCertificate(admin, { bucket: "ceu-certificates", path: "c.pdf" });
    expect(r.anomalies).not.toContain("future_dated");
  });

  it("de-dupes future_dated if the model already flagged it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T00:00:00Z"));

    const { admin } = fakeAdmin({ blob: fakeBlob("x") });
    create.mockResolvedValueOnce(
      textMsg(
        '{"fields":{"completion_date":"2030-01-01"},"confidence":0.6,"anomalies":["future_dated"]}',
      ),
    );

    const r = await parseCeuCertificate(admin, { bucket: "ceu-certificates", path: "c.pdf" });
    expect(r.anomalies.filter((a) => a === "future_dated")).toHaveLength(1);
  });

  it("passes through not_configured without adding flags", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { admin } = fakeAdmin({ blob: fakeBlob("x") });
    const r = await parseCeuCertificate(admin, { bucket: "ceu-certificates", path: "c.pdf" });
    expect(r.anomalies).toEqual(["not_configured"]);
  });
});
