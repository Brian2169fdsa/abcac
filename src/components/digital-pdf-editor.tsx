"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, PenLine, Type, X } from "lucide-react";
import type { FormAnnotation, AnnotationType, SmartFormField } from "@/lib/digital-form-types";
import type { FormDefinition } from "@/lib/form-library";
import { detectSmartFormFields } from "@/lib/pdf-smart-fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PdfPage = {
  getViewport: (options: { scale: number }) => {
    width: number;
    height: number;
    convertToViewportRectangle: (rectangle: [number, number, number, number]) => number[];
  };
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  getTextContent: () => Promise<{ items: Array<{ str?: string; width?: number; height?: number; transform?: number[] }> }>;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void };
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

const tools: Array<{ type: AnnotationType; label: string; icon: typeof Type }> = [
  { type: "text", label: "Type text", icon: Type },
  { type: "check", label: "Add check", icon: Check },
  { type: "date", label: "Add date", icon: CalendarDays },
  { type: "signature", label: "Add signature", icon: PenLine },
];

export function DigitalPdfEditor({
  form,
  annotations,
  onChange,
  author = "applicant",
  signatureName,
  onSignatureNameChange,
  onFieldsDetected,
  readOnly = false,
}: {
  form: FormDefinition;
  annotations: FormAnnotation[];
  onChange: (annotations: FormAnnotation[]) => void;
  author?: "applicant" | "signer";
  signatureName: string;
  onSignatureNameChange: (value: string) => void;
  onFieldsDetected?: (fields: SmartFormField[]) => void;
  readOnly?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFieldsDetectedRef = useRef(onFieldsDetected);
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null);
  const [constructPathOperator, setConstructPathOperator] = useState<number | null>(null);
  const [smartFields, setSmartFields] = useState<SmartFormField[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [tool, setTool] = useState<AnnotationType | null>(null);
  const [loading, setLoading] = useState(true);
  const pageAnnotations = annotations.filter((annotation) => annotation.page === pageNumber);
  const pageFields = smartFields.filter((field) => field.page === pageNumber);

  useEffect(() => {
    onFieldsDetectedRef.current = onFieldsDetected;
  }, [onFieldsDetected]);

  useEffect(() => {
    let active = true;
    let loaded: PdfDocument | null = null;
    setLoading(true);
    setPageNumber(1);
    import("pdfjs-dist").then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      setConstructPathOperator(pdfjs.OPS.constructPath);
      loaded = await pdfjs.getDocument(form.href).promise as unknown as PdfDocument;
      if (active) {
        setPdfDocument(loaded);
        setLoading(false);
      } else {
        await loaded.destroy();
      }
    }).catch(() => active && setLoading(false));
    return () => {
      active = false;
      if (loaded) void loaded.destroy();
    };
  }, [form.href]);

  useEffect(() => {
    if (!pdfDocument || constructPathOperator === null) return;
    let active = true;
    void Promise.all(Array.from({ length: pdfDocument.numPages }, async (_, index) => {
      const page = await pdfDocument.getPage(index + 1);
      const [operatorList, textContent] = await Promise.all([page.getOperatorList(), page.getTextContent()]);
      return detectSmartFormFields({
        pageNumber: index + 1,
        viewport: page.getViewport({ scale: 1 }),
        operatorFunctions: operatorList.fnArray,
        operatorArguments: operatorList.argsArray,
        constructPathOperator,
        textItems: textContent.items,
      });
    })).then((detected) => {
      if (!active) return;
      const fields = detected.flat();
      setSmartFields(fields);
      onFieldsDetectedRef.current?.(fields);
    }).catch(() => {
      if (active) setSmartFields([]);
    });
    return () => { active = false; };
  }, [constructPathOperator, pdfDocument]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;
    void pdfDocument.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return;
      // Render at device-pixel resolution but display at the base size so the
      // form text stays crisp instead of blurring when the canvas is downscaled.
      const outputScale = Math.min(3, Math.max(1.5, window.devicePixelRatio || 1) * 1.45);
      const baseViewport = page.getViewport({ scale: 1.45 });
      const viewport = page.getViewport({ scale: outputScale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${Math.round(baseViewport.width)}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      renderTask = page.render({ canvasContext: context, viewport });
      return renderTask.promise;
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdfDocument]);

  function addAnnotation(event: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || !tool) return;
    if ((event.target as HTMLElement).closest("[data-annotation]")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const value = tool === "check" ? "✓" : tool === "date" ? new Date().toLocaleDateString("en-US") : tool === "signature" ? signatureName.trim() : "";
    if (tool === "signature" && !value) return;
    onChange([...annotations, {
      id: crypto.randomUUID(),
      page: pageNumber,
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
      value,
      type: tool,
      author,
    }]);
  }

  function updateAnnotation(id: string, value: string) {
    onChange(annotations.map((annotation) => annotation.id === id ? { ...annotation, value } : annotation));
  }

  function removeAnnotation(id: string) {
    onChange(annotations.filter((annotation) => annotation.id !== id));
  }

  function setSmartFieldValue(field: SmartFormField, value: string) {
    const existing = annotations.find((annotation) => annotation.fieldId === field.id);
    if (existing) {
      updateAnnotation(existing.id, value);
      return;
    }
    onChange([...annotations, {
      id: crypto.randomUUID(),
      fieldId: field.id,
      page: field.page,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      label: field.label,
      value,
      type: field.type,
      author,
    }]);
  }

  return (
    <div>
      {!readOnly && <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-bg p-3">
        {tools.map((item) => {
          const Icon = item.icon;
          return <Button key={item.type} type="button" size="sm" variant={tool === item.type ? "primary" : "outline"} aria-pressed={tool === item.type} onClick={() => setTool((current) => current === item.type ? null : item.type)}><Icon className="h-4 w-4" aria-hidden />{item.label}</Button>;
        })}
        <p className="w-full text-xs text-muted">{tool ? `${tools.find((item) => item.type === tool)?.label} selected. Click a blank area on the form to place it.` : "No add tool selected. Choose a tool only when the original form does not already provide a field."}</p>
        <label className="min-w-[220px] flex-1"><span className="mb-1 block text-xs font-semibold text-muted">Typed signature name</span><input value={signatureName} onChange={(event) => onSignatureNameChange(event.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" placeholder="Full legal name" /></label>
      </div>}

      <div className="mb-3 flex items-center justify-between gap-3">
        <Button type="button" size="sm" variant="outline" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)}>Previous</Button>
        <div className="text-center"><p className="text-sm font-semibold">{form.shortTitle}</p><p className="text-xs text-muted">Page {pageNumber} of {pdfDocument?.numPages ?? form.pages}</p></div>
        <Button type="button" size="sm" variant="outline" disabled={pageNumber >= (pdfDocument?.numPages ?? form.pages)} onClick={() => setPageNumber((page) => page + 1)}>Next</Button>
      </div>

      <div className="overflow-auto rounded-xl border border-line bg-[#d7d9dc] p-3 sm:p-5">
        <div className={cn("relative mx-auto w-fit max-w-full bg-white shadow-xl", tool && !readOnly && "cursor-crosshair")} onClick={addAnnotation}>
          <canvas ref={canvasRef} className={cn("block h-auto max-w-full", loading && "min-h-[560px] min-w-[420px] animate-pulse bg-line")} />
          <div className="pointer-events-none absolute inset-0">
            {pageFields.map((field) => {
              const annotation = pageAnnotations.find((item) => item.fieldId === field.id);
              const style = { left: `${field.x * 100}%`, top: `${field.y * 100}%`, width: `${field.width * 100}%`, height: `${field.height * 100}%` };
              if (field.type === "check") {
                return <button key={field.id} type="button" data-annotation disabled={readOnly} aria-label={field.label} aria-pressed={Boolean(annotation?.value)} onClick={() => setSmartFieldValue(field, annotation?.value ? "" : "✓")} className="pointer-events-auto absolute flex items-center justify-center border border-info/40 bg-transparent text-sm font-bold text-brand transition hover:border-info hover:shadow-[0_0_0_2px_rgba(59,130,246,0.25)]" style={style}>{annotation?.value ? "✓" : ""}</button>;
              }
              return <input
                key={field.id}
                data-annotation
                value={annotation?.value ?? ""}
                disabled={readOnly}
                onChange={(event) => {
                  setSmartFieldValue(field, event.target.value);
                  if (field.type === "signature" && event.target.value && !signatureName) onSignatureNameChange(event.target.value);
                }}
                className={cn("pointer-events-auto absolute border-0 border-b-2 border-info/50 bg-transparent px-1 text-[clamp(8px,1.15vw,14px)] font-semibold text-blue-900 outline-none transition hover:border-info focus:border-info focus:shadow-[0_0_0_2px_rgba(59,130,246,0.25)]", field.type === "signature" && "font-serif italic")}
                style={style}
                placeholder={field.type === "signature" ? "Signature" : ""}
                aria-label={field.label}
              />;
            })}
            {pageAnnotations.filter((annotation) => !annotation.fieldId).map((annotation) => (
              <div key={annotation.id} data-annotation className="group absolute min-w-[30px]" style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%`, transform: "translateY(-50%)" }}>
                {annotation.type === "check" ? (
                  <button type="button" disabled={readOnly} className="pointer-events-auto rounded bg-white/80 px-1 text-xl font-bold text-brand" onClick={() => removeAnnotation(annotation.id)}>✓</button>
                ) : (
                  <input
                    autoFocus={!annotation.value}
                    value={annotation.value}
                    disabled={readOnly}
                    onChange={(event) => updateAnnotation(annotation.id, event.target.value)}
                    className={cn("pointer-events-auto min-w-[130px] border-0 border-b border-dashed border-brand bg-white/80 px-1 py-0.5 text-sm text-ink outline-none", annotation.type === "signature" && "font-serif italic")}
                    aria-label={`${annotation.type} annotation`}
                  />
                )}
                {!readOnly && <button type="button" onClick={() => removeAnnotation(annotation.id)} className="pointer-events-auto absolute -right-2.5 -top-2.5 hidden h-5 w-5 items-center justify-center rounded-full bg-brand text-white group-hover:flex" aria-label="Remove field"><X className="h-3 w-3" /></button>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{readOnly ? "Read-only review of marks placed on the unchanged ABCAC form." : "Printed blanks, checkboxes, dates, and signature lines are directly fillable. Use the tools above only when you need to add something the original form did not provide."}</p>
    </div>
  );
}
