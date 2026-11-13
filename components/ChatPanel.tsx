"use client";

import { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RANGE_PARAM } from "@/lib/navigation";
import { useI18n } from "@/components/I18nProvider";
import type { MessageKey } from "@/lib/i18n/messages/en";

const SUGGESTIONS: MessageKey[] = ["chat.q1", "chat.q2", "chat.q3"];

/** AI assistant drawer, available on every page. Sends the selected period with each question. */
export function ChatPanel() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const preset = useSearchParams().get(RANGE_PARAM) ?? undefined;
  const { messages, sendMessage, status, error } = useChat();
  const busy = status === "submitted" || status === "streaming";
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    // The server answers (and words insights) in the page language.
    sendMessage({ text }, { body: { preset, locale } });
    setInput("");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90"
          aria-controls="ai-chat"
        >
          {t("chat.open")}
        </button>
      )}

      <aside
        id="ai-chat"
        aria-label={t("chat.aria")}
        hidden={!open}
        className="fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-surface shadow-2xl sm:w-[440px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold">{t("chat.title")}</h2>
            <p className="text-xs text-muted">{t("chat.subtitle")}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label={t("chat.close")} className="rounded-md px-2 text-lg text-muted hover:bg-surface-2 hover:text-text">
            ×
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">{t("chat.try")}</p>
              {SUGGESTIONS.map((key) => (
                <button key={key} type="button" onClick={() => ask(t(key))} className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-surface-2">
                  {t(key)}
                </button>
              ))}
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "ml-8 rounded-lg bg-accent-soft px-3 py-2 text-sm" : "text-sm"} data-role={m.role}>
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <div key={i} className="prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
                    </div>
                  );
                }
                if (part.type === "reasoning" && part.text.trim()) {
                  // Nemotron runs with enable_thinking – show its reasoning, collapsed.
                  return (
                    <details key={i} className="my-1 text-xs text-muted">
                      <summary className="cursor-pointer select-none">{t("chat.thinking")}</summary>
                      <p className="mt-1 whitespace-pre-wrap border-l-2 border-border pl-2">{part.text}</p>
                    </details>
                  );
                }
                if (part.type.startsWith("tool-")) {
                  const name = part.type.slice(5);
                  return (
                    <p key={i} className="my-1 text-xs text-muted">
                      {t("chat.analysed", { tool: t(`tool.${name}` as MessageKey) })}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          ))}

          {status === "submitted" && <p className="text-sm text-muted">{t("chat.analysing")}</p>}
          {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{t("chat.error", { message: error.message })}</p>}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.question")}
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">
            {t("chat.send")}
          </button>
        </form>
      </aside>
    </>
  );
}
