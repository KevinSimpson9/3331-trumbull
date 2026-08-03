"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signDocument } from "@/app/actions/investor";
import { countersignDocument } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import { useToast } from "@/components/Toast";

export interface SignDocVM {
  key: string;
  badge: string;
  title: string;
  desc: string;
  body: string;
  signedAt: string | null; // formatted date label when signed
  signerName: string | null;
  countersignedAt: string | null; // formatted date label when countersigned
}

interface Props {
  docs: SignDocVM[];
  legalName: string;
  todayLabel: string;
  viewingAs?: boolean;
  /** Needed for the admin countersign action. */
  investorId: string;
  /** Query string for the signed-copy download link ("" for the investor,
   *  "?investor=<id>" when the admin is viewing a room). */
  downloadQuery?: string;
  /** Doc key whose signing modal opens automatically when still unsigned. */
  autoOpenKey?: string;
}

const COUNTERSIGNER_DEFAULT = "Kevin Simpson";

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
  mode,
  investorId,
  stepLabel,
  submitLabel,
  defaultName,
  todayLabel: today,
  onSigned,
  onClose,
}: {
  doc: SignDocVM;
  mode: "sign" | "countersign";
  investorId: string;
  /** Eyebrow text, e.g. "E-SIGNATURE · DOCUMENT 2 OF 4". */
  stepLabel: string;
  submitLabel: string;
  defaultName: string;
  todayLabel: string;
  onSigned: (message?: string) => void;
  onClose: () => void;
}) {
  const [sigName, setSigName] = useState(defaultName);
  const [state, formAction] = useFormState<FormState, FormData>(
    mode === "countersign" ? countersignDocument : signDocument,
    {}
  );

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
          {mode === "countersign" && <input type="hidden" name="investorId" value={investorId} />}
          <div className="paper">
            <div className="paper-title">{doc.title}</div>
            <div className="paper-body">{doc.body}</div>
            {mode === "countersign" && doc.signerName && (
              <div className="paper-signed-block">
                <div className="sig-script" style={{ fontSize: 26 }}>
                  {doc.signerName}
                </div>
                <div className="paper-signed-meta">
                  Signed by {doc.signerName} · {doc.signedAt}
                </div>
              </div>
            )}
          </div>
          <div className="field">
            <label className="label">
              {mode === "countersign"
                ? "TYPE YOUR FULL LEGAL NAME TO COUNTERSIGN"
                : "TYPE YOUR FULL LEGAL NAME TO SIGN"}
            </label>
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
              {mode === "countersign" ? "COUNTERSIGNATURE PREVIEW" : "SIGNATURE PREVIEW"}
              <br />
              {today}
            </div>
          </div>
          <label className="consent-row">
            <input type="checkbox" name="consent" />
            <span>
              {mode === "countersign" ? (
                <>
                  I am authorized to execute this document on behalf of AK Capital Investments
                  LLC, and I agree that my electronic signature is the legal equivalent of my
                  handwritten signature (E-SIGN Act).
                </>
              ) : (
                <>
                  I agree that my electronic signature is the legal equivalent of my handwritten
                  signature, and I consent to do business electronically with AK Capital
                  Investments LLC (E-SIGN Act).
                </>
              )}
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
  investorId,
  downloadQuery = "",
  autoOpenKey,
}: Props) {
  const toast = useToast();
  // Keys signed/countersigned this session, so the UI updates before the
  // server revalidation lands.
  const [localSigned, setLocalSigned] = useState<ReadonlySet<string>>(new Set());
  const [localCountersigned, setLocalCountersigned] = useState<ReadonlySet<string>>(new Set());
  const initialOpen =
    !viewingAs && autoOpenKey && docs.some((d) => d.key === autoOpenKey && !d.signedAt)
      ? autoOpenKey
      : null;
  const [openKey, setOpenKey] = useState<string | null>(initialOpen);
  // Guided mode walks through every remaining document, one signature at a time.
  const [guided, setGuided] = useState<boolean>(Boolean(initialOpen));

  const isSigned = (d: SignDocVM) => Boolean(d.signedAt) || localSigned.has(d.key);
  const isCountersigned = (d: SignDocVM) =>
    Boolean(d.countersignedAt) || localCountersigned.has(d.key);
  // What "remaining" means depends on who is looking: the investor works
  // through unsigned docs; the admin works through signed-but-uncountersigned.
  const remaining = viewingAs
    ? docs.filter((d) => isSigned(d) && !isCountersigned(d))
    : docs.filter((d) => !isSigned(d));
  const openDoc = docs.find((d) => d.key === openKey) ?? null;
  const mode: "sign" | "countersign" = viewingAs ? "countersign" : "sign";

  const startGuided = () => {
    if (!remaining.length) return;
    setGuided(true);
    setOpenKey(remaining[0].key);
  };

  const closeModal = () => {
    setOpenKey(null);
    setGuided(false);
  };

  const handleSigned = (key: string, message?: string) => {
    if (mode === "countersign") {
      setLocalCountersigned((prev) => new Set(prev).add(key));
      const next = guided
        ? docs.find((d) => d.key !== key && isSigned(d) && !isCountersigned(d))
        : undefined;
      if (next) {
        toast(message || "Countersigned ✓");
        setOpenKey(next.key);
        return;
      }
      toast(guided ? "All signed documents countersigned ✓" : message || "Countersigned ✓");
      closeModal();
      return;
    }
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
    closeModal();
  };

  const signedCount = docs.filter(isSigned).length;
  const countersignedCount = docs.filter(isCountersigned).length;

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
            ✓ All {docs.length} subscription documents signed —{" "}
            {countersignedCount === docs.length
              ? "fully executed; download your copies below."
              : "Kevin countersigns next, then your executed copies are final. Download below."}
          </div>
        ))}
      {viewingAs &&
        (remaining.length ? (
          <div className="sign-cta">
            <div className="sign-cta-main">
              <div className="sign-cta-title">Countersign as AK Capital Investments</div>
              <div className="sign-cta-desc">
                {remaining.length} signed {remaining.length === 1 ? "document" : "documents"}{" "}
                awaiting your countersignature — we&apos;ll walk you through each one.
              </div>
            </div>
            <button type="button" className="btn-gold" onClick={startGuided}>
              Countersign →
            </button>
          </div>
        ) : signedCount === docs.length ? (
          <div className="sign-cta sign-cta-done">
            ✓ All {docs.length} documents signed and countersigned — fully executed.
          </div>
        ) : null)}
      <div className="doc-rows">
        {docs.map((d) => {
          const signedLabel = d.signedAt ?? (localSigned.has(d.key) ? today : null);
          const countersignedLabel =
            d.countersignedAt ?? (localCountersigned.has(d.key) ? today : null);
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
                  {countersignedLabel ? (
                    <span className="signed-chip">✓ Countersigned {countersignedLabel}</span>
                  ) : viewingAs ? (
                    <button
                      type="button"
                      className="sign-pill"
                      onClick={() => {
                        setGuided(false);
                        setOpenKey(d.key);
                      }}
                    >
                      Countersign →
                    </button>
                  ) : (
                    <span className="awaiting-chip">Countersignature pending</span>
                  )}
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
      {openDoc && (
        <SignModal
          key={`${mode}-${openDoc.key}`}
          doc={openDoc}
          mode={mode}
          investorId={investorId}
          stepLabel={
            guided
              ? `${mode === "countersign" ? "COUNTERSIGNATURE" : "E-SIGNATURE"} · DOCUMENT ${
                  docs.indexOf(openDoc) + 1
                } OF ${docs.length}`
              : mode === "countersign"
                ? "COUNTERSIGNATURE"
                : "E-SIGNATURE"
          }
          submitLabel={
            guided && remaining.some((d) => d.key !== openDoc.key)
              ? mode === "countersign"
                ? "Adopt signature & countersign next"
                : "Adopt signature & continue"
              : mode === "countersign"
                ? "Adopt signature & countersign"
                : "Adopt signature & sign"
          }
          defaultName={mode === "countersign" ? COUNTERSIGNER_DEFAULT : legalName}
          todayLabel={today}
          onSigned={(message) => handleSigned(openDoc.key, message)}
          onClose={closeModal}
        />
      )}
    </>
  );
}
