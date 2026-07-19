"use client";

import type { FormAnnotation } from "@/lib/digital-form-types";
import type { NativeField, NativeFormSchema, NativeSection } from "@/lib/native-form-schemas";
import { makeNativeAnnotation, tableFieldId } from "@/lib/native-form-schemas";
import { cn } from "@/lib/utils";

// Renders an ABCAC form as a real HTML form from its native schema. Values are
// read from / written to the same FormAnnotation[] the PDF editor uses, keyed
// by fieldId, so drafts, signer requests, and admin review stay unchanged.

const inputCls = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-70 sm:text-sm";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

const spanCls: Record<NonNullable<NativeField["span"]>, string> = {
  full: "sm:col-span-6",
  half: "sm:col-span-3",
  third: "sm:col-span-2",
};

export function NativeFormEditor({
  schema,
  annotations,
  onChange,
  author = "applicant",
  signatureName,
  onSignatureNameChange,
  readOnly = false,
}: {
  schema: NativeFormSchema;
  annotations: FormAnnotation[];
  onChange: (annotations: FormAnnotation[]) => void;
  author?: "applicant" | "signer";
  signatureName: string;
  onSignatureNameChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const valueOf = (fieldId: string) => annotations.find((annotation) => annotation.fieldId === fieldId)?.value ?? "";

  function setValue(field: Pick<NativeField, "id" | "label" | "type">, pdfPage: number, value: string) {
    const existing = annotations.find((annotation) => annotation.fieldId === field.id);
    if (existing) {
      onChange(annotations.map((annotation) => annotation.fieldId === field.id ? { ...annotation, value } : annotation));
    } else {
      onChange([...annotations, makeNativeAnnotation(schema, field, pdfPage, value, author)]);
    }
    if (field.type === "signature" && value && !signatureName) onSignatureNameChange(value);
  }

  function renderField(field: NativeField, section: NativeSection) {
    const value = valueOf(field.id);
    const disabled = readOnly;
    const requiredMark = field.required ? <span aria-hidden className="text-brand"> *</span> : null;

    if (field.type === "check") {
      return (
        <label key={field.id} className={cn("flex items-start gap-3 rounded-lg border border-line bg-bg p-3 text-sm", spanCls[field.span ?? "full"], !disabled && "cursor-pointer hover:border-brand/40")}>
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
            checked={value === "✓"}
            disabled={disabled}
            onChange={(event) => setValue(field, section.pdfPage, event.target.checked ? "✓" : "")}
          />
          <span>{field.label}{requiredMark}</span>
        </label>
      );
    }

    if (field.type === "yesno") {
      return (
        <div key={field.id} className={cn("rounded-lg border border-line bg-bg p-3", spanCls[field.span ?? "full"])}>
          <p className="text-sm text-ink">{field.label}{requiredMark}</p>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label={field.label}>
            {["Yes", "No"].map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={value === option || (option === "No" && value.startsWith("No"))}
                disabled={disabled}
                onClick={() => setValue(field, section.pdfPage, option)}
                className={cn(
                  "rounded-full border px-5 py-1.5 text-sm font-semibold transition",
                  (value === option || (option === "No" && value.startsWith("No —")))
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-muted hover:border-brand/40 hover:text-ink",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          {field.detailLabel && value.startsWith("No") && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-muted">{field.detailLabel}</span>
              <input
                className={inputCls}
                disabled={disabled}
                value={value.startsWith("No — ") ? value.slice(5) : ""}
                onChange={(event) => setValue(field, section.pdfPage, event.target.value ? `No — ${event.target.value}` : "No")}
              />
            </label>
          )}
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <label key={field.id} className={cn("block", spanCls[field.span ?? "full"])}>
          <span className={labelCls}>{field.label}{requiredMark}</span>
          {field.hint && <span className="mb-1.5 block text-xs leading-relaxed text-muted">{field.hint}</span>}
          <textarea
            rows={4}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-70 sm:text-sm"
            value={value}
            disabled={disabled}
            placeholder={field.placeholder}
            onChange={(event) => setValue(field, section.pdfPage, event.target.value)}
          />
        </label>
      );
    }

    if (field.type === "signature") {
      return (
        <label key={field.id} className={cn("block", spanCls[field.span ?? "full"])}>
          <span className={labelCls}>{field.label}{requiredMark}</span>
          {field.hint && <span className="mb-1.5 block text-xs leading-relaxed text-muted">{field.hint}</span>}
          <input
            className={cn(inputCls, "border-b-2 border-b-brand/60 font-serif text-lg italic")}
            value={value}
            disabled={disabled}
            placeholder="Type your full legal name to sign"
            onChange={(event) => setValue(field, section.pdfPage, event.target.value)}
          />
        </label>
      );
    }

    return (
      <label key={field.id} className={cn("block", spanCls[field.span ?? "full"])}>
        <span className={labelCls}>{field.label}{requiredMark}</span>
        {field.hint && <span className="mb-1.5 block text-xs leading-relaxed text-muted">{field.hint}</span>}
        <input
          type={field.type === "date" ? "date" : "text"}
          className={inputCls}
          value={value}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(event) => setValue(field, section.pdfPage, event.target.value)}
        />
      </label>
    );
  }

  function renderTable(section: NativeSection) {
    const table = section.table!;
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5">
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column.id} className={cn("pb-1 text-left text-xs font-semibold uppercase tracking-wide text-muted", column.width === "narrow" ? "w-24" : "")}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: table.rows }, (_, row) => (
              <tr key={row}>
                {table.columns.map((column, columnIndex) => {
                  const id = tableFieldId(table.id, row, column.id);
                  const fixed = columnIndex === 0 ? table.fixedFirstColumn?.[row] : undefined;
                  const cellField = { id, label: `${column.label} (row ${row + 1})`, type: "text" as const };
                  return (
                    <td key={column.id} className="pr-2 last:pr-0">
                      {fixed ? (
                        <div className="flex h-10 items-center rounded-lg border border-brand/20 bg-brand/[0.05] px-3 text-sm font-semibold text-ink">{fixed} <span className="ml-1 text-xs font-normal text-brand">(required)</span></div>
                      ) : (
                        <input
                          className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-70"
                          aria-label={`${column.label}, row ${row + 1}`}
                          value={valueOf(id)}
                          disabled={readOnly}
                          onChange={(event) => setValue(cellField, section.pdfPage, event.target.value)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {schema.intro && (
        <div className="rounded-xl border border-brand/15 bg-brand/[0.04] p-5">
          <h3 className="text-lg font-bold text-ink">{schema.intro.title}</h3>
          {schema.intro.paragraphs.map((paragraph, index) => (
            <p key={index} className="mt-2 text-sm leading-relaxed text-muted">{paragraph}</p>
          ))}
        </div>
      )}
      {schema.sections.map((section) => (
        <section key={section.id} aria-label={section.title} className={cn("rounded-xl border p-5", section.signerSection ? "border-info/30 bg-info/[0.04]" : "border-line bg-surface")}>
          <div className="mb-4 border-b border-line pb-3">
            <h3 className="text-base font-bold uppercase tracking-wide text-ink">{section.title}</h3>
            {section.signerSection && (
              <p className="mt-1 inline-flex rounded-full bg-info/15 px-3 py-1 text-xs font-semibold text-info">
                Typically completed by your {section.signerSection.role.toLowerCase()} — you can fill it yourself or invite them to sign below.
              </p>
            )}
            {section.description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{section.description}</p>}
            {section.notes && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {section.notes.map((note, index) => <li key={index}>{note}</li>)}
              </ul>
            )}
          </div>
          {section.fields && section.fields.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-6">
              {section.fields.map((field) => renderField(field, section))}
            </div>
          )}
          {section.table && <div className={cn(section.fields?.length && "mt-4")}>{renderTable(section)}</div>}
        </section>
      ))}
    </div>
  );
}
