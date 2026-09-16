"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signDocumentAction } from "@/app/actions/investor";
import type { FormState } from "@/app/actions/auth";
import { todayLabel } from "@/lib/format";
import { useToast } from "@/components/Toast";
import type { InvestorDocument } from "@/lib/types";

function SignButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Signing…" : "Adopt signature & sign"}
    </button>
  );
}

/**
 * Signing for the occasional document that needs it without a DocuSign
 * envelope. The uploaded file is never altered — open it, read it, then the
 * signature is recorded against it with the typed name, time and device.
 */
export default function SignDocumentModal({
  doc,
  legalName,
  onClose,
}: {
  doc: InvestorDocument;
  legalName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [sigName, setSigName] = useState(legalName);
  const [state, formAction] = useFormState<FormState, FormData>(signDocumentAction, {});

  useEffect(() => {
    if (state.ok) {
      toast(state.message || "Signed ✓");
      onClose();
    }
  }, [state, toast, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="modal-eyebrow">SIGNATURE REQUESTED</div>
            <div className="modal-title">{doc.title}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            Close ✕
          </button>
        </div>
        <form action={formAction} className="modal-body">
          <input type="hidden" name="documentId" value={doc.id} />
          <div className="review-row">
            <span>Read the document before signing.</span>
            <a
              className="btn-ghost btn-ghost-sm"
              href={`/api/investor-doc/${doc.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open {doc.file_name} ↗
            </a>
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
              {todayLabel()}
            </div>
          </div>
          <label className="consent-row">
            <input type="checkbox" name="consent" />
            <span>
              I have read the document above and agree that my electronic signature is the legal
              equivalent of my handwritten signature. I consent to do business electronically
              with 3331 Trumbull LLC and its sponsor, AK Capital Investments LLC (E-SIGN Act).
            </span>
          </label>
          {state.error && <div className="error-text">{state.error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <SignButton />
          </div>
        </form>
      </div>
    </div>
  );
}
