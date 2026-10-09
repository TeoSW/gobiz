import clsx from "clsx";
import { AlertTriangle, Loader2, Star, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { initials } from "../lib/format";
import { texts, useTexts } from "../lib/i18n";

const T = texts(
  { loading: "Loading", close: "Close dialog", outOf: (v: string, n: number) => `${v} out of ${n}`, stars: (n: number) => `${n} star${n > 1 ? "s" : ""}` },
  { loading: "Se încarcă", close: "Închide fereastra", outOf: (v, n) => `${v} din ${n}`, stars: (n) => `${n} ${n > 1 ? "stele" : "stea"}` },
);

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-fg border-border",
  primary: "bg-primary-soft text-primary-strong border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  const t = useTexts(T);
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-fg">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {label ?? t.loading}...
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-muted", className)} aria-hidden />;
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="mb-1 text-muted-fg">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-md text-sm text-muted-fg">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{error instanceof Error ? error.message : String(error)}</span>
    </div>
  );
}

export function Notice({ tone = "primary", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={clsx("rounded-xl border px-4 py-3 text-sm", TONES[tone])}>{children}</div>;
}

export function Avatar({ name, size = "md", tone = "primary" }: { name: string; size?: "sm" | "md" | "lg"; tone?: "primary" | "accent" }) {
  const sz = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-xl" }[size];
  return (
    <span aria-hidden className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-bold", sz, tone === "primary" ? "bg-primary-soft text-primary-strong" : "bg-accent-soft text-accent")}>
      {initials(name)}
    </span>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors",
            value === t.id ? "bg-primary text-primary-fg" : "text-muted-fg hover:bg-muted hover:text-fg",
          )}
        >
          {t.label}
          {t.count != null && (
            <span className={clsx("rounded-full px-1.5 text-xs", value === t.id ? "bg-white/20" : "bg-muted")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label, size = "md" }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "cursor-pointer rounded-lg font-medium transition-colors",
            size === "sm" ? "min-h-8 px-2.5 text-xs" : "min-h-9 px-3 text-sm",
            value === o.value ? "bg-card text-fg shadow-sm" : "text-muted-fg hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ToggleChip({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        checked ? "border-primary bg-primary-soft text-primary-strong" : "border-border bg-card text-muted-fg hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function Stars({ value, outOf = 5, size = 14 }: { value: number; outOf?: number; size?: number }) {
  const t = useTexts(T);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={t.outOf(value.toFixed(1), outOf)}>
      {Array.from({ length: outOf }, (_, i) => (
        <Star key={i} size={size} aria-hidden className={i < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-border"} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const t = useTexts(T);
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={t.stars(n)} onClick={() => onChange(n)} className="cursor-pointer rounded p-1">
          <Star size={22} className={n <= value ? "fill-amber-400 text-amber-400" : "text-muted-fg"} aria-hidden />
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useTexts(T);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-2xl border border-border bg-card p-0 text-fg shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={onClose} className="btn-ghost min-h-9 px-2" aria-label={t.close}>
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="p-5">{open && children}</div>
    </dialog>
  );
}

export function SectionTitle({ children, action, sub }: { children: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold">{children}</h2>
        {sub && <p className="text-sm text-muted-fg">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      {icon && <div className="rounded-xl bg-primary-soft p-2.5 text-primary-strong">{icon}</div>}
      <div className="min-w-0">
        <p className="text-sm text-muted-fg">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-fg">{sub}</p>}
      </div>
    </div>
  );
}
