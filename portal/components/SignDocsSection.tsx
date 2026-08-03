"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signDocument } from "@/app/actions/investor";
import type { FormState } from "@/app/actions/auth";
import { useToast } from "@/components/Toast";

export interface SignDocVM {
  key: string;
  badge: string;
  title: string;
  desc: string;
  body: string;
  signedAt: string | null; // formatted date label when signed
}

interface Props {
  docs: SignDocVM[];
  legalName: string;
  todayLabel: string;
  viewingAs?: boolean;
  /** Query string for the signed-copy download link ("" for the investor,
   *  "?investor=<id>" when the admin is viewing a room). */
  downloadQuery?: string;
  /** Doc key whose signing modal opens automatically when still unsigned. */
  autoOpenKey?: string;
}

function AdoptButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Signing…" : "Adopt signature & sign"}
    </button>
  );
}

function SignModal({
  doc,
  legalName,
  todayLabel: today,
  onClose,
}: {
  doc: SignDocVM;
  legalName: string;
  todayLabel: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [sigName, setSigName] = useState(legalName);
  const [state, formAction] = useFormState<FormState, FormData>(signDocument, {});

  useEffect(() => {
    if (state.ok) {
      toast(state.message || "Document signed ✓ Saved to your folder");
      onClose();
    }
  }, [state, toast, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="modal-eyebrow">E-SIGNATURE</div>
            <div className="modal-title">{doc.title}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            Close ✕
          </button>
        </div>
        <form action={formAction} className="modal-body">
          <input type="hidden" name="docKey" value={doc.key} />
          <div className="paper">
            <div className="paper-title">{doc.title}</div>
            <div className="paper-body">{doc.body}</div>
          </div>
          {doc.key === "accreditation" && (
            <div className="field">
              <label className="label">SELECT YOUR INVESTOR STATUS — BOTH ARE ACCEPTABLE</label>
              <label className="consent-row">
                <input type="radio" name="accreditationStatus" value="accredited" />
                <span>
                  Accredited investor — I meet at least one of the SEC Rule 501 income,
                  net-worth, or professional-certification standards.
                </span>
              </label>
              <label className="consent-row">
                <input type="radio" name="accreditationStatus" value="non_accredited" />
                <span>
                  Non-accredited investor — I do not currently meet an SEC Rule 501 standard,
                  and I can evaluate the merits and risks of this investment.
                </span>
              </label>
            </div>
          )}
          <div className="field">
            <label className="label">TYPE YOUR FULL LEGAL NAME TO SIGN</label>
            <input
              name="signerName"
              className="input"
              placeholder="Full legal name"
              value={sigName}
              onChange={(e) => setSigName(e.target.value)}
              style={{ padding: "12px 14px" }}
            />
          </div>
          <div className="sig-box">
            <div className="sig-script">{sigName || " "}</div>
            <div className="sig-box-meta">
              SIGNATURE PREVIEW
              <br />
              {today}
            </div>
          </div>
          <label className="consent-row">
            <input type="checkbox" name="consent" />
            <span>
              I agree that my electronic signature is the legal equivalent of my handwritten
              signature, and I consent to do business electronically with 3331 Trumbull LLC and
              its sponsor, AK Capital Investments LLC (E-SIGN Act).
            </span>
          </label>
          {state.error && <div className="error-text">{state.error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <AdoptButton />
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SignDocsSection({
  docs,
  legalName,
  todayLabel: today,
  viewingAs,
  downloadQuery = "",
  autoOpenKey,
}: Props) {
  const [openKey, setOpenKey] = useState<string | null>(() =>
    !viewingAs && autoOpenKey && docs.some((d) => d.key === autoOpenKey && !d.signedAt)
      ? autoOpenKey
      : null
  );
  const openDoc = docs.find((d) => d.key === openKey) ?? null;

  return (
    <>
      <div className="doc-rows">
        {docs.map((d) => (
          <div key={d.key} className="doc-row">
            <div className="doc-glyph">
              <span className="doc-glyph-badge">{d.badge}</span>
            </div>
            <div className="doc-row-main">
              <div className="doc-row-title">{d.title}</div>
              <div className="doc-row-desc">{d.desc}</div>
            </div>
            {d.signedAt ? (
              <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span className="signed-chip">✓ Signed {d.signedAt}</span>
                <a className="signed-download" href={`/api/signed/${d.key}${downloadQuery}`}>
                  Download copy →
                </a>
              </span>
            ) : viewingAs ? (
              <span className="awaiting-chip">Awaiting signature</span>
            ) : (
              <button type="button" className="sign-pill" onClick={() => setOpenKey(d.key)}>
                Review &amp; sign →
              </button>
            )}
          </div>
        ))}
      </div>
      {openDoc && !viewingAs && (
        <SignModal
          doc={openDoc}
          legalName={legalName}
          todayLabel={today}
          onClose={() => setOpenKey(null)}
        />
      )}
    </>
  );
}
