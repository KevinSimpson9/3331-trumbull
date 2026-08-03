export type InvestorStatus = "invited" | "active";
export type DocKey = "loi" | "note" | "guarantee" | "accreditation";
export type AccreditationStatus = "accredited" | "non_accredited";
export type Sender = "admin" | "investor";

export interface Investor {
  id: string;
  auth_user_id: string | null;
  legal_name: string;
  email: string;
  principal: number;
  rate: number;
  term_months: number;
  status: InvestorStatus;
  created_at: string;
}

export interface Signature {
  id: string;
  investor_id: string;
  doc_key: DocKey;
  signer_name: string;
  signed_at: string;
  accreditation_status?: AccreditationStatus | null;
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
