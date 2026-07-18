import { redirect } from "next/navigation";

export const metadata = { title: "Apply for Certification" };
export default async function ApplyPage() {
  redirect("/account/forms");
}
