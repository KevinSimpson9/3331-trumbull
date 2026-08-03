import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/auth";
import { docDefs } from "@/lib/docs";
import { generateSignedPdf, signedPdfPath, SIGNED_DOCS_BUCKET } from "@/lib/pdf";
import type { Investor, Signature } from "@/lib/types";

/**
 * Downloads the executed PDF for a signed document.
 * - Investors can fetch only their own (?investor is ignored for them).
 * - The admin can fetch any investor's via ?investor=<id>.
 * - If the stored PDF is missing (signature predates PDF generation), it is
 *   regenerated from the signature record and stored, then served.
 */
export async function GET(request: NextRequest, { params }: { params: { docKey: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  const isAdmin = await isAdminUser(supabase);
  const admin = createAdminClient();

  let investor: Investor | null = null;
  if (isAdmin) {
    const investorId = new URL(request.url).searchParams.get("investor");
    if (investorId) {
      const { data } = await admin
        .from("investors")
        .select("*")
        .eq("id", investorId)
        .maybeSingle<Investor>();
      investor = data;
    }
  } else {
    const { data } = await supabase
      .from("investors")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle<Investor>();
    investor = data;
  }
  if (!investor) return NextResponse.redirect(new URL("/", request.url));

  // The signature must exist — the RLS-scoped client enforces ownership for
  // investors; the admin client is used only after the admin check above.
  const { data: signature } = await (isAdmin ? admin : supabase)
    .from("signatures")
    .select("*")
    .eq("investor_id", investor.id)
    .eq("doc_key", params.docKey)
    .maybeSingle<Signature>();
  if (!signature) return NextResponse.redirect(new URL("/room", request.url));

  const path = signedPdfPath(investor.id, signature.doc_key);

  const signedUrl = async () =>
    (await admin.storage.from(SIGNED_DOCS_BUCKET).createSignedUrl(path, 60 * 10)).data
      ?.signedUrl ?? null;

  let url = await signedUrl();
  if (!url) {
    // Regenerate from the legal record (covers pre-feature signatures).
    const doc = docDefs(investor).find((d) => d.key === signature.doc_key);
    if (doc) {
      const pdfBytes = await generateSignedPdf({
        investor,
        doc,
        signerName: signature.signer_name,
        signedAtISO: signature.signed_at,
        ip: signature.ip ?? null,
        userAgent: signature.user_agent ?? null,
        countersign:
          signature.countersigned_at && signature.countersigner_name
            ? {
                name: signature.countersigner_name,
                signedAtISO: signature.countersigned_at,
                ip: signature.countersign_ip ?? null,
                userAgent: signature.countersign_user_agent ?? null,
              }
            : null,
      });
      await admin.storage.createBucket(SIGNED_DOCS_BUCKET, { public: false }).catch(() => {});
      await admin.storage.from(SIGNED_DOCS_BUCKET).upload(path, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
      url = await signedUrl();
    }
  }

  if (url) return NextResponse.redirect(url);
  return NextResponse.redirect(new URL("/room?doc=unavailable", request.url));
}
