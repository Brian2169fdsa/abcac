import type { AnnotationType, SmartFormField } from "@/lib/digital-form-types";

type Viewport = {
  width: number;
  height: number;
  convertToViewportRectangle: (rectangle: [number, number, number, number]) => number[];
};

type TextItem = {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
};

type Candidate = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "line" | "box";
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function overlaps(first: Candidate, second: Candidate) {
  const horizontal = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const vertical = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  return horizontal * vertical > Math.min(first.width * first.height, second.width * second.height) * 0.55;
}

function inferType(label: string, kind: Candidate["kind"]): AnnotationType {
  if (kind === "box") return "check";
  if (/signature|signed by|applicant sign/i.test(label)) return "signature";
  if (/\bdate\b|birth date|dob/i.test(label)) return "date";
  return "text";
}

function normalizedRectangle(viewport: Viewport, rectangle: [number, number, number, number]) {
  const converted = viewport.convertToViewportRectangle(rectangle);
  const left = Math.min(converted[0], converted[2]);
  const top = Math.min(converted[1], converted[3]);
  const right = Math.max(converted[0], converted[2]);
  const bottom = Math.max(converted[1], converted[3]);
  return { x: left / viewport.width, y: top / viewport.height, width: (right - left) / viewport.width, height: (bottom - top) / viewport.height };
}

export function detectSmartFormFields({
  pageNumber,
  viewport,
  operatorFunctions,
  operatorArguments,
  constructPathOperator,
  textItems,
}: {
  pageNumber: number;
  viewport: Viewport;
  operatorFunctions: number[];
  operatorArguments: unknown[];
  constructPathOperator: number;
  textItems: TextItem[];
}): SmartFormField[] {
  const candidates: Candidate[] = [];

  operatorFunctions.forEach((operator, index) => {
    if (operator !== constructPathOperator) return;
    const args = operatorArguments[index] as [number[], ArrayLike<number>, number[]] | undefined;
    const rawValues = args?.[1];
    if (!rawValues || typeof rawValues.length !== "number") return;
    const values = Array.from(rawValues);
    for (let offset = 0; offset + 3 < values.length; offset += 4) {
      const [x, y, width, height] = values.slice(offset, offset + 4);
      if (![x, y, width, height].every(Number.isFinite)) continue;
      const rect = normalizedRectangle(viewport, [x, y, x + width, y + height]);
      const pixelWidth = rect.width * viewport.width;
      const pixelHeight = rect.height * viewport.height;
      const isBox = pixelWidth >= 11 && pixelWidth <= 42 && pixelHeight >= 11 && pixelHeight <= 42 && Math.abs(pixelWidth - pixelHeight) <= 8;
      const isLine = pixelWidth >= 55 && pixelHeight <= 3;
      if (isBox) candidates.push({ ...rect, kind: "box" });
      if (isLine) candidates.push({ x: rect.x, y: Math.max(0, rect.y - 0.024), width: rect.width, height: 0.03, kind: "line" });
    }
  });

  textItems.forEach((item) => {
    if (!item.str || !/_{4,}/.test(item.str) || !item.transform) return;
    const x = item.transform[4];
    const y = item.transform[5];
    const width = Math.max(40, item.width ?? item.str.length * 5);
    const rect = normalizedRectangle(viewport, [x, y - 2, x + width, y + Math.max(10, item.height ?? 10)]);
    candidates.push({ x: rect.x, y: Math.max(0, rect.y - 0.012), width: rect.width, height: Math.max(0.028, rect.height), kind: "line" });
  });

  const textPositions = textItems.flatMap((item) => {
    if (!item.str?.trim() || !item.transform) return [];
    const rect = normalizedRectangle(viewport, [item.transform[4], item.transform[5], item.transform[4] + Math.max(1, item.width ?? 1), item.transform[5] + Math.max(8, item.height ?? 8)]);
    return [{ text: item.str.trim(), ...rect }];
  });

  const unique: Candidate[] = [];
  for (const candidate of candidates.sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (candidate.width > 0.92 || candidate.y < 0.04 || candidate.y > 0.96) continue;
    if (!unique.some((existing) => existing.kind === candidate.kind && overlaps(existing, candidate))) unique.push(candidate);
  }

  return unique.map((candidate, index) => {
    const aligned = textPositions
      .filter((text) => {
        const verticalDistance = Math.abs((text.y + text.height / 2) - (candidate.y + candidate.height / 2));
        const leftDistance = candidate.x - (text.x + text.width);
        return verticalDistance < 0.055 && leftDistance > -0.08 && leftDistance < 0.34;
      })
      .sort((a, b) => Math.abs(candidate.x - (a.x + a.width)) - Math.abs(candidate.x - (b.x + b.width)))
      .slice(0, 3)
      .map((text) => text.text)
      .join(" ");
    const adjacent = textPositions
      .filter((text) => {
        const horizontalDistance = Math.max(0, Math.max(text.x - (candidate.x + candidate.width), candidate.x - (text.x + text.width)));
        const verticalDistance = Math.abs((text.y + text.height / 2) - (candidate.y + candidate.height / 2));
        return horizontalDistance < 0.08 && verticalDistance < 0.09;
      })
      .sort((a, b) => Math.abs(a.y - candidate.y) - Math.abs(b.y - candidate.y))
      .slice(0, 4)
      .map((text) => text.text)
      .join(" ");
    const label = [aligned, adjacent].filter(Boolean).join(" ") || (candidate.kind === "box" ? "Checkbox" : "Form field");
    return {
      id: `p${pageNumber}-${candidate.kind}-${index + 1}`,
      page: pageNumber,
      x: clamp(candidate.x),
      y: clamp(candidate.y),
      width: clamp(Math.max(candidate.kind === "box" ? 0.028 : 0.08, candidate.width)),
      height: clamp(Math.max(candidate.kind === "box" ? 0.028 : 0.03, candidate.height)),
      type: inferType(label, candidate.kind),
      label,
    };
  });
}
