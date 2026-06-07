"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (!w) return alert("Please allow pop-ups to download your certificate.");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

/** Generates a printable certificate / wallet card (print-to-PDF), plus a
 *  download for the admin-uploaded physical certificate file when one exists. */
export function CertificateActions({ cert, memberName }: { cert: Cert; memberName: string }) {
  const [downloading, setDownloading] = useState(false);

  async function downloadFile() {
    if (!cert.certificate_url) return;
    setDownloading(true);
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
      setDownloading(false);
    }
  }

  function certificate() {
    openPrint(
      `<!DOCTYPE html><html><head><title>ABCAC Certificate</title><style>
      @page{size:landscape;margin:0}body{margin:0;font-family:Georgia,serif}
      .c{width:100%;height:100vh;box-sizing:border-box;padding:60px;text-align:center;border:18px solid #1f3a5f;outline:3px solid #c8a04a;outline-offset:-30px;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#1c2430}
      h1{color:#1f3a5f;font-size:32px;letter-spacing:1px;margin:0 0 6px}
      .s{color:#806014;text-transform:uppercase;letter-spacing:4px;font-size:13px;margin-bottom:36px}
      .n{font-size:40px;margin:16px 0;border-bottom:2px solid #c8a04a;padding-bottom:10px}
      .b{font-size:18px;max-width:680px;line-height:1.6}.r{display:flex;gap:60px;margin-top:30px;font-size:14px}</style></head><body>
      <div class="c"><h1>Arizona Board for Certification of Addiction Counselors</h1>
      <div class="s">Certifies that</div><div class="n">${memberName}</div>
      <div class="b">has met all requirements and is hereby recognized as a<br><strong>${cert.cert_type ?? ""}</strong>${cert.ic_rc_level ? ` (${cert.ic_rc_level})` : ""}</div>
      <div class="r"><div>Certificate No.<br><b>${cert.cert_number ?? "—"}</b></div><div>Issued<br><b>${fmt(cert.issued_date)}</b></div><div>Valid Through<br><b>${fmt(cert.expiration_date)}</b></div></div>
      </div></body></html>`,
    );
  }
  function wallet() {
    openPrint(
      `<!DOCTYPE html><html><head><title>ABCAC Wallet Card</title><style>
      body{margin:0;font-family:Arial,sans-serif;display:flex;justify-content:center;padding:40px}
      .card{width:340px;height:214px;border-radius:14px;background:linear-gradient(135deg,#1f3a5f,#16304f);color:#fff;padding:20px;box-sizing:border-box;box-shadow:0 4px 16px rgba(0,0,0,.3)}
      .t{font-size:12px;letter-spacing:1px;color:#e9d29a;text-transform:uppercase}.org{font-size:13px;font-weight:bold;margin-bottom:18px}
      .nm{font-size:20px;font-weight:bold}.cr{font-size:15px;color:#e9d29a;margin:4px 0 14px}.f{display:flex;justify-content:space-between;font-size:11px;color:#f0eede}
      @media print{body{padding:0}}</style></head><body>
      <div class="card"><div class="t">Arizona Board for Certification</div><div class="org">of Addiction Counselors</div>
      <div class="nm">${memberName}</div><div class="cr">${cert.cert_type ?? ""}${cert.cert_number ? ` · ${cert.cert_number}` : ""}</div>
      <div class="f"><span>Issued: ${fmt(cert.issued_date)}</span><span>Expires: ${fmt(cert.expiration_date)}</span></div></div></body></html>`,
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {cert.certificate_url ? (
        <Button variant="outline" size="sm" onClick={downloadFile} disabled={downloading}>
          {downloading ? "Opening…" : "Download Certificate"}
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={certificate}>Certificate</Button>
      )}
      <Button variant="outline" size="sm" onClick={wallet}>Wallet Card</Button>
    </div>
  );
}
