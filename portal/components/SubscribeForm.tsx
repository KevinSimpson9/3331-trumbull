"use client";

import { useFormState, useFormStatus } from "react-dom";
import { subscribeAction } from "@/app/actions/subscribe";
import type { FormState } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold" disabled={pending}>
      {pending ? "Subscribing…" : "Subscribe & get portal access"}
    </button>
  );
}

export default function SubscribeForm() {
  const [state, formAction] = useFormState<FormState, FormData>(subscribeAction, {});

  if (state.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
        <div style={{ fontSize: 34 }}>✓</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#ffffff" }}>
          You&apos;re subscribed.
        </div>
        <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.65 }}>
          {state.message} Click the link inside to set your password — your private room opens
          with your commitment letter ready to sign, and Kevin has been notified.
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label className="label" htmlFor="legalName">
          FULL LEGAL NAME
        </label>
        <input id="legalName" name="legalName" className="input" placeholder="Jane Doe" required />
      </div>
      <div className="field">
        <label className="label" htmlFor="email">
          EMAIL
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="amount">
          COMMITMENT YOU&apos;RE CONSIDERING ($)
        </label>
        <input
          id="amount"
          name="amount"
          className="input"
          placeholder="100000"
          inputMode="numeric"
          required
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="method">
          HOW WOULD YOU LIKE TO INVEST?
        </label>
        <select id="method" name="method" className="input" defaultValue="">
          <option value="">Choose one (optional)</option>
          <option value="Cash / personal funds">Cash / personal funds</option>
          <option value="Self-directed IRA / 401(k)">Self-directed IRA / 401(k)</option>
          <option value="Entity (LLC, trust, etc.)">Entity (LLC, trust, etc.)</option>
          <option value="1031 exchange / other">1031 exchange / other</option>
          <option value="Not sure yet">Not sure yet</option>
        </select>
      </div>
      {state.error && <div className="error-text">{state.error}</div>}
      <SubmitButton />
      <div style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.55 }}>
        Subscribing creates your private portal room and emails you a sign-in link. Your
        indicative commitment is non-binding until definitive documents are executed.
      </div>
    </form>
  );
}
