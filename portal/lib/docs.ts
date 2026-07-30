import { fmtMoney } from "./format";
import type { DocKey, Investor } from "./types";

export interface SignableDoc {
  key: DocKey;
  badge: string;
  title: string;
  desc: string;
  body: string;
}

/** The three per-investor signable documents, terms interpolated per the design. */
export function docDefs(inv: Pick<Investor, "legal_name" | "principal" | "rate" | "term_months">): SignableDoc[] {
  const amt = fmtMoney(inv.principal);
  return [
    {
      key: "note",
      badge: "SIGN",
      title: "Promissory Note",
      desc: `${amt} principal · ${inv.rate}% per annum · ${inv.term_months}-month term`,
      body:
        `PROMISSORY NOTE — 3331 Trumbull, Detroit, MI\n\n` +
        `Borrower: AK Capital Investments LLC\nLender: ${inv.legal_name}\nPrincipal: ${amt}\n` +
        `Rate: ${inv.rate}% per annum\nTerm: ${inv.term_months} months from funding\n` +
        `Security: Second-position debt on 3331 Trumbull plus personal guarantee of the principals.\n\n` +
        `For value received, Borrower promises to pay Lender the principal sum with interest as set forth above. ` +
        `Prepayment permitted without penalty. Events of default, notice, and cure periods per the full agreement in your document folder.\n\n` +
        `This on-screen summary is provided for e-signature convenience; the countersigned original will be returned to your folder.`,
    },
    {
      key: "guarantee",
      badge: "SIGN",
      title: "Personal Guarantee Acknowledgment",
      desc: "Acknowledge the personal guarantee backing your note",
      body:
        `PERSONAL GUARANTEE — ACKNOWLEDGMENT\n\n` +
        `The principals of AK Capital Investments LLC personally and unconditionally guarantee repayment of the note held by ${inv.legal_name}.\n\n` +
        `By signing, you acknowledge receipt of the guarantee instrument and that it remains in force for the life of the note.`,
    },
    {
      key: "accreditation",
      badge: "SIGN",
      title: "Accredited Investor Verification",
      desc: "Self-certification of accredited status (Reg D 506(b))",
      body:
        `ACCREDITED INVESTOR SELF-CERTIFICATION\n\n` +
        `I, ${inv.legal_name}, certify that I qualify as an accredited investor under SEC Rule 501 of Regulation D by meeting at least one of the income, net-worth, or professional-certification standards, and that the information I have provided is accurate.`,
    },
  ];
}

export const DOC_COUNT = 3;

/** Fallback shared-library items shown until rows exist in project_documents. */
export const DEFAULT_PROJECT_DOCS = [
  { id: "deck", badge: "PDF", title: "Investor Overview Deck", description: "Capital stack, returns, timeline & risk mitigation", href: null, storage_path: null, sort: 1 },
  { id: "appraisal", badge: "PDF", title: "Independent Appraisal", description: "Certified appraisal · Q2 2026", href: null, storage_path: null, sort: 2 },
  { id: "loan", badge: "PDF", title: "Senior Loan Term Sheet", description: "Construction financing · committed", href: null, storage_path: null, sort: 3 },
  { id: "budget", badge: "XLSX", title: "Detailed Build Budget", description: "Line-item hard & soft costs", href: null, storage_path: null, sort: 4 },
  { id: "plans", badge: "PDF", title: "Architectural Plans", description: "Site plan · Unit floor plans · Renderings", href: null, storage_path: null, sort: 5 },
  { id: "site", badge: "WEB", title: "Project Website", description: "trumbullnorth.com · Public-facing site", href: "https://trumbullnorth.com", storage_path: null, sort: 6 },
];
