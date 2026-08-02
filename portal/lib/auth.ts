import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin check delegated to the database's public.is_admin() function — the
 * same rule RLS enforces. Single source of truth; immune to env-var typos.
 * (To change the admin account, update is_admin() in supabase/schema.sql.)
 */
export async function isAdminUser(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}
