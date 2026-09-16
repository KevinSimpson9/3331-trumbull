/** Storage and presentation helpers for executed documents uploaded after
 *  DocuSign completion. The portal is a filing cabinet for these files — it
 *  never generates them and never claims to have witnessed a signature. */

/** Result of phase one of an upload: a signed URL the browser PUTs bytes to,
 *  plus the object path to hand back when finalizing. */
export interface UploadTicket {
  ok?: boolean;
  uploadUrl?: string;
  path?: string;
  error?: string;
}

export const INVESTOR_DOCS_BUCKET = "investor-documents";
export const PROJECT_DOCS_BUCKET = "project-documents";

/** Suggested labels in the upload form's dropdown. Free text is allowed —
 *  the document set is decided in DocuSign, not in the portal. */
export const DOC_TYPE_SUGGESTIONS = [
  "Promissory Note",
  "Personal Guarantee",
  "Subscription Agreement",
  "Letter of Intent",
  "Mortgage / Security Agreement",
  "Investor Questionnaire",
  "Amendment",
  "Other",
];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg"];

export function fileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function isAllowedUpload(fileName: string): boolean {
  return ALLOWED_EXTENSIONS.includes(fileExtension(fileName));
}

/** The three-letter glyph on a document card. */
export function badgeFor(fileName: string): string {
  const ext = fileExtension(fileName);
  if (ext === "docx" || ext === "doc") return "DOC";
  if (ext === "xlsx" || ext === "xls") return "XLS";
  if (ext === "png" || ext === "jpg" || ext === "jpeg") return "IMG";
  return ext ? ext.toUpperCase().slice(0, 4) : "FILE";
}

/** Strips anything that would make an awkward object key, keeping the
 *  extension. Uploaded names come from the admin's filesystem, so they carry
 *  spaces, parentheses and the occasional non-ASCII character. */
export function safeFileName(fileName: string): string {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "");
  return cleaned || "document";
}

/** Object key for an executed document: one folder per investor, so the
 *  storage policy can scope reads by the leading path segment. */
export function investorDocPath(investorId: string, fileName: string): string {
  return `${investorId}/${Date.now()}-${safeFileName(fileName)}`;
}

export function fmtFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Formats the DocuSign execution date. The stored value is a plain YYYY-MM-DD
 *  date, so it is parsed as local time — `new Date("2026-09-16")` would be
 *  read as UTC midnight and render as the previous day west of Greenwich. */
export function fmtExecutedOn(date: string | null): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
