import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase returns this when the bucket in the path doesn't exist. The
 *  message is opaque ("The related resource does not exist"), so it is matched
 *  here once rather than leaked into the UI. */
function isMissingBucket(error: { message?: string } | null): boolean {
  const m = error?.message ?? "";
  return /bucket not found|related resource does not exist|does not exist/i.test(m);
}

/**
 * Mints a signed upload URL, creating the private bucket first if it isn't
 * there yet. The buckets are created by the migration, but a portal that
 * refuses uploads until someone opens the Supabase dashboard is a portal that
 * looks broken, so this heals the storage half on first use.
 */
export async function signedUploadUrl(
  admin: SupabaseClient,
  bucket: string,
  path: string
): Promise<{ url?: string; error?: string }> {
  const attempt = () => admin.storage.from(bucket).createSignedUploadUrl(path);

  let { data, error } = await attempt();

  if (error && isMissingBucket(error)) {
    const { error: createError } = await admin.storage.createBucket(bucket, { public: false });
    // A parallel request may have created it a moment earlier; that's fine.
    if (createError && !/already exists/i.test(createError.message)) {
      return {
        error:
          `Storage isn't set up yet. Run the database migration in Supabase ` +
          `(SQL Editor → portal/supabase/migrations/2026-09-16-docusign-documents.sql), ` +
          `then try again. [${createError.message}]`,
      };
    }
    ({ data, error } = await attempt());
  }

  if (error || !data?.signedUrl) {
    return { error: `Could not start the upload: ${error?.message ?? "no signed URL returned"}` };
  }
  return { url: data.signedUrl };
}

/**
 * True when the error means the table hasn't been created yet.
 *
 * Two shapes, because PostgREST answers from a schema cache rather than always
 * hitting Postgres: PGRST205 ("Could not find the table … in the schema cache")
 * and Postgres's own 42P01 ("relation … does not exist"). Matching only one
 * leaves the setup banner silent, which is the failure this exists to prevent.
 */
export function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const m = error.message ?? "";
  return (
    /relation .* does not exist/i.test(m) ||
    /could not find the table/i.test(m) ||
    /schema cache/i.test(m)
  );
}
