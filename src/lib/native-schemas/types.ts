import type { AnnotationType } from "@/lib/digital-form-types";

// Schema types for native (HTML) versions of ABCAC forms. Each schema
// reproduces the content of an original PDF as structured fields.

export type NativeFieldType = AnnotationType | "yesno" | "textarea";

export type NativeField = {
  id: string;
  label: string;
  type: NativeFieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Render width hint inside the section grid. */
  span?: "full" | "half" | "third";
  /** When set, the question shows a follow-up detail input if answered Yes. */
  detailLabel?: string;
};

export type NativeTable = {
  id: string;
  columns: Array<{ id: string; label: string; width?: "wide" | "narrow" }>;
  rows: number;
  /** Fixed labels for the first column of the first rows (e.g. Ethics). */
  fixedFirstColumn?: string[];
};

export type NativeSection = {
  id: string;
  title: string;
  description?: string;
  /** Bullet list rendered before the fields (requirements, instructions). */
  notes?: string[];
  /** Page of the original PDF this section came from (for admin reference). */
  pdfPage: number;
  fields?: NativeField[];
  table?: NativeTable;
  /** Section is expected to be completed by an invited signer, not the applicant. */
  signerSection?: { role: string };
};

export type NativeFormSchema = {
  formKey: string;
  intro?: { title: string; paragraphs: string[] };
  sections: NativeSection[];
};
