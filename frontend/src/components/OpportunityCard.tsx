import { BadgeCheck, Building2, Clock, MapPin, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { money, useFormat } from "../lib/format";
import { texts, useTexts } from "../lib/i18n";
import type { Opportunity } from "../lib/types";
import { MatchRing, fitLabel } from "./Match";
import { Badge } from "./ui";

const TYPE_TONE = { project: "primary", internship: "success", job: "accent" } as const;

const T = texts(
  { verified: "University Verified", needs: "Needs:", nice: "Nice to have", skills: "Skills" },
  { verified: "Validat de universitate", needs: "Cere:", nice: "Ar fi util", skills: "Abilități" },
);

export function TypeBadge({ type }: { type: Opportunity["type"] }) {
  const f = useFormat();
  return <Badge tone={TYPE_TONE[type]}>{f.types[type]}</Badge>;
}

export function StatusBadge({ status }: { status: Opportunity["status"] }) {
  const f = useFormat();
  const tone = status === "open" ? "success" : status === "completed" ? "primary" : status === "closed" ? "neutral" : "warning";
  return <Badge tone={tone}>{f.status[status]}</Badge>;
}

export function OpportunityCard({ o, showStatus = false, compact = false }: { o: Opportunity; showStatus?: boolean; compact?: boolean }) {
  const t = useTexts(T);
  const f = useFormat();
  const required = o.skills.filter((s) => s.mandatory).map((s) => s.name);
  const nice = o.skills.filter((s) => !s.mandatory).map((s) => s.name);
  return (
    <Link
      to={`/opportunities/${o.id}`}
      className="card group flex cursor-pointer flex-col gap-3 p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={o.type} />
            {o.university_verified && (
              <Badge tone="primary" icon={<BadgeCheck className="size-3" aria-hidden />}>
                {t.verified}
              </Badge>
            )}
            {showStatus && <StatusBadge status={o.status} />}
          </div>
          <h3 className="text-lg leading-snug font-bold group-hover:text-primary-strong">{o.title}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-muted-fg">
            <Building2 className="size-4" aria-hidden />
            {o.company.name}
          </p>
        </div>
        {o.match && (
          <div className="flex flex-col items-center gap-1">
            <MatchRing match={o.match} size={52} />
            <span className="text-xs font-semibold text-muted-fg">{fitLabel(o.match)}</span>
          </div>
        )}
      </div>

      {!compact && <p className="line-clamp-2 text-muted-fg">{o.description}</p>}

      <p className="text-sm">
        {required.length > 0 && (
          <>
            <span className="font-semibold">{t.needs}</span> {required.join(", ")}
          </>
        )}
        {required.length > 0 && nice.length > 0 && <span className="text-muted-fg"> · </span>}
        {nice.length > 0 && (
          <span className="text-muted-fg">
            {required.length > 0 ? t.nice : t.skills}: {nice.join(", ")}
          </span>
        )}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-3 text-muted-fg">
        <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
          <Wallet className="size-4" aria-hidden />
          {money(o)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden />
          {f.hoursWeek(o.hours_per_week)}
          {o.type === "job" ? "" : ` · ${f.weeks(o.duration_weeks)}`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden />
          {f.modes[o.work_mode]}
          {o.work_mode !== "remote" && o.city ? `, ${o.city}` : ""}
        </span>
      </div>
    </Link>
  );
}
