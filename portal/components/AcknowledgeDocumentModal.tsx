"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { acknowledgeDocumentAction } from "@/app/actions/investor";
import type { FormState } from "@/app/actions/auth";
import { todayLabel } from "@/lib/format";
import { useToast } from "@/components/Toast";
import type { InvestorDocument } from "@/lib/types";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Confirming…" : "Confirm receipt"}
    </button>
  );
}

/**
 * Confirmation of receipt for a document the admin flagged.
 *
 * Not a signature, and worded so nobody mistakes it for one: the PDF is opened
 * as uploaded and never altered, and what gets recorded is that this investor
 * read it and confirmed, with their typed name, the time, and their device.
 */
export default function AcknowledgeDocumentModal({
  doc,
  legalName,
  onClose,
}: {
  doc: InvestorDocument;
  legalName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(legalName);
  const [state, formAction] = useFormState<FormState, FormData>(acknowledgeDocumentAction, {});

  useEffect(() => {
    if (state.ok) {
      toast(state.message || "Receipt confirmed ✓");
      onClose();
    }
  }, [state, toast, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="modal-eyebrow">CONFIRM RECEIPT</div>
            <div className="modal-title">{doc.title}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            Close ✕
          </button>
        </div>
        <form action={formAction} className="modal-body">
          <input type="hidden" name="documentId" value={doc.id} />
          <div className="review-row">
            <span>Read the document before confirming.</span>
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
            <label className="label">TYPE YOUR FULL LEGAL NAME</label>
            <input
              name="signerName"
              className="input"
              placeholder="Full legal name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: "12px 14px" }}
            />
          </div>
          <div className="attest-box">
            <div className="attest-name">{name || "—"}</div>
            <div className="attest-meta">
              CONFIRMING ON
              <br />
              {todayLabel()}
            </div>
          </div>
          <label className="consent-row">
            <input type="checkbox" name="consent" />
            <span>
              I confirm that I have received and reviewed this document. I understand this
              records my receipt of it and is not a signature. Anything requiring my signature
              will be sent to me separately through DocuSign.
            </span>
          </label>
          {state.error && <div className="error-text">{state.error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <ConfirmButton />
          </div>
        </form>
      </div>
    </div>
  );
}
