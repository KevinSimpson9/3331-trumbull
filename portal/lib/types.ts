export type InvestorStatus = "invited" | "active";
export type PaymentSchedule = "monthly" | "quarterly" | "annual" | "maturity";
export type Sender = "admin" | "investor";

export interface Investor {
  id: string;
  auth_user_id: string | null;
  legal_name: string;
  email: string;
  principal: number;
  rate: number;
  term_months: number;
  payment_schedule: PaymentSchedule;
  status: InvestorStatus;
  created_at: string;
}

export type UploadedBy = "admin" | "investor";

/** A document in an investor's private folder: an executed DocuSign copy,
 *  their wire instructions, or banking details they uploaded themselves.
 *  DocuSign holds the signature and audit certificate for anything signed
 *  there. */
export interface InvestorDocument {
  id: string;
  investor_id: string;
  title: string;
  doc_type: string;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  file_size: number | null;
  /** Date of execution in DocuSign (YYYY-MM-DD), not the upload date. */
  executed_on: string | null;
  uploaded_by: UploadedBy;
  /** True when the admin has asked the investor to confirm receipt. This is an
   *  acknowledgment, not a signature: no fields, no placement, and the stored
   *  PDF is never written to. Real signatures go through DocuSign. */
  acknowledgment_requested: boolean;
  acknowledged_name: string | null;
  acknowledged_at: string | null;
  envelope_id: string | null;
  uploaded_at: string;
  sort: number;
}

/** A progress report. `investor_id` null means every investor sees it. An
 *  update can be a file, a written note, or both. */
export interface InvestorUpdate {
  id: string;
  investor_id: string | null;
  title: string;
  body: string | null;
  file_name: string | null;
  storage_path: string | null;
  content_type: string | null;
  file_size: number | null;
  posted_at: string;
}

export interface Message {
  id: string;
  investor_id: string;
  sender: Sender;
  body: string;
  sent_at: string;
  read_at: string | null;
}
