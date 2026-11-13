import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, subtitle, action, className = "", children }: CardProps) {
  return (
    <section className={`rounded-xl border border-border bg-surface ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
