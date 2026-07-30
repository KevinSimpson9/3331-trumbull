"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createInvestorAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import { useToast } from "@/components/Toast";

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold btn-gold-sm" disabled={pending}>
      {pending ? "Creating…" : "Create investor & send invite"}
    </button>
  );
}

export default function AddInvestorForm({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState<FormState, FormData>(createInvestorAction, {});
  const toast = useToast();
  const lastHandled = useRef<FormState>();

  useEffect(() => {
    if (state !== lastHandled.current && state.ok) {
      toast(state.message || "Investor created — invite sent ✓");
      onClose();
    }
    lastHandled.current = state;
  }, [state, toast, onClose]);

  return (
    <form action={formAction} className="dashed-panel">
      <div className="dashed-panel-title">+ Add new investor</div>
      <div className="split">
        <div className="field field-tight">
          <label className="label label-sm">FULL LEGAL NAME</label>
          <input name="legalName" className="input input-sm" placeholder="Jane Doe" />
        </div>
        <div className="field field-tight">
          <label className="label label-sm">EMAIL</label>
          <input name="email" type="email" className="input input-sm" placeholder="jane@example.com" />
        </div>
      </div>
      <div className="split split-3">
        <div className="field field-tight">
          <label className="label label-sm">PRINCIPAL ($)</label>
          <input name="principal" className="input input-sm" placeholder="125000" inputMode="numeric" />
        </div>
        <div className="field field-tight">
          <label className="label label-sm">RATE (%/YR)</label>
          <input name="rate" className="input input-sm" defaultValue="20" inputMode="numeric" />
        </div>
        <div className="field field-tight">
          <label className="label label-sm">TERM (MONTHS)</label>
          <input name="term" className="input input-sm" defaultValue="20" inputMode="numeric" />
        </div>
      </div>
      <div className="form-helper">
        We&apos;ll create their private folder, generate sign-in credentials, and email a portal
        invite with their documents ready to sign.
      </div>
      {state.error && <div className="error-text">{state.error}</div>}
      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <CreateButton />
      </div>
    </form>
  );
}
