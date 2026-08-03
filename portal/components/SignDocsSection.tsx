"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Doc key whose signing modal opens automatically when still unsigned.
   *  Falls back to the first unsigned document so the flow resumes wherever
   *  the investor left off. */
  autoOpenKey?: string;
}

function AdoptButton({ hasNext }: { hasNext: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Signing…" : hasNext ? "Adopt signature & continue →" : "Adopt signature & sign"}
    </button>
  );
}

function SignModal({
  doc,
  stepLabel,
  hasNext,
  initialName,
  todayLabel: today,
  onClose,
  onSigned,
}: {
  doc: SignDocVM;
  /** e.g. "DOCUMENT 2 OF 3" */
  stepLabel: string;
  hasNext: boolean;
  initialName: string;
  todayLabel: string;
  onClose: () => void;
  onSigned: (signerName: string) => void;
}) {
  const [sigName, setSigName] = useState(initialName);
  const [state, formAction] = useFormState<FormState, FormData>(signDocument, {});
  const doneRef = useRef(false);

  useEffect(() => {
    if (state.ok && !doneRef.current) {
      doneRef.current = true;
      onSigned(sigName);
    }
  }, [state, onSigned, sigName]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="modal-eyebrow">E-SIGNATURE · {stepLabel}</div>
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
            <AdoptButton hasNext={hasNext} />
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
  const toast = useToast();
  // Docs signed during this visit — bridges the gap until the server refresh
  // delivers updated `signedAt` props, so the chain never reopens a signed doc.
  const [justSigned, setJustSigned] = useState<Set<string>>(() => new Set());
  const [signerName, setSignerName] = useState(legalName);
  const isSigned = (d: SignDocVM) => Boolean(d.signedAt) || justSigned.has(d.key);

  const [openKey, setOpenKey] = useState<string | null>(() => {
    if (viewingAs || !autoOpenKey) return null;
    const requested = docs.find((d) => d.key === autoOpenKey && !d.signedAt);
    if (requested) return requested.key;
    const firstUnsigned = docs.find((d) => !d.signedAt);
    return firstUnsigned?.key ?? null;
  });
  const openDoc = docs.find((d) => d.key === openKey) ?? null;
  const openIdx = openDoc ? docs.findIndex((d) => d.key === openDoc.key) : -1;
  const nextUnsignedAfter = (key: string, signed: Set<string>) =>
    docs.find((d) => d.key !== key && !d.signedAt && !signed.has(d.key)) ?? null;

  const handleSigned = (key: string, name: string) => {
    setSignerName(name);
    const signed = new Set(justSigned).add(key);
    setJustSigned(signed);
    const next = nextUnsignedAfter(key, signed);
    if (next) {
      toast("Signed ✓ — one more step, next document is ready");
      setOpenKey(next.key);
    } else {
      toast(`All ${docs.length} documents signed ✓ Executed copies are in your folder`);
      setOpenKey(null);
    }
  };

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
            ) : justSigned.has(d.key) ? (
              <span className="signed-chip">✓ Signed just now</span>
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
      {openDoc && !viewingAs && !isSigned(openDoc) && (
        <SignModal
          key={openDoc.key}
          doc={openDoc}
          stepLabel={`DOCUMENT ${openIdx + 1} OF ${docs.length}`}
          hasNext={Boolean(nextUnsignedAfter(openDoc.key, justSigned))}
          initialName={signerName}
          todayLabel={today}
          onClose={() => setOpenKey(null)}
          onSigned={(name) => handleSigned(openDoc.key, name)}
        />
      )}
    </>
  );
}
