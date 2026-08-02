"use client";

import { useEffect, useRef } from "react";
import type { FormState } from "@/app/actions/auth";

export interface BubbleVM {
  id: string;
  text: string;
  mine: boolean;
  meta: string;
}

interface Props {
  messages: BubbleVM[];
  placeholder: string;
  sendAction: (formData: FormData) => Promise<FormState>;
  scrollClassName?: string;
  composerClassName?: string;
}

/** Scrollable bubble list + composer. Enter sends (native form submit). */
export default function MessageThread({
  messages,
  placeholder,
  sendAction,
  scrollClassName = "chat-scroll",
  composerClassName = "chat-composer",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <>
      <div ref={scrollRef} className={scrollClassName}>
        {messages.map((m) => (
          <div key={m.id} className={`bubble-wrap ${m.mine ? "mine" : "theirs"}`}>
            <div className="bubble">{m.text}</div>
            <div className="bubble-meta">{m.meta}</div>
          </div>
        ))}
      </div>
      <form
        ref={formRef}
        className={composerClassName}
        action={async (formData) => {
          formRef.current?.reset();
          try {
            await sendAction(formData);
          } catch {
            // transient send failure — the message list simply doesn't update
          }
        }}
      >
        <input name="body" className="input" placeholder={placeholder} autoComplete="off" />
        <button type="submit" className="chat-send">
          Send
        </button>
      </form>
    </>
  );
}
