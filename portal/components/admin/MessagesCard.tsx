"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { adminSendMessage, broadcastAction, markThreadRead } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import { useToast } from "@/components/Toast";
import MessageThread, { type BubbleVM } from "@/components/MessageThread";

export interface ThreadVM {
  investorId: string;
  initials: string;
  name: string;
  preview: string;
  unread: boolean;
  messages: BubbleVM[];
}

function BroadcastButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-gold btn-gold-sm" style={{ padding: "9px 16px" }} disabled={pending}>
      {pending ? "Sending…" : "Send to all"}
    </button>
  );
}

function BroadcastPanel({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState<FormState, FormData>(broadcastAction, {});
  const toast = useToast();
  const lastHandled = useRef<FormState>();

  useEffect(() => {
    if (state !== lastHandled.current && state.ok) {
      toast(state.message || "Sent ✓");
      onClose();
    }
    lastHandled.current = state;
  }, [state, toast, onClose]);

  return (
    <form action={formAction} className="dashed-panel" style={{ padding: 16, gap: 10 }}>
      <textarea
        name="body"
        rows={3}
        placeholder="Update for all investors…"
        className="input input-sm"
        style={{ resize: "vertical" }}
      />
      {state.error && <div className="error-text">{state.error}</div>}
      <div className="form-actions">
        <button type="button" className="btn-ghost" style={{ padding: "9px 16px" }} onClick={onClose}>
          Cancel
        </button>
        <BroadcastButton />
      </div>
    </form>
  );
}

export default function MessagesCard({
  threads,
  openThreadId,
}: {
  threads: ThreadVM[];
  openThreadId: string | null;
}) {
  const [broadcasting, setBroadcasting] = useState(false);
  const router = useRouter();
  const openThread = threads.find((t) => t.investorId === openThreadId) ?? null;

  // Opening a thread clears its unread state (best-effort; never surfaces).
  useEffect(() => {
    if (openThread?.unread) {
      markThreadRead(openThread.investorId).catch(() => {});
    }
  }, [openThread?.investorId, openThread?.unread]);

  const open = (id: string) => router.push(`/admin?thread=${id}#messages`, { scroll: false });
  const close = () => router.push("/admin#messages", { scroll: false });

  return (
    <div className="admin-card" id="messages">
      <div className="admin-card-head">
        <div className="admin-card-title">Messages</div>
        <button type="button" className="btn-gold btn-gold-sm" onClick={() => setBroadcasting((v) => !v)}>
          ✉ Message everyone
        </button>
      </div>
      {broadcasting && <BroadcastPanel onClose={() => setBroadcasting(false)} />}
      <div className="thread-list">
        {threads.map((t) => (
          <div key={t.investorId} className="thread-row">
            <div className="avatar">{t.initials}</div>
            <div className="thread-main">
              <div className="thread-name">
                {t.name}
                {t.unread && <span className="unread-dot" />}
              </div>
              <div className="thread-preview">{t.preview}</div>
            </div>
            <button type="button" className="thread-open" onClick={() => open(t.investorId)}>
              Open →
            </button>
          </div>
        ))}
      </div>
      {openThread && (
        <div className="thread-panel">
          <div className="thread-panel-head">
            <div className="thread-panel-title">Thread with {openThread.name}</div>
            <button type="button" className="thread-panel-close" onClick={close}>
              Close ✕
            </button>
          </div>
          <MessageThread
            messages={openThread.messages}
            placeholder="Reply…"
            sendAction={adminSendMessage.bind(null, openThread.investorId)}
            scrollClassName="thread-panel-scroll"
            composerClassName="thread-panel-composer"
          />
        </div>
      )}
    </div>
  );
}
