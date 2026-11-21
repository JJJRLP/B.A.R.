"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { PaymentStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "ok";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors select-none",
        "disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-base",
        variant === "primary" && "bg-primary text-primary-foreground hover:brightness-110",
        variant === "secondary" && "bg-surface-2 text-ink border border-line hover:border-muted-foreground",
        variant === "ghost" && "text-ink-2 hover:text-ink hover:bg-surface-2",
        variant === "danger" && "bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25",
        variant === "ok" && "bg-ok/15 text-ok border border-ok/30 hover:bg-ok/25",
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-10 w-full rounded-lg bg-surface-2 border border-line px-3 text-sm text-ink placeholder:text-muted-foreground",
        "focus:outline-none focus:border-primary",
        className,
      )}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "h-10 rounded-lg bg-surface-2 border border-line px-3 text-sm text-ink focus:outline-none focus:border-primary",
        className,
      )}
    />
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx("block text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5", className)}>{children}</span>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-xl bg-surface border border-line", className)}>{children}</div>;
}

export function StatusBadge({ status }: { status: PaymentStatus | "void" }) {
  const styles: Record<string, string> = {
    pending: "bg-warn/15 text-warn border-warn/30",
    verified: "bg-ok/15 text-ok border-ok/30",
    rejected: "bg-bad/15 text-bad border-bad/30",
    void: "bg-surface-2 text-muted-foreground border-line",
  };
  return (
    <span className={cx("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", styles[status])}>
      {status === "void" ? "Anulada" : STATUS_LABEL[status]}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-4 text-ink-2">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="text-sm mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  fullOnMobile,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  /** On phones the dialog owns the whole screen (used while money changes hands). */
  fullOnMobile?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0b0817]/80 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          "w-full overflow-y-auto overscroll-contain bg-surface border border-line sm:rounded-2xl",
          fullOnMobile ? "h-dvh max-h-dvh rounded-none sm:h-auto sm:max-h-[92vh]" : "max-h-[92vh] rounded-t-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-md",
        )}
      >
        <div className="sticky top-0 z-10 bg-surface flex items-center justify-between px-5 h-14 border-b border-line">
          <h2 className="font-bold text-lg tracking-tight">{title}</h2>
          <button onClick={onClose} className="h-10 w-10 -mr-2 grid place-items-center rounded-full text-muted-foreground hover:text-ink hover:bg-secondary" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-primary" />;
}

/** DEMO wordmark: the name in the heavy grotesk with a UV-yellow full stop. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("font-extrabold tracking-[-0.03em] leading-none select-none", className)}>
      DEMO<span className="text-primary">.</span>
    </span>
  );
}
