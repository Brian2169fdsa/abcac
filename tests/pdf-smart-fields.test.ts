import { describe, expect, it } from "vitest";
import { detectSmartFormFields } from "@/lib/pdf-smart-fields";

const viewport = {
  width: 1000,
  height: 1000,
  convertToViewportRectangle: (rectangle: [number, number, number, number]) => rectangle,
};

function detect(values: number[], textItems: Array<{ str: string; width: number; height: number; transform: number[] }> = []) {
  return detectSmartFormFields({
    pageNumber: 2,
    viewport,
    operatorFunctions: [91],
    operatorArguments: [[[], values, []]],
    constructPathOperator: 91,
    textItems,
  });
}

describe("detectSmartFormFields", () => {
  it("turns printed square boxes into checkable fields", () => {
    const fields = detect([300, 200, 18, 18]);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ page: 2, type: "check" });
  });

  it("recognizes a nearby printed signature line", () => {
    const fields = detect([300, 200, 240, 1], [{ str: "Supervisor Signature", width: 150, height: 14, transform: [1, 0, 0, 1, 140, 194] }]);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ type: "signature" });
    expect(fields[0].label).toContain("Supervisor Signature");
  });

  it("recognizes date lines and removes duplicate rectangles", () => {
    const fields = detect([300, 200, 180, 1, 300, 200, 180, 1], [{ str: "Date", width: 35, height: 14, transform: [1, 0, 0, 1, 255, 194] }]);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ type: "date" });
  });
});
