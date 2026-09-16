# 3331 Trumbull — Investor Portal

Private investor portal for the 3331 Trumbull $700K capital raise (AK Capital Investments LLC × Bondy Construction & Design). **Next.js (App Router) + Supabase** (auth, Postgres with row-level security, private file storage).

## How documents work

**Documents are executed in DocuSign, not in this portal.** Investors sign in DocuSign; the completed PDFs are uploaded here from the back office and served back to the investor. The portal is the filing cabinet — DocuSign holds the signature and its audit certificate, and is the sole record of what was signed.

The portal used to generate its own documents and capture a typed-name "signature" on them. That is gone: the document text, the PDF generation, the `signatures` table and the `signed-documents` bucket were all removed, because a self-generated executed PDF sitting alongside a real DocuSign envelope means two conflicting records of what an investor agreed to.

## What it does

- **Investor side** — each investor signs in and sees only their own room: position stats (principal / rate / term / payout schedule), their executed documents to view or download, the shared project document library, and a private 1:1 message thread with Kevin.
- **Admin back office** (`kevin@akcapital.fund`) — investor roster, add/remove investor (invite email with a set-password link), per-investor document filing, the shared project library, per-investor message threads with unread indicators, "message everyone" broadcast, and a bannered impersonation view of any investor's room.

Access control is enforced in the database with Postgres row-level security: an investor's session can only ever read their own investor row, their own documents, and their own message thread. The roster, other investors, and aggregate figures are admin-only.

## One-time setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In **SQL Editor**, paste and run `supabase/schema.sql` from this folder. This creates the tables, security policies, and the two private storage buckets (`project-documents` for the shared library, `investor-documents` for executed documents).

   **Upgrading an existing database instead?** Run `supabase/migrations/2026-09-16-docusign-documents.sql`. It drops the `signatures` table and the `signed-documents` bucket, creates `investor_documents` and its bucket, and clears the seeded shared library. That deletion is deliberate and irreversible — see "How documents work" above.
3. In **Authentication → Users**, click **Add user** and create the admin account `kevin@akcapital.fund` with a password (check "Auto confirm user").
4. In **Authentication → URL Configuration**, set the Site URL to the portal's public URL (e.g. `https://portal.trumbullnorth.com`) and add `https://portal.trumbullnorth.com/auth/confirm` to the redirect allow list.

### 2. Deploy on Vercel

1. In Vercel, **Add New → Project**, import this same GitHub repo (`KevinSimpson9/3331-trumbull`), and set **Root Directory** to `portal/`. Vercel auto-detects Next.js. (The existing marketing-site project keeps serving the repo root — don't touch it.)
2. Add the environment variables from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase → Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — same page (keep secret; server-only)
   - `NEXT_PUBLIC_SITE_URL` — the portal's public URL
   - `ADMIN_EMAIL` — `kevin@akcapital.fund`
3. Deploy, then attach the domain (e.g. `portal.trumbullnorth.com`).

### 3. Add the project documents

The shared library starts empty. Add each item from the admin dashboard's **Project document library** card — upload a file, or point a card at an external link (that's how the trumbullnorth.com card works). No trip through the Supabase dashboard.

Files are private; the app serves them through short-lived signed URLs to signed-in users only.

## Subscribe funnel (self-service)

The sign-in screen links to **/subscribe**: an interested investor enters their legal name, email, indicative commitment, and investment method. That creates their investor record, emails them the set-password invite, seeds their message thread (so the commitment shows with an unread dot in the back office), and drops them into their room once they set a password. Sending them documents to sign is a separate, deliberate step you take in DocuSign. Set `RESEND_API_KEY` to also send an alert email to the admin and a confirmation email to the subscriber.

## Email: how it works (and works without it)

The portal **never depends on email delivery** for a critical flow:

- Adding an investor always shows the set-password link on screen — text or email it yourself if the automatic email doesn't go out.
- A self-service subscriber whose invite email can't be sent is redirected straight into their own create-password screen instead of waiting on an empty inbox.
- The roster's "Copy invite link" mints a fresh link anytime — a set-password invite for new investors, a password-reset link for existing ones (covers "I forgot my password" with zero email).
- Filing a document always posts a note in the investor's message thread, whether or not the notification email goes out.

Automatic email (invites, resets, welcome, document-filed notices, subscription alerts) requires Resend. The **Email delivery card at the bottom of the admin dashboard** shows live status, a guided setup checklist, a "send me a test email" button, and a log of every send attempt with the exact provider error on failure — nothing fails silently.

## Day-to-day use

- Add an investor from the admin roster → they receive an invite email → the link lands on a "You're invited — continue to create your password" screen → one click takes them to set-password, then straight into their room. (The link is verified only on that click, not on page load — email security scanners prefetch every link in an email, and verifying on load let them burn the single-use token before the investor ever clicked.)
- An expired or already-used link shows a "this link has expired" screen with a self-service "email me a fresh link" form — investors never dead-end.
- Once the investor sets their password they get a welcome email.
- Send documents for signature in DocuSign. When an envelope completes, download the combined PDF and upload it from **Documents & portal →** on the investor's roster row: give it a title, a type, the execution date, and optionally email the investor that it landed.
- Investor status (Invited / Active) is set by hand on the Edit form. The portal doesn't witness signatures any more, so it can't infer it — flip an investor to Active once their position is executed and funded.
- The gold dot on a thread means the last message is from the investor and unread; opening the thread clears it.

## Local development

```bash
cd portal
npm install
cp .env.example .env.local   # fill in your Supabase values
npm run dev
```

## How uploads work (and why they're two-phase)

File bytes go **browser → Supabase Storage directly**, never through a server action. Next caps server-action request bodies at 1 MB by default, and Vercel rejects any request body over 4.5 MB no matter what Next is configured to allow — an executed document package can easily exceed both, and it would fail with an opaque error at exactly the wrong moment.

So an upload is two steps:

1. An admin-gated server action validates the file and mints a short-lived signed upload URL (`createInvestorUploadTicket` / `createProjectUploadTicket` in `app/actions/admin.ts`). The object path is chosen server-side, so a ticket can only ever write where we put it.
2. The browser PUTs the bytes to that URL (`lib/upload.ts`), then a second server action files the metadata, after confirming the object really landed.

The ceiling is `MAX_UPLOAD_BYTES` in `lib/investorDocs.ts` (25 MB), bounded above by the file-size limit on the Supabase bucket.

If a browser dies between the upload and the filing step, the object is left in the bucket with no row pointing at it — invisible to everyone, and harmless. Clear them from Supabase → Storage if they ever accumulate.

## Not yet wired (deliberate scope)

- **DocuSign API / Connect** — envelopes are sent and downloaded by hand today. The `investor_documents` table already carries an unused `envelope_id` column, so status sync can be added later without a schema rewrite.
- **Email notifications** beyond invites/resets, the post-setup welcome email, and the document-filed notice (e.g. "new message" pings) — extend the Resend integration in the server actions when wanted.
- If invite emails need custom branding or higher volume, configure custom SMTP in Supabase → Authentication → Emails.

## Recommended: point Supabase's auth emails at the portal's confirm route

Supabase's default email templates route clicks through Supabase's own redirect machinery (the source of the "localhost" link problem). For bulletproof links, replace the link in two templates under **Supabase → Authentication → Emails**:

- **Invite user** template — set the link's href to:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password`
- **Reset password** template — set the link's href to:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/set-password`

The admin "Copy invite link" button and the rate-limit fallback link already use this route directly.

## Troubleshooting

- **Invite link lands on the sign-in page instead of "create your password"** — fixed: /auth/confirm is now an interstitial that only consumes the single-use token when the investor clicks Continue, so email-scanner prefetch can't burn it. If an old link was already burned, the investor sees the "link expired" screen and can email themselves a fresh one.
- **An upload fails or hangs** — the bytes go straight to Supabase, so check the bucket's file-size limit in Supabase → Storage → Configuration first. A "Storage rejected the upload" message carries the status code Supabase returned.
- **Welcome / notification emails aren't arriving but invites show "sent ✓"** — almost always Resend's sandbox sender: without a verified domain and `EMAIL_FROM`, `onboarding@resend.dev` only delivers to your own Resend account email. Delivery failures are now logged in Vercel's function logs with Resend's actual error, and the add-investor form shows the real reason alongside the manual link. Fix: verify `trumbullnorth.com` (or `akcapital.fund`) in Resend → Domains, then set `EMAIL_FROM` in Vercel, e.g. `3331 Trumbull Portal <portal@trumbullnorth.com>`.
- **"Invite failed: email rate limit exceeded" / invites stop arriving** — Supabase's built-in email service only sends a few emails per hour. With `RESEND_API_KEY` set, the portal never touches it — invites and password resets are minted with `generateLink` and sent through Resend (`lib/invites.ts`), so the rate limit disappears. Without Resend, the admin add-investor flow falls back to showing a manual invite link you can text/email yourself, and the public /subscribe flow still records the subscription (with the link available from the roster's "Copy invite link") instead of erroring. The permanent fix is custom SMTP via Resend: verify your domain in Resend (Domains → add → create the DNS records at your registrar), then set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `3331 Trumbull Portal <portal@trumbullnorth.com>`) in Vercel. Note Resend's default `onboarding@resend.dev` sender only delivers to your own Resend account email — a verified domain is required to email real investors. Optionally also configure custom SMTP in Supabase → **Project Settings → Authentication → SMTP Settings** (host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key) so the Supabase-mailer fallback path is unlimited too.
- **Vercel build fails with "No Next.js version detected"** even though Root Directory is `portal`: check that no repo-root `.vercelignore` excludes `portal/` — Vercel strips ignored files from the upload *before* applying the Root Directory, which deletes the app out from under the build. (This bit us once; the root `vercel.json` now handles keeping `/portal` paths off the marketing site instead.)
