export type AnnotationType = "text" | "check" | "date" | "signature";

export type FormAnnotation = {
  id: string;
  fieldId?: string;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  value: string;
  type: AnnotationType;
  author: "applicant" | "signer";
};

export type SmartFormField = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: AnnotationType;
  label: string;
};

export type DigitalFormDocument = {
  formKey: string;
  annotations: FormAnnotation[];
  completed?: boolean;
  completedAt?: string | null;
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
