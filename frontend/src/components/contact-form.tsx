"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "sending" | "ok" | "error";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value.trim(),
      email: (form.elements.namedItem("email") as HTMLInputElement).value.trim(),
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value.trim(),
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value.trim(),
    };
    if (!payload.name || !payload.email || !payload.message) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setStatus("ok");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-6 text-success">
        Thank you for contacting us. We will get back to you as soon as possible.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">Name</label>
        <input id="name" name="name" className={field} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">Email</label>
          <input id="email" name="email" type="email" className={field} required />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold">Phone</label>
          <input id="phone" name="phone" type="tel" className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-semibold">Message</label>
        <textarea id="message" name="message" rows={5} className="w-full rounded-lg border border-line bg-bg p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" required />
      </div>
      {status === "error" && (
        <p className="text-sm text-red-600">Oops, there was an error sending your message. Please try again later.</p>
      )}
      <Button type="submit" disabled={status === "sending"} size="lg">
        {status === "sending" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Send Message"}
      </Button>
    </form>
  );
}
