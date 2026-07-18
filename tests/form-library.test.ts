import { describe, expect, it } from "vitest";
import { FORM_LIBRARY, FORM_WORKFLOWS, getFormDefinition, getFormWorkflow, getWorkflowForms } from "@/lib/form-library";

describe("digital ABCAC form library", () => {
  it("catalogs every supplied original packet exactly once", () => {
    expect(FORM_LIBRARY).toHaveLength(14);
    expect(new Set(FORM_LIBRARY.map((form) => form.key)).size).toBe(14);
    expect(FORM_LIBRARY.reduce((total, form) => total + form.pages, 0)).toBe(167);
    expect(FORM_LIBRARY.every((form) => form.href.startsWith("/forms/library/") && form.href.endsWith(".pdf"))).toBe(true);
  });

  it("provides all seven initial certification workflows", () => {
    const credentials = ["cac", "cadac", "aadc", "cprs", "ccs", "ccjp", "cps"];
    for (const credential of credentials) {
      const workflow = getFormWorkflow(`initial:${credential}`);
      expect(workflow?.appType).toBe("initial");
      expect(workflow && getWorkflowForms(workflow).length).toBeGreaterThan(0);
    }
  });

  it("provides every renewal, board, and CEU workflow", () => {
    const keys = ["renewal:counselor", "renewal:cps", "renewal:ccs", "renewal:ccjp", "renewal:cprs", "board:member", "ceu:workshop"];
    expect(FORM_WORKFLOWS).toHaveLength(14);
    for (const key of keys) {
      const workflow = getFormWorkflow(key);
      expect(workflow).toBeDefined();
      expect(workflow && getWorkflowForms(workflow)).toHaveLength(1);
    }
  });

  it("does not reference missing forms from a workflow", () => {
    for (const workflow of FORM_WORKFLOWS) {
      for (const formKey of workflow.formKeys) expect(getFormDefinition(formKey)).toBeDefined();
    }
  });
});
