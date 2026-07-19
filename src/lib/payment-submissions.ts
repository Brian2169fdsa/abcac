export interface PaymentIntakeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface NormalizedPaymentIntake {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  referenceNumber: string | null;
  notes: string | null;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePaymentIntake(input: PaymentIntakeInput | undefined): NormalizedPaymentIntake | null {
  const firstName = input?.firstName?.trim() ?? "";
  const lastName = input?.lastName?.trim() ?? "";
  const email = input?.email?.trim().toLowerCase() ?? "";
  const phone = input?.phone?.trim() ?? "";
  if (!firstName || !lastName || !emailPattern.test(email) || phone.replace(/\D/g, "").length < 10) return null;
  return {
    firstName: firstName.slice(0, 100),
    lastName: lastName.slice(0, 100),
    email: email.slice(0, 254),
    phone: phone.slice(0, 40),
    referenceNumber: input?.referenceNumber?.trim().slice(0, 120) || null,
    notes: input?.notes?.trim().slice(0, 2000) || null,
  };
}

export function paymentFormLabel(formType: string) {
  return ({
    general_payment: "General payment form",
    testing_preregistration: "Exam pre-registration form",
    certification_sync: "Certification sync request",
    reciprocity_request: "Reciprocity request",
    invoice: "Admin-issued invoice",
  } as Record<string, string>)[formType] ?? "Payment form";
}
