"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { docDefs } from "@/lib/docs";
import { generateSignedPdf, signedPdfPath, SIGNED_DOCS_BUCKET } from "@/lib/pdf";
import type { DocKey, Investor } from "@/lib/types";
import type { FormState } from "./auth";

async function currentInvestor(): Promise<Investor | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("investors")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return (data as Investor) ?? null;
}

export async function sendInvestorMessage(formData: FormData): Promise<FormState> {
  const body = String(formData.get("body") || "").trim();
  if (!body) return {};

  const investor = await currentInvestor();
  if (!investor) return { error: "Not signed in." };

  const supabase = createClient();
  const { error } = await supabase
    .from("messages")
    .insert({ investor_id: investor.id, sender: "investor", body });
  if (error) return { error: "Message failed to send — try again." };

  revalidatePath("/room");
  return { ok: true };
}

export async function signDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const docKey = String(formData.get("docKey") || "") as DocKey;
  const signerName = String(formData.get("signerName") || "").trim();
  const consent = formData.get("consent") === "on";

  if (!signerName) return { error: "Type your full legal name to sign." };
  if (!consent) return { error: "Please check the e-signature consent box." };

  const investor = await currentInvestor();
  if (!investor) return { error: "Not signed in." };

  const validKeys = docDefs(investor).map((d) => d.key);
  if (!validKeys.includes(docKey)) return { error: "Unknown document." };

  const hdrs = headers();
  const supabase = createClient();
  const { error } = await supabase.from("signatures").insert({
    investor_id: investor.id,
    doc_key: docKey,
    signer_name: signerName,
    user_agent: hdrs.get("user-agent"),
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  if (error) {
    return error.code === "23505"
      ? { error: "This document is already signed." }
      : { error: "Signing failed — try again." };
  }

  const admin = createAdminClient();
  if (investor.status !== "active") {
    await admin.from("investors").update({ status: "active" }).eq("id", investor.id);
  }

  // Generate the executed PDF and store it in the investor's private folder.
  // Failures here never block the signature itself — the signature row is the
  // legal record, and the download route regenerates missing PDFs on demand.
  try {
    const doc = docDefs(investor).find((d) => d.key === docKey)!;
    const pdfBytes = await generateSignedPdf({
      investor,
      doc,
      signerName,
      signedAtISO: new Date().toISOString(),
      ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: hdrs.get("user-agent"),
    });
    await admin.storage
      .createBucket(SIGNED_DOCS_BUCKET, { public: false })
      .catch(() => {}); // already exists
    await admin.storage
      .from(SIGNED_DOCS_BUCKET)
      .upload(signedPdfPath(investor.id, docKey), Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
  } catch (e) {
    console.error("signed-pdf generation failed", e);
  }

  revalidatePath("/room");
  revalidatePath("/admin");
  return { ok: true, message: "Document signed ✓ Saved to your folder" };
}
