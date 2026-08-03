import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { GREAT_VIBES_TTF_BASE64 } from "./fonts/great-vibes-base64";
import type { SignableDoc } from "./docs";
import type { Investor } from "./types";

const PAGE = { width: 612, height: 792 }; // US Letter
const MARGIN = 64;
const INK = rgb(0.17, 0.23, 0.25); // #2c3b41 — matches the portal's paper text
const GOLD = rgb(0.85, 0.64, 0.25); // #d9a441
const MUTED = rgb(0.42, 0.53, 0.57);

interface CountersignInfo {
  name: string;
  signedAtISO: string;
  ip: string | null;
  userAgent: string | null;
}

interface SignInfo {
  investor: Investor;
  doc: SignableDoc;
  signerName: string;
  signedAtISO: string;
  ip: string | null;
  userAgent: string | null;
  /** Admin countersignature — rendered as a second signature block when present. */
  countersign?: CountersignInfo | null;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Renders the executed document as a clean, single-flow PDF (letterhead,
 *  full text, cursive adopted signature, and an audit block). */
export async function generateSignedPdf(info: SignInfo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const times = await pdf.embedFont(StandardFonts.TimesRomanBold);
  // NOTE: no subsetting — pdf-lib's subsetter drops glyphs from this script
  // font, corrupting the rendered signature. Full embed is ~445KB.
  const script = await pdf.embedFont(Buffer.from(GREAT_VIBES_TTF_BASE64, "base64"));

  const contentWidth = PAGE.width - MARGIN * 2;
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const ensureRoom = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };

  // ---- letterhead -----------------------------------------------------
  page.drawText("3331 TRUMBULL", { x: MARGIN, y, size: 10, font: helvBold, color: GOLD });
  page.drawText("AK Capital Investments LLC · Detroit, MI", {
    x: MARGIN,
    y: y - 14,
    size: 9,
    font: helv,
    color: MUTED,
  });
  y -= 30;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE.width - MARGIN, y },
    thickness: 1.5,
    color: GOLD,
  });
  y -= 30;

  // ---- title ----------------------------------------------------------
  for (const line of wrapText(info.doc.title, times, 20, contentWidth)) {
    ensureRoom(26);
    page.drawText(line, { x: MARGIN, y, size: 20, font: times, color: INK });
    y -= 26;
  }
  y -= 8;

  // ---- body -----------------------------------------------------------
  for (const line of wrapText(info.doc.body, helv, 10.5, contentWidth)) {
    ensureRoom(16);
    if (line) page.drawText(line, { x: MARGIN, y, size: 10.5, font: helv, color: INK });
    y -= 16;
  }
  y -= 18;

  const fmtStamp = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: "America/Detroit",
    });

  const drawSignatureBlock = (
    heading: string,
    name: string,
    roleLine: string | null,
    stampLine: string
  ) => {
    ensureRoom(150 + (roleLine ? 14 : 0));
    page.drawText(heading, { x: MARGIN, y, size: 8.5, font: helvBold, color: MUTED });
    y -= 42;
    page.drawText(name, { x: MARGIN, y, size: 30, font: script, color: INK });
    y -= 10;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + 260, y },
      thickness: 0.8,
      color: INK,
    });
    y -= 16;
    page.drawText(name, { x: MARGIN, y, size: 10.5, font: helvBold, color: INK });
    y -= 14;
    if (roleLine) {
      page.drawText(roleLine, { x: MARGIN, y, size: 9.5, font: helv, color: MUTED });
      y -= 14;
    }
    page.drawText(stampLine, { x: MARGIN, y, size: 9.5, font: helv, color: INK });
    y -= 26;
  };

  // ---- signature blocks -----------------------------------------------
  const signedAt = new Date(info.signedAtISO);
  drawSignatureBlock(
    "ADOPTED ELECTRONIC SIGNATURE — INVESTOR",
    info.signerName,
    null,
    `Signed ${fmtStamp(info.signedAtISO)}`
  );

  if (info.countersign) {
    drawSignatureBlock(
      "COUNTERSIGNED — SPONSOR",
      info.countersign.name,
      "AK Capital Investments LLC",
      `Countersigned ${fmtStamp(info.countersign.signedAtISO)}`
    );
  }

  // ---- audit block ----------------------------------------------------
  const audit = [
    `Signer account: ${info.investor.email}`,
    `Document: ${info.doc.key} · Investor record: ${info.investor.id}`,
    `Recorded at: ${info.signedAtISO}`,
    info.ip ? `IP address: ${info.ip}` : null,
    info.userAgent ? `Device: ${info.userAgent.slice(0, 110)}` : null,
    ...(info.countersign
      ? [
          `Countersigned by: ${info.countersign.name} (AK Capital Investments LLC) · Recorded at: ${info.countersign.signedAtISO}`,
          info.countersign.ip ? `Countersigner IP address: ${info.countersign.ip}` : null,
          info.countersign.userAgent
            ? `Countersigner device: ${info.countersign.userAgent.slice(0, 110)}`
            : null,
        ]
      : []),
    "Executed electronically via the 3331 Trumbull Investor Portal. Each signer consented to conduct business",
    "electronically (E-SIGN Act) and adopted their signature above as the legal equivalent of a handwritten signature.",
  ].filter(Boolean) as string[];

  ensureRoom(16 + audit.length * 12);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE.width - MARGIN, y },
    thickness: 0.6,
    color: MUTED,
  });
  y -= 16;
  for (const line of audit) {
    ensureRoom(12);
    page.drawText(line, { x: MARGIN, y, size: 7.5, font: helv, color: MUTED });
    y -= 12;
  }

  pdf.setTitle(`${info.doc.title} — ${info.signerName}`);
  pdf.setAuthor("AK Capital Investments LLC");
  pdf.setSubject("3331 Trumbull — executed investor document");
  pdf.setCreationDate(signedAt);

  return pdf.save();
}

export const SIGNED_DOCS_BUCKET = "signed-documents";

export function signedPdfPath(investorId: string, docKey: string): string {
  return `${investorId}/${docKey}.pdf`;
}
