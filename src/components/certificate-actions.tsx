"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { downloadPdf, generateCertificatePdf, generateWalletCardPdf } from "@/lib/certificate-pdf";
import { Button } from "@/components/ui/button";

interface Cert {
  cert_type: string | null;
  cert_number: string | null;
  ic_rc_level: string | null;
  issued_date: string | null;
  expiration_date: string | null;
  /** Storage path (member-documents) to the admin-uploaded physical certificate, if any. */
  certificate_url?: string | null;
}

/** Downloads the official certificate / wallet card as real PDF files generated
 *  from the certification record ABCAC issued, plus the admin-uploaded scan
 *  when one exists. */
export function CertificateActions({ cert, memberName }: { cert: Cert; memberName: string }) {
  const [busy, setBusy] = useState<"file" | "cert" | "wallet" | null>(null);

  const pdfData = {
    memberName,
    certType: cert.cert_type ?? "ABCAC Credential",
    certNumber: cert.cert_number,
    icRcLevel: cert.ic_rc_level,
    issuedDate: cert.issued_date,
    expirationDate: cert.expiration_date,
  };

  async function downloadFile() {
    if (!cert.certificate_url) return;
    setBusy("file");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.storage
        .from("member-documents")
        .createSignedUrl(cert.certificate_url, 3600);
      if (error || !data) throw error || new Error("no url");
      window.open(data.signedUrl, "_blank");
    } catch {
      alert("Could not open your certificate file. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function certificate() {
    setBusy("cert");
    try {
      downloadPdf(await generateCertificatePdf(pdfData), `ABCAC-Certificate-${cert.cert_type ?? "credential"}.pdf`);
    } catch {
      alert("Could not generate the certificate PDF. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function wallet() {
    setBusy("wallet");
    try {
      downloadPdf(await generateWalletCardPdf(pdfData), `ABCAC-Wallet-Card-${cert.cert_type ?? "credential"}.pdf`);
    } catch {
      alert("Could not generate the wallet card PDF. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={certificate} disabled={busy !== null}>
        {busy === "cert" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileDown className="h-4 w-4" aria-hidden />}
        Certificate PDF
      </Button>
      <Button variant="outline" size="sm" onClick={wallet} disabled={busy !== null}>
        {busy === "wallet" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileDown className="h-4 w-4" aria-hidden />}
        Wallet Card PDF
      </Button>
      {cert.certificate_url && (
        <Button variant="ghost" size="sm" onClick={downloadFile} disabled={busy !== null}>
          {busy === "file" ? "Opening…" : "Original Scan"}
        </Button>
      )}
    </div>
  );
}
