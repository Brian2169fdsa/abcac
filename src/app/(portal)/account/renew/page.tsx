import { redirect } from "next/navigation";

// The legacy free-text renewal form is retired: recertification runs through
// the Certification hub (Initial | Recertification -> credential -> digital
// packet -> pay at the end), so members have exactly one renewal flow.
export default function RenewPage() {
  redirect("/account/certification");
}
