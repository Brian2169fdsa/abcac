import { PDFDocument, PageSizes, StandardFonts, rgb } from "pdf-lib";

// Client-side generation of the official ABCAC certificate and wallet card as
// real downloadable PDF files, rendered from the certification row the admin
// entered (cert type, number, dates, IC&RC level). No server round trip: the
// data is already on the page and the member gets a true PDF, not a print view.

export interface CertificatePdfData {
  memberName: string;
  certType: string;
  certNumber?: string | null;
  icRcLevel?: string | null;
  issuedDate?: string | null;
  expirationDate?: string | null;
}

const BRAND = rgb(0x86 / 255, 0x1f / 255, 0x24 / 255); // ABCAC maroon
const NAVY = rgb(0x1f / 255, 0x3a / 255, 0x5f / 255);
const GOLD = rgb(0xc8 / 255, 0xa0 / 255, 0x4a / 255);
const INK = rgb(0x1c / 255, 0x24 / 255, 0x30 / 255);

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateCertificatePdf(data: CertificatePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const [letterW, letterH] = PageSizes.Letter;
  const page = doc.addPage([letterH, letterW]); // landscape
  const { width, height } = page.getSize();
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  // Double border: navy outer frame, gold inner rule.
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: NAVY, borderWidth: 10 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, borderColor: GOLD, borderWidth: 1.5 });

  const centerText = (text: string, y: number, size: number, font = serif, color = INK) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font, color });
  };

  centerText("ARIZONA BOARD FOR CERTIFICATION", height - 110, 26, serifBold, NAVY);
  centerText("OF ADDICTION COUNSELORS", height - 142, 26, serifBold, NAVY);
  centerText("An IC&RC Member Board — Phoenix, Arizona", height - 166, 12, serifItalic);

  centerText("CERTIFIES THAT", height - 218, 13, serif, BRAND);

  const nameSize = data.memberName.length > 28 ? 30 : 38;
  centerText(data.memberName, height - 266, nameSize, serifBold, INK);
  const nameWidth = Math.max(serifBold.widthOfTextAtSize(data.memberName, nameSize), 260);
  page.drawLine({
    start: { x: (width - nameWidth) / 2 - 20, y: height - 280 },
    end: { x: (width + nameWidth) / 2 + 20, y: height - 280 },
    thickness: 1.5,
    color: GOLD,
  });

  centerText("has met all requirements established by the Board and is hereby recognized as a", height - 316, 13);
  const credential = `${data.certType}${data.icRcLevel ? ` (${data.icRcLevel})` : ""}`;
  centerText(credential, height - 350, 24, serifBold, BRAND);

  // Detail columns: certificate number, issued, valid through.
  const columns: Array<[string, string]> = [
    ["Certificate No.", data.certNumber || "—"],
    ["Date Issued", fmt(data.issuedDate)],
    ["Valid Through", fmt(data.expirationDate)],
  ];
  const columnWidth = 180;
  const startX = (width - columnWidth * columns.length) / 2;
  columns.forEach(([label, value], index) => {
    const cx = startX + index * columnWidth + columnWidth / 2;
    const labelWidth = serif.widthOfTextAtSize(label, 11);
    const valueWidth = serifBold.widthOfTextAtSize(value, 14);
    page.drawText(label, { x: cx - labelWidth / 2, y: 158, size: 11, font: serif, color: INK });
    page.drawText(value, { x: cx - valueWidth / 2, y: 138, size: 14, font: serifBold, color: INK });
  });

  // Signature block.
  page.drawLine({ start: { x: width / 2 - 130, y: 92 }, end: { x: width / 2 + 130, y: 92 }, thickness: 1, color: INK });
  centerText("ABCAC Administrator", 76, 11, serif);

  return doc.save();
}

/** Standard wallet-card size: 3.375in x 2.125in at 72pt/in. */
export async function generateWalletCardPdf(data: CertificatePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const width = 3.375 * 72;
  const height = 2.125 * 72;
  const page = doc.addPage([width, height]);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width, height, color: NAVY });
  page.drawRectangle({ x: 4, y: 4, width: width - 8, height: height - 8, borderColor: GOLD, borderWidth: 0.8 });

  page.drawText("ARIZONA BOARD FOR CERTIFICATION", { x: 14, y: height - 22, size: 7.5, font: sansBold, color: GOLD });
  page.drawText("OF ADDICTION COUNSELORS", { x: 14, y: height - 32, size: 7.5, font: sansBold, color: GOLD });

  const nameSize = data.memberName.length > 26 ? 11 : 14;
  page.drawText(data.memberName, { x: 14, y: height - 58, size: nameSize, font: sansBold, color: rgb(1, 1, 1) });
  const credential = `${data.certType}${data.certNumber ? `  ·  #${data.certNumber}` : ""}`;
  page.drawText(credential, { x: 14, y: height - 74, size: 9.5, font: sans, color: GOLD });
  if (data.icRcLevel) {
    page.drawText(`IC&RC ${data.icRcLevel}`, { x: 14, y: height - 87, size: 8, font: sans, color: rgb(0.94, 0.93, 0.87) });
  }

  const issued = `Issued: ${fmt(data.issuedDate)}`;
  const expires = `Expires: ${fmt(data.expirationDate)}`;
  page.drawText(issued, { x: 14, y: 14, size: 7.5, font: sans, color: rgb(0.94, 0.93, 0.87) });
  const expiresWidth = sans.widthOfTextAtSize(expires, 7.5);
  page.drawText(expires, { x: width - 14 - expiresWidth, y: 14, size: 7.5, font: sans, color: rgb(0.94, 0.93, 0.87) });

  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
