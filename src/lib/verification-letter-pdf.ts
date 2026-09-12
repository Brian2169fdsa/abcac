import { PDFDocument, PageSizes, StandardFonts, rgb } from "pdf-lib";
import { siteConfig } from "@/lib/site-config";

// Server-safe (no browser APIs) generation of a one-page verification-decision
// letter, produced the moment an admin decides a verification_requests row.
// Mirrors the brand constants/winAnsiSafe pattern in certificate-pdf.ts so the
// letter matches the look of the certificate/wallet-card PDFs.

export interface VerificationLetterData {
  subjectName: string;
  subjectCertNumber?: string | null;
  purpose?: string | null;
  recipientName?: string | null;
  result: "verified" | "not_verified";
  decidedDate: string; // ISO
}

const NAVY = rgb(0x1f / 255, 0x3a / 255, 0x5f / 255);
const BRAND = rgb(0x86 / 255, 0x1f / 255, 0x24 / 255);
const GOLD = rgb(0xc8 / 255, 0xa0 / 255, 0x4a / 255);
const INK = rgb(0x1c / 255, 0x24 / 255, 0x30 / 255);
const MUTED = rgb(0x55 / 255, 0x5f / 255, 0x6e / 255);

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function winAnsiSafe(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E -ÿ]/g, "");
}

function wrapLines(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateVerificationLetterPdf(rawData: VerificationLetterData): Promise<Uint8Array> {
  const data: VerificationLetterData = {
    ...rawData,
    subjectName: winAnsiSafe(rawData.subjectName),
    subjectCertNumber: rawData.subjectCertNumber ? winAnsiSafe(rawData.subjectCertNumber) : rawData.subjectCertNumber,
    purpose: rawData.purpose ? winAnsiSafe(rawData.purpose) : rawData.purpose,
    recipientName: rawData.recipientName ? winAnsiSafe(rawData.recipientName) : rawData.recipientName,
  };

  const doc = await PDFDocument.create();
  const [width, height] = PageSizes.Letter;
  const page = doc.addPage([width, height]);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const margin = 72;
  const contentWidth = width - margin * 2;
  let y = height - 80;

  page.drawRectangle({ x: 0, y: height - 14, width, height: 14, color: NAVY });
  page.drawRectangle({ x: 0, y: height - 18, width, height: 4, color: GOLD });

  page.drawText("ARIZONA BOARD FOR CERTIFICATION", { x: margin, y, size: 16, font: serifBold, color: NAVY });
  y -= 20;
  page.drawText("OF ADDICTION COUNSELORS", { x: margin, y, size: 16, font: serifBold, color: NAVY });
  y -= 16;
  page.drawText("An IC&RC Member Board — Phoenix, Arizona", { x: margin, y, size: 10, font: serif, color: MUTED });

  y -= 48;
  page.drawText(fmt(data.decidedDate), { x: margin, y, size: 11, font: serif, color: INK });

  y -= 30;
  page.drawText(
    data.recipientName ? `To: ${data.recipientName}` : "To Whom It May Concern:",
    { x: margin, y, size: 12, font: serifBold, color: INK },
  );

  y -= 26;
  page.drawText("Re: Certification Verification", { x: margin, y, size: 12, font: serifBold, color: BRAND });

  y -= 28;
  const verified = data.result === "verified";
  const subjectLine = data.subjectName || data.subjectCertNumber || "the individual named in this request";
  const bodyText = verified
    ? `This letter confirms that ${data.subjectName || subjectLine} holds a valid certification issued by the Arizona Board for Certification of Addiction Counselors (ABCAC) and is in good standing as of the date of this letter.`
    : `Based on the information provided, ABCAC is unable to verify a valid certification for ${data.subjectName || subjectLine} as of the date of this letter.`;
  for (const line of wrapLines(bodyText, serif, 12, contentWidth)) {
    page.drawText(line, { x: margin, y, size: 12, font: serif, color: INK });
    y -= 18;
  }

  if (data.purpose) {
    y -= 10;
    for (const line of wrapLines(`Purpose of this request: ${data.purpose}`, serif, 11, contentWidth)) {
      page.drawText(line, { x: margin, y, size: 11, font: serif, color: MUTED });
      y -= 16;
    }
  }

  y -= 14;
  const detailRows: Array<[string, string]> = [
    ["Certification Number", data.subjectCertNumber || "—"],
    ["Verification Result", verified ? "Verified" : "Not Verified"],
    ["Date of Determination", fmt(data.decidedDate)],
  ];
  for (const [label, value] of detailRows) {
    page.drawText(`${label}:`, { x: margin, y, size: 11, font: serifBold, color: INK });
    page.drawText(value, { x: margin + 190, y, size: 11, font: serif, color: INK });
    y -= 18;
  }

  y -= 30;
  page.drawText(
    "This letter was generated electronically and is valid without a physical signature.",
    { x: margin, y, size: 10, font: serif, color: MUTED },
  );
  y -= 40;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 1, color: INK });
  y -= 16;
  page.drawText("ABCAC Administrator", { x: margin, y, size: 11, font: serif, color: INK });

  const footerY = 60;
  page.drawText(
    `${siteConfig.contact.addressLine}, ${siteConfig.contact.cityStateZip} · ${siteConfig.contact.phone} · ${siteConfig.contact.email}`,
    { x: margin, y: footerY, size: 9, font: serif, color: MUTED },
  );

  return doc.save();
}
