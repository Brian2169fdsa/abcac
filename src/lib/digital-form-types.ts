export type AnnotationType = "text" | "check" | "date" | "signature";

export type FormAnnotation = {
  id: string;
  page: number;
  x: number;
  y: number;
  value: string;
  type: AnnotationType;
  author: "applicant" | "signer";
};

export type DigitalFormDocument = {
  formKey: string;
  annotations: FormAnnotation[];
};

export type DigitalApplicationDetails = {
  version: 1;
  requestKind: "digital_application_packet";
  submissionMode: "digital" | "paper";
  workflowKey: string;
  workflowTitle: string;
  credential: string;
  documents: DigitalFormDocument[];
  paperDocumentPath?: string | null;
  paperFileName?: string | null;
};
