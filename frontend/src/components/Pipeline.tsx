import clsx from "clsx";
import { Check } from "lucide-react";
import { STATUS_LABEL } from "../lib/format";
import type { OppStatus } from "../lib/types";

const STEPS: OppStatus[] = ["open", "in_progress", "delivered", "paid", "completed"];
const HINT: Record<string, string> = {
  open: "Recommend · apply · invite · select",
  in_progress: "Student works on it",
  delivered: "Student delivered",
  paid: "Company confirmed payment",
  completed: "Reviewed · in verified portfolio",
};

export function Pipeline({ status }: { status: OppStatus }) {
  if (status === "closed" || status === "draft") return <p className="text-sm text-muted-fg">Status: {STATUS_LABEL[status]}</p>;
  const idx = STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Collaboration progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-col items-center text-center" aria-current={i === idx ? "step" : undefined}>
          <div className="flex w-full items-center">
            <span className={clsx("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= idx ? "bg-primary" : "bg-border")} />
            <span
              className={clsx(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                i < idx || status === "completed" ? "border-primary bg-primary text-primary-fg" : i === idx ? "border-primary bg-card text-primary-strong" : "border-border bg-card text-muted-fg",
              )}
            >
              {i < idx || status === "completed" ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={clsx("h-0.5 flex-1", i === STEPS.length - 1 ? "bg-transparent" : i < idx ? "bg-primary" : "bg-border")} />
          </div>
          <span className={clsx("mt-1.5 text-xs font-semibold", i === idx ? "text-fg" : "text-muted-fg")}>{STATUS_LABEL[s]}</span>
          <span className="hidden text-[11px] leading-tight text-muted-fg lg:block">{HINT[s]}</span>
        </li>
      ))}
    </ol>
  );
}
