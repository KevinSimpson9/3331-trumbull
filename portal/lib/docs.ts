import type { PaymentSchedule } from "./types";

/** Payout options selectable per investor in the admin forms. `label` is the
 *  dropdown text, `short` the roster chip. The binding wording lives in the
 *  DocuSign documents, not here. */
export const PAYMENT_SCHEDULES: Record<PaymentSchedule, { label: string; short: string }> = {
  monthly: { label: "Interest paid monthly", short: "Monthly" },
  quarterly: { label: "Interest paid quarterly", short: "Quarterly" },
  annual: { label: "Interest paid annually", short: "Annual" },
  maturity: { label: "Interest paid at maturity", short: "At maturity" },
};

export const PAYMENT_SCHEDULE_KEYS = Object.keys(PAYMENT_SCHEDULES) as PaymentSchedule[];
