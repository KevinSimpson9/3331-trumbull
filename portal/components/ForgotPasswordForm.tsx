"use client";

import { useFormState, useFormStatus } from "react-dom";
import { requestPasswordResetAction, type FormState } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Sending…" : "Email me a reset link"}
    </button>
  );
}

export default function ForgotPasswordForm() {
  const [state, formAction] = useFormState<FormState, FormData>(requestPasswordResetAction, {});

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="field">
        <label className="label" htmlFor="email">
          EMAIL
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          className="input"
          autoComplete="email"
          required
        />
      </div>
      {state.error && <div className="error-text">{state.error}</div>}
      {state.ok && (
        <div style={{ fontSize: 13, color: "var(--success)" }}>{state.message}</div>
      )}
      <SubmitButton />
    </form>
  );
}
