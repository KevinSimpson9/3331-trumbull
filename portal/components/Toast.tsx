"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext<(text: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((text: string) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </ToastContext.Provider>
  );
}
