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

/** An executed document uploaded to an investor's private folder after it was
 *  signed in DocuSign. The portal stores and serves it; DocuSign holds the
 *  signature and its audit certificate. */
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
  envelope_id: string | null;
  uploaded_at: string;
  sort: number;
}

export interface Message {
  id: string;
  investor_id: string;
  sender: Sender;
  body: string;
  sent_at: string;
  read_at: string | null;
}

export interface ProjectDocument {
  id: string;
  title: string;
  description: string | null;
  badge: string;
  href: string | null;
  storage_path: string | null;
  sort: number;
}
