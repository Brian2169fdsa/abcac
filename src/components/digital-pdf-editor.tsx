"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, PenLine, Type, X } from "lucide-react";
import type { FormAnnotation, AnnotationType } from "@/lib/digital-form-types";
import type { FormDefinition } from "@/lib/form-library";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void };
  }>;
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
  readOnly = false,
}: {
  form: FormDefinition;
  annotations: FormAnnotation[];
  onChange: (annotations: FormAnnotation[]) => void;
  author?: "applicant" | "signer";
  signatureName: string;
  onSignatureNameChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [tool, setTool] = useState<AnnotationType>("text");
  const [loading, setLoading] = useState(true);
  const pageAnnotations = annotations.filter((annotation) => annotation.page === pageNumber);

  useEffect(() => {
    let active = true;
    let loaded: PdfDocument | null = null;
    setLoading(true);
    setPageNumber(1);
    import("pdfjs-dist").then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
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
    if (!pdfDocument || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;
    void pdfDocument.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: 1.45 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
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
    if (readOnly) return;
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

  return (
    <div>
      {!readOnly && <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-bg p-3">
        {tools.map((item) => {
          const Icon = item.icon;
          return <Button key={item.type} type="button" size="sm" variant={tool === item.type ? "primary" : "outline"} onClick={() => setTool(item.type)}><Icon className="h-4 w-4" aria-hidden />{item.label}</Button>;
        })}
        <label className="min-w-[220px] flex-1"><span className="mb-1 block text-xs font-semibold text-muted">Typed signature name</span><input value={signatureName} onChange={(event) => onSignatureNameChange(event.target.value)} className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm" placeholder="Full legal name" /></label>
      </div>}

      <div className="mb-3 flex items-center justify-between gap-3">
        <Button type="button" size="sm" variant="outline" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)}>Previous</Button>
        <div className="text-center"><p className="text-sm font-semibold">{form.shortTitle}</p><p className="text-xs text-muted">Page {pageNumber} of {pdfDocument?.numPages ?? form.pages}</p></div>
        <Button type="button" size="sm" variant="outline" disabled={pageNumber >= (pdfDocument?.numPages ?? form.pages)} onClick={() => setPageNumber((page) => page + 1)}>Next</Button>
      </div>

      <div className="overflow-auto rounded-xl border border-line bg-[#d7d9dc] p-3 sm:p-5">
        <div className="relative mx-auto w-fit max-w-full bg-white shadow-xl" onClick={addAnnotation}>
          <canvas ref={canvasRef} className={cn("block h-auto max-w-full", loading && "min-h-[560px] min-w-[420px] animate-pulse bg-line")} />
          <div className="absolute inset-0">
            {pageAnnotations.map((annotation) => (
              <div key={annotation.id} data-annotation className="group absolute min-w-[30px]" style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%`, transform: "translateY(-50%)" }}>
                {annotation.type === "check" ? (
                  <button type="button" disabled={readOnly} className="rounded bg-white/80 px-1 text-xl font-bold text-brand" onClick={() => removeAnnotation(annotation.id)}>✓</button>
                ) : (
                  <input
                    autoFocus={!annotation.value}
                    value={annotation.value}
                    disabled={readOnly}
                    onChange={(event) => updateAnnotation(annotation.id, event.target.value)}
                    className={cn("min-w-[130px] border-0 border-b border-dashed border-brand bg-white/80 px-1 py-0.5 text-sm text-ink outline-none", annotation.type === "signature" && "font-serif italic")}
                    aria-label={`${annotation.type} annotation`}
                  />
                )}
                {!readOnly && <button type="button" onClick={() => removeAnnotation(annotation.id)} className="absolute -right-2.5 -top-2.5 hidden h-5 w-5 items-center justify-center rounded-full bg-brand text-white group-hover:flex" aria-label="Remove field"><X className="h-3 w-3" /></button>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{readOnly ? "Read-only review of marks placed on the unchanged ABCAC form." : "Choose a tool, then click the exact blank or checkbox on the original form. Every mark is saved to your account and remains tied to this unchanged PDF page."}</p>
    </div>
  );
}
