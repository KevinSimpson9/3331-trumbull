import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVESTOR_DOCS_BUCKET } from "@/lib/investorDocs";
import type { InvestorDocument } from "@/lib/types";

/**
 * Serves an executed document through a short-lived signed URL.
 *
 * The lookup runs on the RLS-scoped client on purpose: the "own or admin"
 * policy on investor_documents is what enforces ownership, so an investor
 * requesting someone else's document id simply finds nothing. The service-role
 * client is used only afterwards, to mint the signed URL for a row the caller
 * has already been allowed to read.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  const { data: doc } = await supabase
    .from("investor_documents")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<InvestorDocument>();
  if (!doc) return NextResponse.redirect(new URL("/room?doc=unavailable", request.url));

  const download = new URL(request.url).searchParams.get("download") === "1";
  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(INVESTOR_DOCS_BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 10, download ? { download: doc.file_name } : undefined);

  if (signed?.signedUrl) return NextResponse.redirect(signed.signedUrl);
  return NextResponse.redirect(new URL("/room?doc=unavailable", request.url));
}
