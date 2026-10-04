import clsx from "clsx";
import { BadgeCheck, Building2, CalendarClock, Clock, GraduationCap, MapPin, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { ACADEMIC_LABEL, MODE_LABEL, STATUS_LABEL, TYPE_LABEL, money, shortDate } from "../lib/format";
import type { Opportunity } from "../lib/types";
import { MatchPill, MatchRing } from "./Match";
import { Badge } from "./ui";

const TYPE_TONE = { project: "primary", internship: "success", job: "accent" } as const;

export function TypeBadge({ type }: { type: Opportunity["type"] }) {
  return <Badge tone={TYPE_TONE[type]}>{TYPE_LABEL[type]}</Badge>;
}

export function StatusBadge({ status }: { status: Opportunity["status"] }) {
  const tone = status === "open" ? "success" : status === "completed" ? "primary" : status === "closed" ? "neutral" : "warning";
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export function OpportunityCard({ o, showStatus = false, compact = false }: { o: Opportunity; showStatus?: boolean; compact?: boolean }) {
  return (
    <Link
      to={`/opportunities/${o.id}`}
      className="card group flex cursor-pointer flex-col gap-3 p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={o.type} />
            {o.university_verified && (
              <Badge tone="primary" icon={<BadgeCheck className="size-3" aria-hidden />}>
                University Verified
              </Badge>
            )}
            {showStatus && <StatusBadge status={o.status} />}
          </div>
          <h3 className="font-bold leading-snug group-hover:text-primary-strong">{o.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-fg">
            <Building2 className="size-3.5" aria-hidden />
            {o.company.name}
          </p>
        </div>
        {o.match && <MatchRing match={o.match} size={52} />}
      </div>

      {!compact && <p className="line-clamp-2 text-sm text-muted-fg">{o.description}</p>}

      <div className="flex flex-wrap gap-1.5">
        {o.skills.slice(0, 5).map((s) => (
          <span key={s.skill_id} className={clsx("chip", s.mandatory && "border-primary/40")}>
            {s.name}
            {s.mandatory && <span className="sr-only"> (required)</span>}
          </span>
        ))}
        {o.skills.length > 5 && <span className="chip">+{o.skills.length - 5}</span>}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm text-muted-fg">
        <span className="inline-flex items-center gap-1 font-semibold text-fg">
          <Wallet className="size-4" aria-hidden />
          {money(o)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-4" aria-hidden />
          {o.hours_per_week}h/wk · {o.type === "job" ? "ongoing" : `${o.duration_weeks} wk`}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-4" aria-hidden />
          {MODE_LABEL[o.work_mode]}
          {o.work_mode !== "remote" && o.city ? ` · ${o.city}` : ""}
        </span>
        {o.deadline && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-4" aria-hidden />
            {shortDate(o.deadline)}
          </span>
        )}
        {o.academic_options.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="size-4" aria-hidden />
            {o.academic_options.map((a) => ACADEMIC_LABEL[a]).join(", ")}
          </span>
        )}
      </div>
      {o.match && !compact && (
        <div className="flex items-start gap-2 text-xs text-muted-fg">
          <MatchPill match={o.match} />
          <span className="line-clamp-2">{o.match.summary}</span>
        </div>
      )}
    </Link>
  );
}
