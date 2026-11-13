"use client";

import { useI18n } from "@/components/I18nProvider";

export type ToastTone = "pending" | "progress" | "success" | "error";

export interface ToastProps {
  tone: ToastTone;
  title: string;
  message?: string;
  /** Shows a progress bar (e.g. orders created so far). */
  progress?: { done: number; total: number };
  onClose?: () => void;
}

const TONE: Record<ToastTone, { icon: string; className: string }> = {
  pending: { icon: "◌", className: "border-border" },
  progress: { icon: "↻", className: "border-accent/40" },
  success: { icon: "✓", className: "border-good/40" },
  error: { icon: "!", className: "border-bad/40" },
};

const ICON_COLOR: Record<ToastTone, string> = {
  pending: "text-muted animate-pulse",
  progress: "text-accent animate-spin",
  success: "text-good",
  error: "text-bad",
};

/** Small notification in the bottom-left corner (the AI chat button lives bottom-right). */
export function Toast({ tone, title, message, progress, onClose }: ToastProps) {
  const { t } = useI18n();
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      data-testid="toast"
      data-tone={tone}
      className={`fixed bottom-5 left-5 z-50 w-[min(380px,calc(100vw-2.5rem))] rounded-xl border bg-surface p-4 shadow-xl ${TONE[tone].className}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className={`mt-0.5 inline-block w-4 text-center font-semibold ${ICON_COLOR[tone]}`}>
          {TONE[tone].icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {message && <p className="mt-0.5 break-words text-xs text-muted">{message}</p>}
          {progress && (
            <div className="mt-2 h-1.5 rounded-full bg-surface-2">
              <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={t("common.dismiss")} className="text-muted hover:text-text">
            ×
          </button>
        )}
      </div>
    </div>
  );
}
