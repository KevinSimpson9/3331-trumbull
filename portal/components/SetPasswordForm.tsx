"use client";

import { useFormState, useFormStatus } from "react-dom";
import { setPasswordAction, type FormState } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Saving…" : "Set password & enter portal"}
    </button>
  );
}

export default function SetPasswordForm({
  tokenHash,
  otpType,
}: {
  tokenHash?: string;
  otpType?: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(setPasswordAction, {});

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {tokenHash && <input type="hidden" name="token_hash" value={tokenHash} />}
      {otpType && <input type="hidden" name="otp_type" value={otpType} />}
      <div className="field">
        <label className="label" htmlFor="password">
          NEW PASSWORD
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          className="input"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="confirm">
          CONFIRM PASSWORD
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          placeholder="Repeat password"
          className="input"
          autoComplete="new-password"
          required
        />
      </div>
      {state.error && <div className="error-text">{state.error}</div>}
      <SubmitButton />
    </form>
  );
}
