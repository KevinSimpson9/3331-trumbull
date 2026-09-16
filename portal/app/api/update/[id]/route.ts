import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UPDATES_BUCKET } from "@/lib/investorDocs";
import type { InvestorUpdate } from "@/lib/types";

/**
 * Serves an update's attachment through a short-lived signed URL.
 *
 * The lookup runs on the RLS-scoped client on purpose: the "shared, own, or
 * admin" policy on investor_updates is what decides who may see it, so an
 * investor requesting an update targeted at someone else simply finds nothing.
 * The service-role client is used only afterwards, to sign a row the caller
 * has already been allowed to read.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  const { data: update } = await supabase
    .from("investor_updates")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<InvestorUpdate>();
  if (!update?.storage_path) {
    return NextResponse.redirect(new URL("/room?doc=unavailable", request.url));
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(UPDATES_BUCKET)
    .createSignedUrl(
      update.storage_path,
      60 * 10,
      download && update.file_name ? { download: update.file_name } : undefined
    );

  if (signed?.signedUrl) return NextResponse.redirect(signed.signedUrl);
  return NextResponse.redirect(new URL("/room?doc=unavailable", request.url));
}
