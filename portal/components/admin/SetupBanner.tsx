/** Shown on the admin pages until the DocuSign migration has been run. Without
 *  it the portal renders but stores nothing, so silence would read as a bug. */
export default function SetupBanner({ missing }: { missing: string[] }) {
  return (
    <div className="setup-banner">
      <div className="setup-banner-title">⚠ Finish setup — the database migration hasn&apos;t been run</div>
      <div className="setup-banner-body">
        <p>
          Documents and updates can&apos;t be saved yet: the portal is looking for{" "}
          {missing.map((t, i) => (
            <span key={t}>
              <code>{t}</code>
              {i < missing.length - 1 ? " and " : ""}
            </span>
          ))}
          , which {missing.length === 1 ? "doesn't" : "don't"} exist in Supabase yet. Uploading
          before this is done will fail.
        </p>
        <ol className="setup-steps">
          <li>Open Supabase → your project → <strong>SQL Editor</strong> → New query.</li>
          <li>
            Paste the contents of{" "}
            <code>portal/supabase/migrations/2026-09-16-docusign-documents.sql</code> from the
            repo.
          </li>
          <li>Press <strong>Run</strong>, then reload this page.</li>
        </ol>
        <p className="setup-banner-note">
          It&apos;s safe to run twice. Investor accounts, emails and passwords are not touched.
        </p>
      </div>
    </div>
  );
}
