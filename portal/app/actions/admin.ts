"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ADMIN_EMAIL } from "@/lib/supabase/admin";
import { deliverPortalInvite, siteUrl } from "@/lib/invites";
import { sendEmail, emailConfigured, emailFrom, usingSandboxSender, apiKeyFingerprint } from "@/lib/email";
import { isAdminUser } from "@/lib/auth";
import { firstName } from "@/lib/format";
import { PAYMENT_SCHEDULE_KEYS } from "@/lib/docs";
import type { UploadTicket } from "@/lib/investorDocs";
import {
  INVESTOR_DOCS_BUCKET,
  UPDATES_BUCKET,
  investorDocPath,
  isAllowedUpload,
  MAX_UPLOAD_BYTES,
  updatePath,
} from "@/lib/investorDocs";
import type { InvestorStatus, PaymentSchedule } from "@/lib/types";
import type { FormState } from "./auth";

function parsePaymentSchedule(formData: FormData): PaymentSchedule {
  const raw = String(formData.get("paymentSchedule") || "") as PaymentSchedule;
  return PAYMENT_SCHEDULE_KEYS.includes(raw) ? raw : "quarterly";
}

/** Dual-write: the schedule also lives in auth metadata so it persists on
 *  databases where the payment_schedule column migration was never run. */
async function saveScheduleMetadata(
  admin: ReturnType<typeof createAdminClient>,
  authUserId: string | null,
  paymentSchedule: PaymentSchedule
) {
  if (!authUserId) return;
  try {
    await admin.auth.admin.updateUserById(authUserId, {
      app_metadata: { payment_schedule: paymentSchedule },
    });
  } catch {
    // metadata write is best-effort; the row value (or its default) still applies
  }
}

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(supabase))) {
    throw new Error("Not authorized");
  }
  return user;
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/room");
}

export async function createInvestorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const legalName = String(formData.get("legalName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const principal = Number(formData.get("principal"));
  const rate = Number(formData.get("rate")) || 20;
  const term = Number(formData.get("term")) || 20;
  const paymentSchedule = parsePaymentSchedule(formData);

  if (!legalName || !email || !principal) {
    return { error: "Name, email, and principal are required" };
  }

  const admin = createAdminClient();

  // Portal invite with a set-password link — Resend-first, Supabase mailer as
  // backup, manual link as last resort (see lib/invites.ts). Links target our
  // own /auth/confirm with the token hash, avoiding Supabase's redirect hop.
  const invite = await deliverPortalInvite(email, legalName);
  if (!invite.authUserId) {
    return { error: `Invite failed: ${invite.error ?? "could not create the account"}` };
  }

  const baseRow = {
    legal_name: legalName,
    email,
    principal,
    rate,
    term_months: term,
    status: "invited",
    auth_user_id: invite.authUserId,
  };
  let { error: insertError } = await admin
    .from("investors")
    .insert({ ...baseRow, payment_schedule: paymentSchedule });
  if (insertError && /payment_schedule/i.test(insertError.message)) {
    // The payment_schedule migration hasn't been run yet — create the
    // investor anyway; the metadata copy below still records the choice.
    ({ error: insertError } = await admin.from("investors").insert(baseRow));
  }
  if (!insertError) {
    await saveScheduleMetadata(admin, invite.authUserId, paymentSchedule);
  }
  if (insertError) {
    return {
      error:
        insertError.code === "23505"
          ? "An investor with that email already exists."
          : `Could not create investor: ${insertError.message}`,
    };
  }

  const { data: created } = await admin
    .from("investors")
    .select("id")
    .eq("email", email)
    .single();
  if (created) {
    await admin.from("messages").insert({
      investor_id: created.id,
      sender: "admin",
      body:
        `${firstName(legalName)}, welcome to the 3331 Trumbull portal. Your documents will come ` +
        `to you for signature through DocuSign; once they're executed I'll file the signed copies ` +
        `here in your folder.`,
    });
  }

  revalidateAdmin();
  // The link is always surfaced — the portal never depends on email delivery
  // for onboarding. When the email did go out, the link is a backup channel.
  if (invite.inviteLink) {
    return {
      ok: true,
      message: invite.delivered
        ? "Investor created — invite emailed ✓ You can also text or email them this same link yourself:"
        : `Investor created — but the invite email couldn't be sent` +
          `${invite.deliveryError ? ` (${invite.deliveryError})` : ""}. Send them this link yourself:`,
      inviteLink: invite.inviteLink,
    };
  }
  return { ok: true, message: "Investor created — invite sent ✓" };
}

/** Mint a fresh sign-in link for an investor so the admin can deliver it by
 *  any channel (text, email) — works whether or not they've accepted the
 *  original invite, and regardless of email rate limits. */
export async function getInviteLinkAction(investorId: string): Promise<FormState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: investor } = await admin
    .from("investors")
    .select("email, legal_name")
    .eq("id", investorId)
    .maybeSingle();
  if (!investor) return { error: "Investor not found" };

  const base = siteUrl();

  // Links target our own /auth/confirm with the token hash — no dependence on
  // Supabase's redirect allow-list, so they always land inside the portal.
  // 'invite' only works before the user accepts; fall back to a recovery
  // (set-password) link for anyone who already has an account, which also
  // covers "I forgot my password" without needing email delivery at all.
  const { data: inviteData } = await admin.auth.admin.generateLink({
    type: "invite",
    email: investor.email,
    options: { data: { legal_name: investor.legal_name } },
  });
  if (inviteData?.properties?.hashed_token) {
    return {
      ok: true,
      inviteLink: `${base}/auth/confirm?token_hash=${inviteData.properties.hashed_token}&type=invite&next=/auth/set-password`,
    };
  }

  const { data: recoveryData, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: investor.email,
  });
  if (error || !recoveryData?.properties?.hashed_token) {
    return { error: "Couldn't create an invite link — try again." };
  }
  return {
    ok: true,
    inviteLink: `${base}/auth/confirm?token_hash=${recoveryData.properties.hashed_token}&type=recovery&next=/auth/set-password`,
  };
}

/** Admin-only edit of an investor's position (name, principal, rate, term,
 *  payout schedule, status). This changes what the investor sees on their
 *  stats only — the binding terms live in the DocuSign documents, so editing
 *  here never alters an executed document already filed in their folder. */
export async function updateInvestorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const investorId = String(formData.get("investorId") || "");
  const legalName = String(formData.get("legalName") || "").trim();
  const principal = Number(formData.get("principal"));
  const rate = Number(formData.get("rate"));
  const term = Number(formData.get("term"));
  const paymentSchedule = parsePaymentSchedule(formData);
  const statusRaw = String(formData.get("status") || "");
  const status: InvestorStatus = statusRaw === "active" ? "active" : "invited";

  if (!investorId) return { error: "Missing investor." };
  if (!legalName) return { error: "Legal name is required." };
  if (!principal || principal <= 0) return { error: "Principal must be a positive amount." };
  if (!rate || rate <= 0) return { error: "Rate must be a positive percentage." };
  if (!term || term <= 0) return { error: "Term must be a positive number of months." };

  const admin = createAdminClient();
  const baseUpdate = { legal_name: legalName, principal, rate, term_months: term, status };
  let { error } = await admin
    .from("investors")
    .update({ ...baseUpdate, payment_schedule: paymentSchedule })
    .eq("id", investorId);
  if (error && /payment_schedule/i.test(error.message)) {
    // Migration not yet run — save the rest of the edit.
    ({ error } = await admin.from("investors").update(baseUpdate).eq("id", investorId));
  }
  if (error) return { error: `Update failed: ${error.message}` };

  const { data: invRow } = await admin
    .from("investors")
    .select("auth_user_id")
    .eq("id", investorId)
    .maybeSingle();
  await saveScheduleMetadata(admin, invRow?.auth_user_id ?? null, paymentSchedule);

  revalidateAdmin();
  revalidatePath(`/admin/investor/${investorId}`);
  return { ok: true, message: "Investor updated ✓" };
}

/** Phase one of an upload: validates the file and mints a short-lived signed
 *  URL the browser PUTs the bytes to directly. The bytes never pass through
 *  this server — Next caps server-action bodies at 1 MB and Vercel rejects
 *  request bodies over 4.5 MB, which an executed document package can exceed.
 *
 *  Admin-gated, and the object path is chosen here rather than accepted from
 *  the client, so a ticket can only ever write where we put it. */
async function mintUploadTicket(
  bucket: string,
  path: string,
  fileName: string,
  size: number
): Promise<UploadTicket> {
  if (!Number.isFinite(size) || size <= 0) return { error: "That file looks empty." };
  if (size > MAX_UPLOAD_BYTES) {
    return { error: `That file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` };
  }
  if (!isAllowedUpload(fileName)) {
    return { error: "Unsupported file type — upload a PDF, Word, Excel or image file." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    return { error: `Could not start the upload: ${error?.message ?? "no signed URL returned"}` };
  }
  return { ok: true, uploadUrl: data.signedUrl, path };
}

/** Confirms the browser's upload actually landed. Guards the finalize step
 *  against a forged call creating a row for an object that does not exist. */
async function uploadedObjectExists(bucket: string, path: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, 60);
  return !!data?.signedUrl;
}

export async function createInvestorUploadTicket(
  investorId: string,
  fileName: string,
  size: number
): Promise<UploadTicket> {
  await requireAdmin();
  if (!investorId) return { error: "Missing investor." };

  const admin = createAdminClient();
  const { data: investor } = await admin
    .from("investors")
    .select("id")
    .eq("id", investorId)
    .maybeSingle();
  if (!investor) return { error: "Investor not found." };

  return mintUploadTicket(
    INVESTOR_DOCS_BUCKET,
    investorDocPath(investorId, fileName),
    fileName,
    size
  );
}

/** Phase two: files the uploaded object in the investor's folder. */
export async function uploadInvestorDocumentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const investorId = String(formData.get("investorId") || "");
  const storagePath = String(formData.get("storagePath") || "");
  const fileName = String(formData.get("fileName") || "").trim();
  const contentType = String(formData.get("contentType") || "").trim();
  const fileSize = Number(formData.get("fileSize"));
  const title = String(formData.get("title") || "").trim();
  const docType = String(formData.get("docType") || "").trim() || "Other";
  const executedOn = String(formData.get("executedOn") || "").trim();
  const notify = formData.get("notify") === "on";

  if (!investorId || !storagePath || !fileName) return { error: "The upload didn't complete." };
  // The path was minted by createInvestorUploadTicket for this investor; re-check
  // it here so a replayed finalize can't file a document into someone else's folder.
  if (!storagePath.startsWith(`${investorId}/`)) return { error: "That upload doesn't belong to this investor." };
  if (executedOn && !/^\d{4}-\d{2}-\d{2}$/.test(executedOn)) {
    return { error: "Enter the execution date as YYYY-MM-DD." };
  }

  const admin = createAdminClient();
  const { data: investor } = await admin
    .from("investors")
    .select("id, legal_name, email")
    .eq("id", investorId)
    .maybeSingle();
  if (!investor) return { error: "Investor not found." };

  if (!(await uploadedObjectExists(INVESTOR_DOCS_BUCKET, storagePath))) {
    return { error: "The uploaded file couldn't be found — try the upload again." };
  }

  const { error: insertError } = await admin.from("investor_documents").insert({
    investor_id: investorId,
    title: title || fileName.replace(/\.[^.]+$/, ""),
    doc_type: docType,
    file_name: fileName,
    storage_path: storagePath,
    content_type: contentType || null,
    file_size: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null,
    executed_on: executedOn || null,
  });
  if (insertError) {
    await admin.storage.from(INVESTOR_DOCS_BUCKET).remove([storagePath]);
    return { error: `Could not save the document: ${insertError.message}` };
  }

  const docLabel = title || docType;
  // Only documents carrying an execution date are described as executed —
  // wire instructions and investor updates are filed, not signed.
  const docPhrase = executedOn ? `executed ${docLabel}` : docLabel;

  // In-portal notice first — it lands in the thread whether or not email is
  // configured, so the investor always has a record that the file arrived.
  await admin.from("messages").insert({
    investor_id: investorId,
    sender: "admin",
    body: `Your ${docPhrase} has been filed in your document folder.`,
  });

  if (notify) {
    // Best-effort: the document is already filed, so a mail failure must not
    // surface as an upload error.
    try {
      await sendEmail({
        to: investor.email,
        subject: `3331 Trumbull — your ${docPhrase} is in the portal`,
        text:
          `${firstName(investor.legal_name)},\n\n` +
          `Your ${docPhrase} has been filed in your portal folder. You can view or ` +
          `download it anytime: ${siteUrl()}/room\n\n` +
          `Kevin Simpson\nAK Capital Investments\nkevin@akcapital.fund`,
      });
    } catch (e) {
      console.error("document notification email failed", e);
    }
  }

  revalidateAdmin();
  revalidatePath(`/admin/investor/${investorId}`);
  return { ok: true, message: `${docLabel} filed \u2713` };
}

/** Removes an executed document and its stored file. */
export async function deleteInvestorDocumentAction(documentId: string): Promise<FormState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("investor_documents")
    .select("id, investor_id, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };

  const { error } = await admin.from("investor_documents").delete().eq("id", documentId);
  if (error) return { error: "Delete failed — try again." };

  // Storage deletes go through the API (direct SQL on storage tables is
  // blocked by Supabase); a missing object is silently skipped.
  await admin.storage.from(INVESTOR_DOCS_BUCKET).remove([doc.storage_path]);

  revalidateAdmin();
  revalidatePath(`/admin/investor/${doc.investor_id}`);
  return { ok: true, message: "Document removed" };
}

/** Turns the in-portal signature request on or off for one document. Off is
 *  the default: DocuSign is the norm, and this covers the occasional document
 *  that needs a signature without an envelope. */
export async function setSignatureRequestAction(
  documentId: string,
  requested: boolean
): Promise<FormState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("investor_documents")
    .select("id, investor_id, title, signed_at")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Document not found." };
  if (doc.signed_at) return { error: "That document is already signed." };

  const { error } = await admin
    .from("investor_documents")
    .update({ signature_requested: requested })
    .eq("id", documentId);
  if (error) return { error: "Could not update the signature request." };

  if (requested) {
    await admin.from("messages").insert({
      investor_id: doc.investor_id,
      sender: "admin",
      body: `${doc.title} is ready for your signature in the portal.`,
    });
  }

  revalidateAdmin();
  revalidatePath(`/admin/investor/${doc.investor_id}`);
  return {
    ok: true,
    message: requested ? "Signature requested \u2713" : "Signature request cleared",
  };
}

export async function createUpdateUploadTicket(
  investorId: string | null,
  fileName: string,
  size: number
): Promise<UploadTicket> {
  await requireAdmin();
  return mintUploadTicket(UPDATES_BUCKET, updatePath(investorId, fileName), fileName, size);
}

/** Posts a progress report. An update can be a file, a written note, or both;
 *  a null investor means every investor sees it. */
export async function postInvestorUpdateAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const audience = String(formData.get("audience") || "all");
  const investorId = audience === "all" ? null : audience;
  const storagePath = String(formData.get("storagePath") || "").trim();
  const fileName = String(formData.get("fileName") || "").trim();
  const contentType = String(formData.get("contentType") || "").trim();
  const fileSize = Number(formData.get("fileSize"));

  if (!title) return { error: "Give the update a title." };
  if (!body && !storagePath) return { error: "Write a note, attach a file, or both." };
  // The path was minted by createUpdateUploadTicket for this audience; re-check
  // it so a replayed call can't file one investor's update into another's folder.
  if (storagePath && !storagePath.startsWith(`${investorId ?? "all"}/`)) {
    return { error: "That upload doesn't match the chosen audience." };
  }

  const admin = createAdminClient();

  if (investorId) {
    const { data: investor } = await admin
      .from("investors")
      .select("id")
      .eq("id", investorId)
      .maybeSingle();
    if (!investor) return { error: "Investor not found." };
  }

  if (storagePath && !(await uploadedObjectExists(UPDATES_BUCKET, storagePath))) {
    return { error: "The uploaded file couldn't be found — try the upload again." };
  }

  const { error } = await admin.from("investor_updates").insert({
    investor_id: investorId,
    title,
    body: body || null,
    file_name: fileName || null,
    storage_path: storagePath || null,
    content_type: contentType || null,
    file_size: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null,
  });
  if (error) {
    if (storagePath) await admin.storage.from(UPDATES_BUCKET).remove([storagePath]);
    return { error: `Could not post the update: ${error.message}` };
  }

  revalidateAdmin();
  if (investorId) revalidatePath(`/admin/investor/${investorId}`);
  return {
    ok: true,
    message: investorId ? `${title} posted \u2713` : `${title} posted to every investor \u2713`,
  };
}

export async function deleteInvestorUpdateAction(updateId: string): Promise<FormState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: update } = await admin
    .from("investor_updates")
    .select("id, investor_id, storage_path")
    .eq("id", updateId)
    .maybeSingle();
  if (!update) return { error: "Update not found." };

  const { error } = await admin.from("investor_updates").delete().eq("id", updateId);
  if (error) return { error: "Delete failed — try again." };

  if (update.storage_path) {
    await admin.storage.from(UPDATES_BUCKET).remove([update.storage_path]);
  }

  revalidateAdmin();
  if (update.investor_id) revalidatePath(`/admin/investor/${update.investor_id}`);
  return { ok: true, message: "Update removed" };
}

export async function removeInvestorAction(investorId: string): Promise<FormState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: investor } = await admin
    .from("investors")
    .select("auth_user_id")
    .eq("id", investorId)
    .maybeSingle();

  await admin.from("investors").delete().eq("id", investorId);
  if (investor?.auth_user_id) {
    await admin.auth.admin.deleteUser(investor.auth_user_id);
  }

  revalidateAdmin();
  return { ok: true, message: "Investor removed" };
}

export async function adminSendMessage(investorId: string, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const body = String(formData.get("body") || "").trim();
  if (!body) return {};

  const admin = createAdminClient();
  const { error } = await admin
    .from("messages")
    .insert({ investor_id: investorId, sender: "admin", body });
  if (error) return { error: "Message failed to send — try again." };

  revalidateAdmin();
  revalidatePath(`/admin/investor/${investorId}`);
  return { ok: true };
}

export async function broadcastAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Write an update first." };

  const admin = createAdminClient();
  const { data: investors } = await admin.from("investors").select("id");
  const rows = (investors ?? []).map((i) => ({
    investor_id: i.id,
    sender: "admin" as const,
    body,
  }));
  if (rows.length) {
    const { error } = await admin.from("messages").insert(rows);
    if (error) return { error: "Broadcast failed — try again." };
  }

  revalidateAdmin();
  return { ok: true, message: `Sent to ${rows.length} investors ✓` };
}

/** One-click diagnosis for the notification-email pipeline: sends a real
 *  email to the admin through the exact same code path the welcome and
 *  all-docs-signed emails use, and reports Resend's actual verdict. */
export async function sendTestEmailAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireAdmin();

  if (!emailConfigured()) {
    return {
      error:
        "RESEND_API_KEY is not set in Vercel, so no notification emails can be sent " +
        "(welcome, all-documents-signed, subscription alerts). Create a free API key at " +
        "resend.com, add it as RESEND_API_KEY in Vercel → Settings → Environment Variables, " +
        "and redeploy.",
    };
  }

  const result = await sendEmail({
    to: ADMIN_EMAIL,
    subject: "3331 Trumbull portal — test email ✓",
    text:
      `This is a test email from the 3331 Trumbull investor portal.\n\n` +
      `Delivery through Resend works. Notification emails (welcome, all-documents-signed, ` +
      `subscription alerts) use this exact same path.\n\n` +
      `Sender: ${emailFrom()}\n`,
  });
  if (!result.ok) {
    const fingerprint = apiKeyFingerprint();
    const hint =
      fingerprint && /api key/i.test(result.error ?? "")
        ? ` — this deployment's key starts "${fingerprint}". Compare it with the Token column at resend.com/api-keys; if it doesn't match, the value in Vercel is a different/old key: re-paste it and redeploy.`
        : "";
    return { error: `Resend refused the send: ${result.error}${hint}` };
  }
  if (usingSandboxSender()) {
    return {
      ok: true,
      message:
        `Test email sent to ${ADMIN_EMAIL} — but you're still on Resend's sandbox sender ` +
        `(onboarding@resend.dev), which only delivers to your own Resend account email. ` +
        `Investors will receive nothing until you verify a domain in Resend and set ` +
        `EMAIL_FROM in Vercel.`,
    };
  }
  return {
    ok: true,
    message: `Test email sent to ${ADMIN_EMAIL} from ${emailFrom()} — check your inbox (and spam folder).`,
  };
}

export async function markThreadRead(investorId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("investor_id", investorId)
    .eq("sender", "investor")
    .is("read_at", null);
  revalidatePath("/admin");
}
