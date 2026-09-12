import { redirect } from "next/navigation";

export const metadata = { title: "Apply for Certification" };
// Single entry point for applications is the Certification hub.
export default async function ApplyPage() {
  redirect("/account/certification");
}
