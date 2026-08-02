"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateInvestorAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import { useToast } from "@/components/Toast";
import type { RosterRowVM } from "./AllInvestorsCard";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold btn-gold-sm" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export default function EditInvestorForm({
  row,
  onClose,
}: {
  row: RosterRowVM;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(updateInvestorAction, {});
  const toast = useToast();
  const lastHandled = useRef<FormState>();

  useEffect(() => {
    if (state !== lastHandled.current && state.ok) {
      toast(state.message || "Investor updated ✓");
      onClose();
    }
    lastHandled.current = state;
  }, [state, toast, onClose]);

  return (
    <form action={formAction} className="dashed-panel">
      <input type="hidden" name="investorId" value={row.id} />
      <div className="dashed-panel-title">Edit {row.name}</div>
      <div className="split">
        <div className="field field-tight">
          <label className="label label-sm">FULL LEGAL NAME</label>
          <input name="legalName" className="input input-sm" defaultValue={row.name} />
        </div>
        <div className="field field-tight">
          <label className="label label-sm">EMAIL (SIGN-IN — NOT EDITABLE)</label>
          <input className="input input-sm" value={row.email} readOnly disabled />
        </div>
      </div>
      <div className="split split-3">
        <div className="field field-tight">
          <label className="label label-sm">PRINCIPAL ($)</label>
          <input
            name="principal"
            className="input input-sm"
            defaultValue={row.principalRaw}
            inputMode="numeric"
          />
        </div>
        <div className="field field-tight">
          <label className="label label-sm">RATE (%/YR)</label>
          <input name="rate" className="input input-sm" defaultValue={row.rateRaw} inputMode="numeric" />
        </div>
        <div className="field field-tight">
          <label className="label label-sm">TERM (MONTHS)</label>
          <input name="term" className="input input-sm" defaultValue={row.termRaw} inputMode="numeric" />
        </div>
      </div>
      <div className="form-helper">
        Changes apply to their stats and any documents they haven&apos;t signed yet. Documents
        already signed keep the executed PDF exactly as it was at signing.
      </div>
      {state.error && <div className="error-text">{state.error}</div>}
      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <SaveButton />
      </div>
    </form>
  );
}
