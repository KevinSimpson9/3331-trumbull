import { createAdminClient } from "./supabase/admin";
import { isMissingTable } from "./storage";

export interface SetupStatus {
  ready: boolean;
  /** Tables the migration is supposed to create that aren't there yet. */
  missing: string[];
}

const REQUIRED_TABLES = ["investor_documents", "investor_updates"];

/**
 * Checks whether the DocuSign migration has been run. Without it the portal
 * still renders, but every document and update section is empty and uploads
 * fail — which looks like a broken app rather than an unfinished setup. The
 * admin pages use this to say so plainly.
 */
export async function checkSetup(): Promise<SetupStatus> {
  const admin = createAdminClient();
  const results = await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const { error } = await admin.from(table).select("id", { head: true }).limit(1);
      return isMissingTable(error) ? table : null;
    })
  );
  const missing = results.filter((t): t is string => t !== null);
  return { ready: missing.length === 0, missing };
}
