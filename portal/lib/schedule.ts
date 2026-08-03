import { createAdminClient } from "./supabase/admin";
import { PAYMENT_SCHEDULE_KEYS } from "./docs";
import type { Investor, PaymentSchedule } from "./types";

/** The payout schedule is dual-written: to investors.payment_schedule when
 *  that column exists, and always to the investor's auth metadata. Metadata
 *  wins on read because it is written on every save even on databases where
 *  the column migration was never run. Server-side only. */
export async function effectiveSchedule(inv: Investor): Promise<PaymentSchedule> {
  if (inv.auth_user_id) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.getUserById(inv.auth_user_id);
      const meta = data?.user?.app_metadata?.payment_schedule as PaymentSchedule | undefined;
      if (meta && PAYMENT_SCHEDULE_KEYS.includes(meta)) return meta;
    } catch {
      // fall through to the row value
    }
  }
  return inv.payment_schedule ?? "quarterly";
}

/** Returns the investor with payment_schedule resolved to its effective value. */
export async function withEffectiveSchedule(inv: Investor): Promise<Investor> {
  return { ...inv, payment_schedule: await effectiveSchedule(inv) };
}
