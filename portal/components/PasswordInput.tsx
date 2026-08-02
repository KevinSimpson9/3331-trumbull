"use client";

import { useState } from "react";

type Props = {
  id: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
};

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.9 9.9 0 0 1 12 4c6.5 0 10 8 10 8a17.3 17.3 0 0 1-2.16 3.19" />
      <path d="M6.61 6.61A17.6 17.6 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export default function PasswordInput({
  id,
  name,
  placeholder = "Password",
  autoComplete = "current-password",
  required = true,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="input-wrap">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        className="input input-with-toggle"
        autoComplete={autoComplete}
        required={required}
      />
      <button
        type="button"
        className="input-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
