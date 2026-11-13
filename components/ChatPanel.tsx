"use client";

import { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RANGE_PARAM } from "@/lib/navigation";

const SUGGESTIONS = [
  "Which products are the most profitable after deducting all costs?",
  "Where are we currently losing money?",
  "Which marketing budgets should we optimize?",
];

const TOOL_LABELS: Record<string, string> = {
  getProfitSummary: "P&L summary",
  getProductProfitability: "product profitability",
  getCategoryProfitability: "category profitability",
  getMarketingPerformance: "campaign performance",
  getInsights: "detected insights",
  getDataSources: "data sources",
};

/** AI assistant drawer, available on every page. Sends the selected period with each question. */
export function ChatPanel() {
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
    sendMessage({ text }, { body: { preset } });
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
          ✦ Ask AI
        </button>
      )}

      <aside
        id="ai-chat"
        aria-label="AI assistant"
        hidden={!open}
        className="fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-surface shadow-2xl sm:w-[440px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold">AI Profit Analyst</h2>
            <p className="text-xs text-muted">Answers are computed from your live data – no invented numbers.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-md px-2 text-lg text-muted hover:bg-surface-2 hover:text-text">
            ×
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Try one of these:</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-surface-2">
                  {s}
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
                if (part.type.startsWith("tool-")) {
                  const name = part.type.slice(5);
                  return (
                    <p key={i} className="my-1 text-xs text-muted">
                      ↳ analysed {TOOL_LABELS[name] ?? name}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          ))}

          {status === "submitted" && <p className="text-sm text-muted">Analysing…</p>}
          {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">Something went wrong: {error.message}</p>}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about profit, products, campaigns…"
            aria-label="Question"
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">
            Send
          </button>
        </form>
      </aside>
    </>
  );
}
