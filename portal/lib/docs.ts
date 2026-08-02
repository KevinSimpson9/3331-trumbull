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
export function docDefs(inv: Pick<Investor, "legal_name" | "principal" | "rate" | "term_months"> & { email?: string }): SignableDoc[] {
  const amt = fmtMoney(inv.principal);
  return [
    {
      key: "loi",
      badge: "SIGN",
      title: "Non-Binding Letter of Intent",
      desc: `Commitment letter · proposed terms for your ${amt} note`,
      body:
        `NON-BINDING LETTER OF INTENT\nSECURED PROMISSORY NOTE · 3331 TRUMBULL TOWNHOME DEVELOPMENT\n\n` +
        `Prospective Investor: ${inv.legal_name}${inv.email ? ` (${inv.email})` : ""}\n\n` +
        `This letter sets forth the mutual intent of the undersigned prospective investor (the "Investor") and ` +
        `3331 Trumbull LLC (the "Issuer"), sponsored by AK Capital Investments LLC and Bondy Construction & Design, ` +
        `regarding a proposed investment in a secured promissory note funding the construction of a 25-unit for-sale ` +
        `townhome development at 3331 Trumbull St, Detroit, MI 48208 (the "Project"). The proposed terms below are for discussion purposes only.\n\n` +
        `PROPOSED TERMS\n` +
        `Issuer / Borrower: 3331 Trumbull LLC (the "Issuer")\n` +
        `Sponsor: AK Capital Investments LLC × Bondy Construction & Design\n` +
        `Instrument: Secured promissory note (the "Note")\n` +
        `Investment Amount: ${amt}\n` +
        `Total Offering: Up to $700,000 across a limited group of accredited investors\n` +
        `Interest Rate: ${inv.rate}% per annum, fixed\n` +
        `Payments: Interest-only, paid quarterly in cash\n` +
        `Term: 18–24 months from funding\n` +
        `Repayment: Principal repaid in full at maturity from unit sale proceeds\n` +
        `Security: Second position debt, plus a personal guarantee from the sponsor\n` +
        `Use of Proceeds: Construction of a 25-unit for-sale townhome development in North Corktown, Detroit\n\n` +
        `TERMS OF THIS LETTER\n\n` +
        `1. Non-Binding Effect. Except for the paragraphs titled "Confidentiality" and "Expiration," this letter is a ` +
        `non-binding expression of interest only. It does not create any legal obligation on either party to proceed with ` +
        `the proposed investment. Any binding obligation will arise only upon execution and delivery of definitive ` +
        `documentation, including the Note, mortgage, guarantee, and related agreements (the "Definitive Documents"), ` +
        `in form and substance satisfactory to each party.\n\n` +
        `2. No Offer of Securities. This letter does not constitute an offer to sell or a solicitation of an offer to buy any ` +
        `security. Any offering will be made only to accredited investors through the Definitive Documents and accompanying offering materials.\n\n` +
        `3. Due Diligence. The Investor will have the opportunity to review the offering package, including the note terms, ` +
        `comp book, construction document set, and for-sale proforma, and to consult independent legal, tax, and financial ` +
        `advisors before executing any Definitive Documents.\n\n` +
        `4. Confidentiality. Each party agrees to keep the terms of this letter and any non-public information exchanged in ` +
        `connection with the proposed investment confidential, except as required by law or disclosed to professional advisors ` +
        `on a confidential basis. This paragraph is binding.\n\n` +
        `5. Governing Law. This letter shall be interpreted under the laws of the State of Michigan, without regard to conflict-of-law principles.\n\n` +
        `By adopting an electronic signature below, the Investor confirms that this letter reflects the Investor's current intent.`,
    },
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

export const DOC_COUNT = 4;

/** Fallback shared-library items shown until rows exist in project_documents. */
export const DEFAULT_PROJECT_DOCS = [
  { id: "deck", badge: "PDF", title: "Investor Overview Deck", description: "Capital stack, returns, timeline & risk mitigation", href: null, storage_path: null, sort: 1 },
  { id: "appraisal", badge: "PDF", title: "Independent Appraisal", description: "Certified appraisal · Q2 2026", href: null, storage_path: null, sort: 2 },
  { id: "loan", badge: "PDF", title: "Senior Loan Term Sheet", description: "Construction financing · committed", href: null, storage_path: null, sort: 3 },
  { id: "budget", badge: "XLSX", title: "Detailed Build Budget", description: "Line-item hard & soft costs", href: null, storage_path: null, sort: 4 },
  { id: "plans", badge: "PDF", title: "Architectural Plans", description: "Site plan · Unit floor plans · Renderings", href: null, storage_path: null, sort: 5 },
  { id: "site", badge: "WEB", title: "Project Website", description: "trumbullnorth.com · Public-facing site", href: "https://trumbullnorth.com", storage_path: null, sort: 6 },
];
