import { badgeFor, fmtFileSize, PROJECT_SITE_URL } from "@/lib/investorDocs";
import { fmtDate } from "@/lib/format";
import type { InvestorUpdate } from "@/lib/types";

/** Progress reports, newest first. An update can be a written note, a file, or
 *  both. The project site sits underneath. */
export default function InvestorUpdatesSection({ updates }: { updates: InvestorUpdate[] }) {
  return (
    <>
      {updates.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-panel-title">No updates yet</div>
          <div className="empty-panel-body">
            Progress reports on the build will appear here as they&apos;re published.
          </div>
        </div>
      ) : (
        <div className="doc-rows">
          {updates.map((u) => (
            <div key={u.id} className="update-row">
              <div className="update-head">
                <div className="update-title">{u.title}</div>
                <div className="update-date">{fmtDate(u.posted_at)}</div>
              </div>
              {u.body && <div className="update-body">{u.body}</div>}
              {u.storage_path && u.file_name && (
                <a className="update-attachment" href={`/api/update/${u.id}`} target="_blank" rel="noopener noreferrer">
                  <span className="doc-glyph">
                    <span className="doc-glyph-badge">{badgeFor(u.file_name)}</span>
                  </span>
                  <span className="update-attachment-main">
                    <span className="update-attachment-name">{u.file_name}</span>
                    <span className="update-attachment-size">{fmtFileSize(u.file_size)}</span>
                  </span>
                  <span className="link-card-arrow">→</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <a
        className="site-button"
        href={PROJECT_SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        See the project website ↗
      </a>
    </>
  );
}
