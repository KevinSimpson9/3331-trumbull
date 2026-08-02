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

function AdoptButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Signing…" : label}
    </button>
  );
}

function SignModal({
  doc,
  stepLabel,
  submitLabel,
  legalName,
  todayLabel: today,
  onSigned,
  onClose,
}: {
  doc: SignDocVM;
  /** Eyebrow text, e.g. "E-SIGNATURE · DOCUMENT 2 OF 4". */
  stepLabel: string;
  submitLabel: string;
  legalName: string;
  todayLabel: string;
  onSigned: (message?: string) => void;
  onClose: () => void;
}) {
  const [sigName, setSigName] = useState(legalName);
  const [state, formAction] = useFormState<FormState, FormData>(signDocument, {});

  useEffect(() => {
    if (state.ok) onSigned(state.message);
  }, [state, onSigned]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="modal-eyebrow">{stepLabel}</div>
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
              signature, and I consent to do business electronically with AK Capital Investments
              LLC (E-SIGN Act).
            </span>
          </label>
          {state.error && <div className="error-text">{state.error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <AdoptButton label={submitLabel} />
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
  // Keys signed this session, so the UI updates before the server revalidation lands.
  const [localSigned, setLocalSigned] = useState<ReadonlySet<string>>(new Set());
  const initialOpen =
    !viewingAs && autoOpenKey && docs.some((d) => d.key === autoOpenKey && !d.signedAt)
      ? autoOpenKey
      : null;
  const [openKey, setOpenKey] = useState<string | null>(initialOpen);
  // Guided mode walks through every remaining document, one signature at a time.
  const [guided, setGuided] = useState<boolean>(Boolean(initialOpen));

  const isSigned = (d: SignDocVM) => Boolean(d.signedAt) || localSigned.has(d.key);
  const remaining = docs.filter((d) => !isSigned(d));
  const openDoc = docs.find((d) => d.key === openKey) ?? null;

  const startGuided = () => {
    if (!remaining.length) return;
    setGuided(true);
    setOpenKey(remaining[0].key);
  };

  const handleSigned = (key: string, message?: string) => {
    setLocalSigned((prev) => new Set(prev).add(key));
    const next = guided ? docs.find((d) => d.key !== key && !isSigned(d)) : undefined;
    if (next) {
      toast(message || "Document signed ✓");
      setOpenKey(next.key);
      return;
    }
    toast(
      guided
        ? `All ${docs.length} subscription documents signed ✓`
        : message || "Document signed ✓ Saved to your folder"
    );
    setOpenKey(null);
    setGuided(false);
  };

  return (
    <>
      {!viewingAs &&
        (remaining.length ? (
          <div className="sign-cta">
            <div className="sign-cta-main">
              <div className="sign-cta-title">
                {remaining.length < docs.length
                  ? "Finish signing your subscription documents"
                  : "Sign your subscription documents"}
              </div>
              <div className="sign-cta-desc">
                {remaining.length} of {docs.length} documents remaining — we&apos;ll walk you
                through each one, one signature at a time.
              </div>
            </div>
            <button type="button" className="btn-gold" onClick={startGuided}>
              {remaining.length < docs.length ? "Continue signing →" : "Start signing →"}
            </button>
          </div>
        ) : (
          <div className="sign-cta sign-cta-done">
            ✓ All {docs.length} subscription documents signed — download your copies below.
          </div>
        ))}
      <div className="doc-rows">
        {docs.map((d) => {
          const signedLabel = d.signedAt ?? (localSigned.has(d.key) ? today : null);
          return (
            <div key={d.key} className="doc-row">
              <div className="doc-glyph">
                <span className="doc-glyph-badge">{d.badge}</span>
              </div>
              <div className="doc-row-main">
                <div className="doc-row-title">{d.title}</div>
                <div className="doc-row-desc">{d.desc}</div>
              </div>
              {signedLabel ? (
                <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="signed-chip">✓ Signed {signedLabel}</span>
                  <a className="signed-download" href={`/api/signed/${d.key}${downloadQuery}`}>
                    Download copy →
                  </a>
                </span>
              ) : viewingAs ? (
                <span className="awaiting-chip">Awaiting signature</span>
              ) : (
                <button
                  type="button"
                  className="sign-pill"
                  onClick={() => {
                    setGuided(false);
                    setOpenKey(d.key);
                  }}
                >
                  Review &amp; sign →
                </button>
              )}
            </div>
          );
        })}
      </div>
      {openDoc && !viewingAs && (
        <SignModal
          key={openDoc.key}
          doc={openDoc}
          stepLabel={
            guided
              ? `E-SIGNATURE · DOCUMENT ${docs.indexOf(openDoc) + 1} OF ${docs.length}`
              : "E-SIGNATURE"
          }
          submitLabel={
            guided && remaining.some((d) => d.key !== openDoc.key)
              ? "Adopt signature & continue"
              : "Adopt signature & sign"
          }
          legalName={legalName}
          todayLabel={today}
          onSigned={(message) => handleSigned(openDoc.key, message)}
          onClose={() => {
            setOpenKey(null);
            setGuided(false);
          }}
        />
      )}
    </>
  );
}
