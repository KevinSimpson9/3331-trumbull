# 3331 Trumbull — Investor Portal

Private investor portal for the 3331 Trumbull $700K capital raise (AK Capital Investments LLC × Bondy Construction & Design). **Next.js (App Router) + Supabase** (auth, Postgres with row-level security, private file storage).

## How documents work

**Documents are executed in DocuSign, not in this portal.** Investors sign in DocuSign; the completed PDFs are uploaded here from the back office and served back to the investor. The portal is the filing cabinet — DocuSign holds the signature and its audit certificate, and is the sole record of what was signed.

The portal used to generate its own documents and capture a typed-name "signature" on them. That is gone: the document text, the PDF generation, the `signatures` table and the `signed-documents` bucket were all removed, because a self-generated executed PDF sitting alongside a real DocuSign envelope means two conflicting records of what an investor agreed to.

## What it does

- **Investor side** — each investor signs in and sees only their own room:
  - **Investor documents** — their executed DocuSign copies and wire instructions, plus anything they upload themselves (banking details for ACH or wire setup). Occasionally a document needs a signature without a DocuSign envelope; when you request one, they sign it here.
  - **Investor updates** — progress reports, newest first, with the project website linked underneath.
  - **Messages** — a private 1:1 thread with Kevin.
- **Admin back office** (`kevin@akcapital.fund`) — investor roster, add/remove investor, per-investor document filing and signature requests, investor updates posted to everyone or to one person, message threads with unread indicators, "message everyone" broadcast, and a bannered impersonation view of any investor's room.

Access control is enforced in the database with Postgres row-level security: an investor's session can only ever read their own investor row, their own documents, their own message thread, and updates either shared with everyone or addressed to them. The roster, other investors, and aggregate figures are admin-only.

## What goes in an investor's folder

The standard package, filed per-investor after DocuSign completion:

- Promissory Note
- Guaranty
- Subscription Agreement
- Offering Memorandum
- Wire Instructions

Wire instructions aren't signed, so leave the execution date blank when filing them — the room shows the "✓ Executed" chip only on documents that carry one.

Investors can add their own files to the same folder (bank details, a voided check) from **+ Upload a document** in their room. Those land in their private folder, post a note in your thread, and email you. They can delete a file they uploaded; they can't touch anything you filed.

## Requesting confirmation of receipt

**Every signature happens in DocuSign.** The portal does not sign anything.

What it does have is a receipt. Upload a document and hit **Request confirmation** on its row; the investor gets a note in their thread and a "Review & confirm" button in their room. Confirming records their typed legal name, the timestamp, IP and device against that document.

Be precise about what this is and isn't:

- It is **not a signature**. There is no field placement — you cannot choose where on the page they sign, and there are no signature, initial, date or text fields. The confirmation applies to the whole document or not at all.
- The uploaded PDF is **never altered**. Nothing is stamped into it. The confirmation is a row in the database pointing at the file, not a new executed PDF, and there is no audit certificate.
- Use it for receipts and consents. **Never for the note, the guaranty, or the subscription agreement** — those go through DocuSign, which does field placement properly and issues an audit certificate.

If you ever need placed fields inside the portal, the honest fix is wiring the DocuSign API so envelopes are sent from here and completed documents file themselves back, not rebuilding a signature tool alongside the one you already pay for.

## Investor updates

An update is a written note, a file, or both. Posted from the dashboard it goes to **every investor** — one row, one file, no duplication across the roster. Posted from an investor's own page it goes to that person only. Deleting one removes it for everyone who could see it.

## Tests

```bash
cd portal
npm run lint          # eslint, next/core-web-vitals
npx tsc --noEmit      # types
npm run build         # production build
```

`supabase/tests/rls.sql` is a row-level-security regression test. Run it against a throwaway database, never production. It asserts that an investor reaches only their own row, documents, thread, and updates addressed to them or shared with everyone, and that a signed-out caller reaches nothing at all.

That last case caught a real hole: an earlier version of the updates policy read `is_admin() or investor_id is null or ...`, which is true for anonymous callers. Since the anon key ships in the browser bundle, every broadcast update and its attachment were readable straight off the REST API. The policy now requires the caller to be an actual investor before the "shared" branch applies.

## Security posture

The portal holds executed documents and investors' banking details, so:

- **Deny by default.** `middleware.ts` requires a session for every route except the sign-in page, the auth routes that exist to get you one, and `/subscribe`. A new route is protected the moment it is added.
- **Row-level security** is the real gate on every read; the app's own checks sit on top of it, not instead of it.
- **Private buckets.** Files are never public. Each download is a signed URL valid for ten minutes, minted only after the caller has been allowed to read the row.
- **Headers** on every response (`next.config.mjs`): `noindex` for crawlers, `frame-ancestors 'none'` and `X-Frame-Options: DENY` against clickjacking, `Referrer-Policy: no-referrer` so a signed URL can't leak through a click-through, HSTS, and `nosniff`. `app/robots.ts` disallows everything.

**`/subscribe` is the one public page.** Anyone who finds the URL can create an account. That is how the self-service funnel is meant to work, but if the portal should be invite-only, delete `app/subscribe/`, drop the `/subscribe` entry from the public list in `middleware.ts`, and remove the link on the sign-in screen.

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

### 3. First run

Nothing to seed. Add an investor from the roster, file their documents once DocuSign completes, and post your first update.

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
- Post updates from the dashboard's **Investor updates** card. From an investor's own page the same card posts to that person only.
- When an investor uploads their banking details, it shows in their folder marked "uploaded by them", lands in your thread with the unread dot, and emails you.
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

1. A server action validates the file and mints a short-lived signed upload URL. `createInvestorUploadTicket` and `createUpdateUploadTicket` in `app/actions/admin.ts` are admin-gated; `createSelfUploadTicket` in `app/actions/investor.ts` is scoped to the signed-in investor and derives the path from their own row. Either way the object path is chosen server-side, so a ticket can only ever write where we put it, and the finalize step re-checks the path prefix before filing anything.
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
