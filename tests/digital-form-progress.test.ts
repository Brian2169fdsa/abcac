import { describe, expect, it } from "vitest";
import { hasCompletedEntry, isDigitalFormComplete, isDigitalPacketComplete } from "@/lib/digital-form-progress";
import type { DigitalFormDocument } from "@/lib/digital-form-types";

function document(formKey: string, completed: boolean, value = "Filled") : DigitalFormDocument {
  return { formKey, completed, annotations: [{ id: `${formKey}-1`, page: 1, x: 0.1, y: 0.1, value, type: "text", author: "applicant" }] };
}

describe("digital form packet progress", () => {
  it("requires a meaningful entry and explicit completion", () => {
    expect(hasCompletedEntry(document("general", true, ""))).toBe(false);
    expect(isDigitalFormComplete(document("general", false))).toBe(false);
    expect(isDigitalFormComplete(document("general", true))).toBe(true);
  });

  it("requires every form in a multi-document packet", () => {
    expect(isDigitalPacketComplete([document("general", true), document("supplement", false)], ["general", "supplement"])).toBe(false);
    expect(isDigitalPacketComplete([document("general", true), document("supplement", true)], ["general", "supplement"])).toBe(true);
  });
});
