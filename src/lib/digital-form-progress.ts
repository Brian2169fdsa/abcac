import type { DigitalFormDocument } from "@/lib/digital-form-types";

export function hasCompletedEntry(document: DigitalFormDocument) {
  return document.annotations.some((annotation) => annotation.value.trim().length > 0);
}

export function isDigitalFormComplete(document: DigitalFormDocument) {
  return document.completed === true && hasCompletedEntry(document);
}

export function isDigitalPacketComplete(documents: DigitalFormDocument[], requiredFormKeys: string[]) {
  return requiredFormKeys.every((formKey) => {
    const document = documents.find((item) => item.formKey === formKey);
    return Boolean(document && isDigitalFormComplete(document));
  });
}
