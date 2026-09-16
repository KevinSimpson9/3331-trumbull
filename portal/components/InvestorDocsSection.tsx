import { badgeFor, fmtExecutedOn, fmtFileSize } from "@/lib/investorDocs";
import type { InvestorDocument } from "@/lib/types";

/** Read-only list of an investor's executed documents. Signing happens in
 *  DocuSign; the portal files the completed copies and serves them back. */
export default function InvestorDocsSection({
  documents,
  viewingAs,
}: {
  documents: InvestorDocument[];
  viewingAs?: boolean;
}) {
  if (documents.length === 0) {
    return (
      <div className="empty-panel">
        <div className="empty-panel-title">No documents yet</div>
        <div className="empty-panel-body">
          {viewingAs
            ? "Nothing filed for this investor yet. Upload their DocuSign copies, wire instructions and updates from the back office."
            : "Your documents are sent for signature through DocuSign. Once each one is fully executed, the signed copy is filed here for you to download anytime."}
        </div>
      </div>
    );
  }

  return (
    <div className="doc-rows">
      {documents.map((d) => {
        const executed = fmtExecutedOn(d.executed_on);
        const size = fmtFileSize(d.file_size);
        const meta = [d.doc_type, size].filter(Boolean).join(" · ");
        return (
          <div key={d.id} className="doc-row">
            <div className="doc-glyph">
              <span className="doc-glyph-badge">{badgeFor(d.file_name)}</span>
            </div>
            <div className="doc-row-main">
              <div className="doc-row-title">{d.title}</div>
              <div className="doc-row-desc">{meta}</div>
            </div>
            <span className="doc-row-actions">
              {executed && <span className="signed-chip">✓ Executed {executed}</span>}
              <a
                className="signed-download"
                href={`/api/investor-doc/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View
              </a>
              <a className="signed-download" href={`/api/investor-doc/${d.id}?download=1`}>
                Download →
              </a>
            </span>
          </div>
        );
      })}
    </div>
  );
}
