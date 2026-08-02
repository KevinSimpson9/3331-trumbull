"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { signInAction, type FormState } from "@/app/actions/auth";
import PasswordInput from "@/components/PasswordInput";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function SignInForm() {
  const [state, formAction] = useFormState<FormState, FormData>(signInAction, {});

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
      <div className="field">
        <label className="label" htmlFor="password">
          PASSWORD
        </label>
        <PasswordInput id="password" name="password" />
      </div>
      {state.error && <div className="error-text">{state.error}</div>}
      <SubmitButton />
      <div className="login-helper">
        <Link href="/auth/forgot">Forgot password?</Link>
        <span style={{ fontStyle: "italic" }}>First time? Check your invitation email.</span>
      </div>
    </form>
  );
}
