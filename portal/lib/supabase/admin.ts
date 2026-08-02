import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS — server-side only, and only after the
 * caller's identity/role has been verified.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "kevin@akcapital.fund")
  .trim()
  .toLowerCase();
