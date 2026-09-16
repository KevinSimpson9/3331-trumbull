"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ADMIN_EMAIL } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/invites";
import {
  INVESTOR_DOCS_BUCKET,
  investorDocPath,
  isAllowedUpload,
  MAX_UPLOAD_BYTES,
  type UploadTicket,
} from "@/lib/investorDocs";
import type { Investor, InvestorDocument } from "@/lib/types";
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

/**
 * Phase one of an investor's own upload (banking details for ACH or wire
 * setup). Scoped to the signed-in investor: the path is derived from their own
 * row, never from anything the browser sends, so a ticket can only ever write
 * into that investor's folder.
 */
export async function createSelfUploadTicket(
  fileName: string,
  size: number
): Promise<UploadTicket> {
  const investor = await currentInvestor();
  if (!investor) return { error: "Not signed in." };

  if (!Number.isFinite(size) || size <= 0) return { error: "That file looks empty." };
  if (size > MAX_UPLOAD_BYTES) {
    return { error: `That file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` };
  }
  if (!isAllowedUpload(fileName)) {
    return { error: "Unsupported file type — upload a PDF, Word, Excel or image file." };
  }

  const path = investorDocPath(investor.id, fileName);
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(INVESTOR_DOCS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    return { error: "Could not start the upload — try again." };
  }
  return { ok: true, uploadUrl: data.signedUrl, path };
}

/** Phase two: files the investor's own upload in their folder and tells Kevin. */
export async function uploadOwnDocumentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const investor = await currentInvestor();
  if (!investor) return { error: "Not signed in." };

  const storagePath = String(formData.get("storagePath") || "");
  const fileName = String(formData.get("fileName") || "").trim();
  const contentType = String(formData.get("contentType") || "").trim();
  const fileSize = Number(formData.get("fileSize"));
  const title = String(formData.get("title") || "").trim();
  const docType = String(formData.get("docType") || "").trim() || "Bank Information";

  if (!storagePath || !fileName) return { error: "The upload didn't complete." };
  // The ticket minted this path from the investor's own row; re-check it so a
  // replayed call can't drop a file into someone else's folder.
  if (!storagePath.startsWith(`${investor.id}/`)) {
    return { error: "That upload doesn't belong to you." };
  }

  const admin = createAdminClient();
  const { data: exists } = await admin.storage
    .from(INVESTOR_DOCS_BUCKET)
    .createSignedUrl(storagePath, 60);
  if (!exists?.signedUrl) {
    return { error: "The uploaded file couldn't be found — try the upload again." };
  }

  const { error } = await admin.from("investor_documents").insert({
    investor_id: investor.id,
    title: title || fileName.replace(/\.[^.]+$/, ""),
    doc_type: docType,
    file_name: fileName,
    storage_path: storagePath,
    content_type: contentType || null,
    file_size: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null,
    uploaded_by: "investor",
  });
  if (error) {
    await admin.storage.from(INVESTOR_DOCS_BUCKET).remove([storagePath]);
    return { error: "Could not save the document — try again." };
  }

  const label = title || docType;

  // In-portal notice first, so the upload shows in the back office with the
  // unread dot whether or not email delivery is working.
  await admin.from("messages").insert({
    investor_id: investor.id,
    sender: "investor",
    body: `Uploaded ${label} to my document folder.`,
  });

  try {
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `${investor.legal_name} uploaded ${label}`,
      text:
        `${investor.legal_name} (${investor.email}) uploaded ${label} to their portal folder.\n\n` +
        `Their room: ${siteUrl()}/admin/investor/${investor.id}\n`,
    });
  } catch (e) {
    console.error("investor upload notification failed", e);
  }

  revalidatePath("/room");
  revalidatePath("/admin");
  revalidatePath(`/admin/investor/${investor.id}`);
  return { ok: true, message: `${label} uploaded ✓` };
}

/** Lets an investor remove a file they uploaded themselves. Documents filed by
 *  the admin are not theirs to delete. */
export async function deleteOwnDocumentAction(documentId: string): Promise<FormState> {
  const investor = await currentInvestor();
  if (!investor) return { error: "Not signed in." };

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("investor_documents")
    .select("id, investor_id, storage_path, uploaded_by")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.investor_id !== investor.id) return { error: "Document not found." };
  if (doc.uploaded_by !== "investor") {
    return { error: "Only files you uploaded yourself can be removed here." };
  }

  const { error } = await admin.from("investor_documents").delete().eq("id", documentId);
  if (error) return { error: "Delete failed — try again." };
  await admin.storage.from(INVESTOR_DOCS_BUCKET).remove([doc.storage_path]);

  revalidatePath("/room");
  revalidatePath("/admin");
  revalidatePath(`/admin/investor/${investor.id}`);
  return { ok: true, message: "Document removed" };
}

/**
 * Records an investor's confirmation that they received and reviewed a
 * document. Only available where the admin asked for one.
 *
 * This is deliberately NOT a signature. There is no field placement, and the
 * uploaded PDF is never altered — the confirmation is a record attached to it,
 * carrying the typed name, time, IP and device. Anything that needs a real
 * signature goes through DocuSign, which holds its own audit certificate.
 */
export async function acknowledgeDocumentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const documentId = String(formData.get("documentId") || "");
  const signerName = String(formData.get("signerName") || "").trim();
  const consent = formData.get("consent") === "on";

  if (!signerName) return { error: "Type your full legal name to confirm." };
  if (!consent) return { error: "Please check the confirmation box." };

  const investor = await currentInvestor();
  if (!investor) return { error: "Not signed in." };

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("investor_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle<InvestorDocument>();
  if (!doc || doc.investor_id !== investor.id) return { error: "Document not found." };
  if (!doc.acknowledgment_requested) {
    return { error: "That document isn't awaiting confirmation." };
  }
  if (doc.acknowledged_at) return { error: "That document is already confirmed." };

  const hdrs = headers();
  const { error } = await admin
    .from("investor_documents")
    .update({
      acknowledged_name: signerName,
      acknowledged_at: new Date().toISOString(),
      acknowledged_ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      acknowledged_user_agent: hdrs.get("user-agent"),
      acknowledgment_requested: false,
    })
    .eq("id", documentId)
    .is("acknowledged_at", null);
  if (error) return { error: "That didn't go through — try again." };

  await admin.from("messages").insert({
    investor_id: investor.id,
    sender: "investor",
    body: `Confirmed receipt of ${doc.title}.`,
  });

  try {
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `${investor.legal_name} confirmed receipt of ${doc.title}`,
      text:
        `${investor.legal_name} (${investor.email}) confirmed receipt of ${doc.title} in the ` +
        `portal as "${signerName}".\n\nTheir room: ${siteUrl()}/admin/investor/${investor.id}\n`,
    });
  } catch (e) {
    console.error("acknowledgment notification failed", e);
  }

  revalidatePath("/room");
  revalidatePath("/admin");
  revalidatePath(`/admin/investor/${investor.id}`);
  return { ok: true, message: "Receipt confirmed ✓" };
}
