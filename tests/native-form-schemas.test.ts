import { describe, expect, it } from "vitest";
import type { FormAnnotation } from "@/lib/digital-form-types";
import { FORM_LIBRARY } from "@/lib/form-library";
import {
  getNativeFormSchema,
  getNativeSignatureFields,
  listNativeFields,
  makeNativeAnnotation,
  missingRequiredNativeFields,
  tableFieldId,
} from "@/lib/native-form-schemas";

// Every form in the library now has a native schema.
const NATIVE_KEYS = FORM_LIBRARY.map((form) => form.key);

function annotationFor(formKey: string, fieldId: string, value: string): FormAnnotation {
  const schema = getNativeFormSchema(formKey)!;
  const field = listNativeFields(schema).find((candidate) => candidate.id === fieldId)!;
  return makeNativeAnnotation(schema, field, field.pdfPage, value, "applicant");
}

describe("native form schemas", () => {
  it("provides a schema for every converted form key, and each maps to a real library form", () => {
    for (const key of NATIVE_KEYS) {
      const schema = getNativeFormSchema(key);
      expect(schema, key).toBeDefined();
      expect(schema!.formKey).toBe(key);
      expect(FORM_LIBRARY.some((form) => form.key === key), key).toBe(true);
    }
  });

  it("covers the entire form library — no form is left on the PDF-overlay path", () => {
    for (const form of FORM_LIBRARY) {
      expect(getNativeFormSchema(form.key), form.key).toBeDefined();
    }
    expect(getNativeFormSchema("nonexistent-form")).toBeUndefined();
  });

  it("every schema has at least one applicant signature so packets can be signed", () => {
    for (const key of NATIVE_KEYS) {
      const signatures = getNativeSignatureFields(getNativeFormSchema(key)!);
      expect(signatures.length, key).toBeGreaterThanOrEqual(1);
    }
  });

  it("generates unique field ids within each schema", () => {
    for (const key of NATIVE_KEYS) {
      const fields = listNativeFields(getNativeFormSchema(key)!);
      const ids = fields.map((field) => field.id);
      expect(new Set(ids).size, key).toBe(ids.length);
      expect(fields.length, key).toBeGreaterThan(10);
    }
  });

  it("exposes signature fields for the signer-invite picker", () => {
    const recert = getNativeSignatureFields(getNativeFormSchema("recert-cac-cadac-aadc")!);
    expect(recert.length).toBeGreaterThanOrEqual(3);
    expect(recert.every((field) => field.type === "signature")).toBe(true);
    const supervisor = recert.find((field) => field.id === "supervisor-signature");
    expect(supervisor?.label).toContain("Supervisor");
    expect(supervisor?.page).toBe(5);
  });

  it("reports missing required fields but skips signer sections", () => {
    const schema = getNativeFormSchema("recert-cac-cadac-aadc")!;
    const missing = missingRequiredNativeFields(schema, []);
    expect(missing.length).toBeGreaterThan(0);
    // Supervisor attestation lives in a signer section — never required of the applicant.
    expect(missing).not.toContain("Signature of supervisor");
    const filled = listNativeFields(schema)
      .filter((field) => field.required)
      .map((field) => annotationFor(schema.formKey, field.id, field.type === "yesno" ? "No" : "value"));
    expect(missingRequiredNativeFields(schema, filled)).toEqual([]);
  });

  it("treats blank values as missing", () => {
    const schema = getNativeFormSchema("board-member")!;
    const annotations = [annotationFor("board-member", "full-name", "   ")];
    expect(missingRequiredNativeFields(schema, annotations)).toContain("Full name");
  });

  it("builds sanitizer-compatible annotations", () => {
    const annotation = annotationFor("recert-cac-cadac-aadc", "abcac-cert-number", "12345");
    expect(annotation.fieldId).toBe("abcac-cert-number");
    expect(annotation.page).toBeGreaterThanOrEqual(1);
    expect(annotation.x).toBeGreaterThanOrEqual(0);
    expect(annotation.type).toBe("text");
    expect(annotation.author).toBe("applicant");
    // yes/no and textarea fields normalize to the plain "text" annotation type.
    const yesNo = annotationFor("recert-cac-cadac-aadc", "background-convicted", "No");
    expect(yesNo.type).toBe("text");
  });

  it("generates stable table cell ids used by the CE ledger", () => {
    expect(tableFieldId("ce-ledger-table", 0, "hours")).toBe("ce-ledger-table-r1-hours");
    const fields = listNativeFields(getNativeFormSchema("recert-cac-cadac-aadc")!);
    expect(fields.some((field) => field.id === "ce-ledger-table-r1-course")).toBe(true);
    expect(fields.some((field) => field.id === "ce-ledger-table-r12-hours")).toBe(true);
    expect(fields.some((field) => field.id === "inservice-table-r8-hours")).toBe(true);
  });
});
