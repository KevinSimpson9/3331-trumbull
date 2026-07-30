import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves a shared project document to an external link or a short-lived
 * signed URL from the private 'project-documents' storage bucket.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  // RLS limits this select to authenticated users.
  const { data: doc } = await supabase
    .from("project_documents")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (doc?.href) return NextResponse.redirect(doc.href);

  if (doc?.storage_path) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from("project-documents")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (signed?.signedUrl) return NextResponse.redirect(signed.signedUrl);
  }

  return NextResponse.redirect(new URL("/room?doc=unavailable", request.url));
}
