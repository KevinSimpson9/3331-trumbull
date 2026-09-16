/** Browser-side half of the two-phase upload.
 *
 *  Files go straight from the browser to Supabase Storage using a short-lived
 *  signed upload URL minted by an admin-gated server action. They deliberately
 *  do NOT travel through a server action: Next caps server-action bodies at
 *  1 MB by default and Vercel rejects any request body over 4.5 MB, so an
 *  executed document package would fail with an opaque error at exactly the
 *  wrong moment. */

/** PUTs the file to a signed upload URL. Mirrors what supabase-js's
 *  uploadToSignedUrl sends, without pulling a browser client into the bundle. */
export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<string | null> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);

  try {
    const res = await fetch(uploadUrl, { method: "PUT", body });
    if (res.ok) return null;
    const detail = await res.text().catch(() => "");
    return `Storage rejected the upload (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`;
  } catch (e) {
    return e instanceof Error ? e.message : "The upload didn't complete — check your connection.";
  }
}
