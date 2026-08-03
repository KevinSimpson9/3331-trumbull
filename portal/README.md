# 3331 Trumbull — Investor Portal

Private investor portal for the 3331 Trumbull $350K capital raise (AK Capital Investments LLC × Bondy Construction & Design). Rebuilt from the design handoff prototype as a real application: **Next.js (App Router) + Supabase** (auth, Postgres with row-level security, private file storage).

## What it does

- **Investor side** — each investor signs in and sees only their own room: position stats (principal / rate / term / docs signed), three in-portal e-sign documents (Promissory Note, Personal Guarantee Acknowledgment, Accredited Investor Verification), the shared project document library, and a private 1:1 message thread with Kevin.
- **Admin back office** (`kevin@akcapital.fund`) — investor roster with signing progress, add investor (sends a portal invite email with a set-password link), remove investor, per-investor message threads with unread indicators, "message everyone" broadcast, and a bannered "View their portal →" impersonation view.

Access control is enforced in the database with Postgres row-level security: an investor's session can only ever read their own investor row, their own signatures, and their own message thread. The roster, other investors, and aggregate figures are admin-only.

## One-time setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In **SQL Editor**, paste and run `supabase/schema.sql` from this folder. This creates the tables, security policies, the private `project-documents` storage bucket, and seeds the shared document list.
3. In **Authentication → Users**, click **Add user** and create the admin account `kevin@akcapital.fund` with a password (check "Auto confirm user").
4. In **Authentication → URL Configuration**, set the Site URL to the portal's public URL (e.g. `https://portal.trumbullnorth.com`) and add `https://portal.trumbullnorth.com/auth/confirm` to the redirect allow list.
5. In **Authentication → Email Templates**, point the links straight at the portal's confirm route with a token hash — **required** for links to work when Supabase sends the email (the default `{{ .ConfirmationURL }}` bounces through Supabase's verify redirect, which breaks in the recipient's browser and gets consumed by email link scanners):
   - **Invite user** template — replace the link with:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password`
   - **Reset password** template — replace the link with:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/set-password`

   These links carry the one-time token to the set-password screen and only redeem it when the person submits their new password — so the link works on the first try even if a mail scanner pre-opens it, and a password typo never invalidates it.

### 2. Deploy on Vercel

1. In Vercel, **Add New → Project**, import this same GitHub repo (`KevinSimpson9/3331-trumbull`), and set **Root Directory** to `portal/`. Vercel auto-detects Next.js. (The existing marketing-site project keeps serving the repo root — don't touch it.)
2. Add the environment variables from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase → Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — same page (keep secret; server-only)
   - `NEXT_PUBLIC_SITE_URL` — the portal's public URL
   - `ADMIN_EMAIL` — `kevin@akcapital.fund`
3. Deploy, then attach the domain (e.g. `portal.trumbullnorth.com`).

### 3. Upload the project documents

In Supabase → **Storage → project-documents**, upload the shared files with these names (they match the seeded library; edit rows in the `project_documents` table to change titles or filenames):

- `investor-overview-deck.pdf`
- `independent-appraisal.pdf`
- `senior-loan-term-sheet.pdf`
- `detailed-build-budget.xlsx`
- `architectural-plans.pdf`

The "Project Website" card links to trumbullnorth.com. Files are private; the app serves them through short-lived signed URLs to signed-in users only.

## Subscribe funnel (self-service)

The sign-in screen links to **/subscribe**: an interested investor enters their legal name, email, indicative commitment, and investment method. That creates their investor record, emails them the set-password invite, seeds their message thread (so the commitment shows with an unread dot in the back office), and — once they set a password — drops them straight into the room with the Letter of Intent modal open for signature. Set `RESEND_API_KEY` to also send an alert email to the admin and a confirmation email to the subscriber.

## Day-to-day use

- Add an investor from the admin roster → the portal mints a set-password link and emails it (via Resend when `RESEND_API_KEY` is set, otherwise via Supabase's invite email) → the link lands on the portal's set-password screen and stays valid until they actually submit a password → they sign in and see their room. The link is also shown to you as a backup, ready to copy and text.
- If someone's link has gone stale or they never got the email, use **Copy invite link** on their roster row — it mints a fresh set-password link that works whether or not they've ever signed in.
- Signing a document records the typed legal name, timestamp, user agent, and IP in the `signatures` table and flips the investor to Active.
- The gold dot on a thread means the last message is from the investor and unread; opening the thread clears it.

## If invite emails aren't arriving

Work down this list — it covers every delivery path:

1. **Set `RESEND_API_KEY` in Vercel** (Project → Settings → Environment Variables, then redeploy). With it, the portal sends every invite itself — no Supabase email limits.
2. **`EMAIL_FROM` must use a domain verified in Resend** (Resend → Domains). The default `onboarding@resend.dev` sender can only deliver to your own Resend account email — sends to investors fail silently in older builds; the admin screen now shows the exact Resend error when a send fails.
3. **Without Resend, Supabase's built-in mailer is heavily rate-limited** (a few emails per hour) and meant only for testing — configure custom SMTP in Supabase (Authentication → Emails → SMTP settings) for production, and make sure the email templates are updated per step 5 above or the links in those emails won't work.
4. **Every failure still gives you a working link.** Adding an investor always shows a copyable set-password link, and each roster row has **Email invite** (re-sends the email and confirms success or shows the error) and **Copy invite link** (mint a fresh link to text them directly).

## Local development

```bash
cd portal
npm install
cp .env.example .env.local   # fill in your Supabase values
npm run dev
```

## Signed PDFs

Signing a document generates an executed PDF (letterhead, full document text, the adopted cursive signature, timestamp, and an audit block with IP/device) and stores it in the private `signed-documents` storage bucket under the investor's folder — the bucket is created automatically on first use. Both the investor and the admin get a "Download copy →" link next to each signed document; if a stored PDF is ever missing, the download route regenerates it from the signature record.

## Not yet wired (deliberate v1 scope)

- **Email notifications** beyond the Supabase invite/reset emails (e.g. "new message" pings, emailing signed PDFs to both parties) — add a Resend/Postmark integration in the server actions when wanted.
- If invite emails need custom branding or higher volume, configure custom SMTP in Supabase → Authentication → Emails.

## Recommended: point Supabase's auth emails at the portal's confirm route

Supabase's default email templates route clicks through Supabase's own redirect machinery (the source of the "localhost" link problem). For bulletproof links, replace the link in two templates under **Supabase → Authentication → Emails**:

- **Invite user** template — set the link's href to:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password`
- **Reset password** template — set the link's href to:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/set-password`

The admin "Copy invite link" button and the rate-limit fallback link already use this route directly.

## Troubleshooting

- **"Invite failed: email rate limit exceeded" / invites stop arriving** — Supabase's built-in email service only sends a few emails per hour. The admin add-investor flow falls back to showing a manual invite link you can text/email yourself. The permanent fix is custom SMTP via Resend: verify your domain in Resend (Domains → add → create the DNS records at your registrar), then in Supabase → **Project Settings → Authentication → SMTP Settings** enable custom SMTP with host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key, sender e.g. `portal@trumbullnorth.com`. Rate limits effectively disappear and auth emails send from your own domain.
- **Vercel build fails with "No Next.js version detected"** even though Root Directory is `portal`: check that no repo-root `.vercelignore` excludes `portal/` — Vercel strips ignored files from the upload *before* applying the Root Directory, which deletes the app out from under the build. (This bit us once; the root `vercel.json` now handles keeping `/portal` paths off the marketing site instead.)
