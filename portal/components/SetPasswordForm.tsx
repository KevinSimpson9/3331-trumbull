"use client";

import { useFormState, useFormStatus } from "react-dom";
import { setPasswordAction, type FormState } from "@/app/actions/auth";
import PasswordInput from "@/components/PasswordInput";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Saving…" : "Set password & enter portal"}
    </button>
  );
}

export default function SetPasswordForm() {
  const [state, formAction] = useFormState<FormState, FormData>(setPasswordAction, {});

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="field">
        <label className="label" htmlFor="password">
          NEW PASSWORD
        </label>
        <PasswordInput
          id="password"
          name="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="confirm">
          CONFIRM PASSWORD
        </label>
        <PasswordInput
          id="confirm"
          name="confirm"
          placeholder="Repeat password"
          autoComplete="new-password"
        />
      </div>
      {state.error && <div className="error-text">{state.error}</div>}
      <SubmitButton />
    </form>
  );
}
