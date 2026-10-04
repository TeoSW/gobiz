import clsx from "clsx";
import { AlertCircle, Check, CircleHelp, Info, Sparkles, X } from "lucide-react";
import { LEVELS } from "../lib/format";
import type { Match, SkillRow } from "../lib/types";
import { Badge } from "./ui";

function tone(m: Match) {
  if (m.status === "incompatible") return { ring: "var(--danger)", text: "text-danger", label: "Not a fit" };
  if (m.score >= 80) return { ring: "var(--success)", text: "text-success", label: `${m.label} match` };
  if (m.score >= 60) return { ring: "var(--primary)", text: "text-primary-strong", label: `${m.label} match` };
  return { ring: "var(--warning)", text: "text-warning", label: `${m.label} match` };
}

/** Compact circular score - always paired with a text label, never color alone. */
export function MatchRing({ match, size = 56 }: { match: Match; size?: number }) {
  const t = tone(match);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = match.status === "incompatible" ? 0 : match.score;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Match ${Math.round(match.score)}%, ${t.label}`} role="img">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.ring} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <span className={clsx("absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums", t.text)}>
        {match.status === "incompatible" ? <X className="size-5" aria-hidden /> : `${Math.round(match.score)}%`}
      </span>
    </div>
  );
}

export function MatchPill({ match }: { match: Match }) {
  if (match.status === "incompatible") return <Badge tone="danger" icon={<X className="size-3" aria-hidden />}>Not a fit</Badge>;
  const t = match.score >= 80 ? "success" : match.score >= 60 ? "primary" : "warning";
  return (
    <Badge tone={t} icon={<Sparkles className="size-3" aria-hidden />}>
      {Math.round(match.score)}% match{match.status === "to_clarify" ? " · to clarify" : ""}
    </Badge>
  );
}

const ROW_ICON: Record<SkillRow["status"], { icon: typeof Check; cls: string; text: string }> = {
  met: { icon: Check, cls: "text-success bg-success-soft", text: "Meets level" },
  learnable: { icon: Sparkles, cls: "text-primary-strong bg-primary-soft", text: "Can learn with guidance" },
  below: { icon: AlertCircle, cls: "text-warning bg-warning-soft", text: "Below required level" },
  related: { icon: CircleHelp, cls: "text-warning bg-warning-soft", text: "Related skill" },
  missing: { icon: X, cls: "text-danger bg-danger-soft", text: "Missing" },
  unknown: { icon: CircleHelp, cls: "text-warning bg-warning-soft", text: "Not declared" },
};

export function SkillMatchRow({ row, skillName }: { row: SkillRow; skillName: (id: string) => string }) {
  const meta = ROW_ICON[row.status];
  const Icon = meta.icon;
  return (
    <li className="flex items-center gap-3 py-2">
      <span className={clsx("inline-flex size-7 shrink-0 items-center justify-center rounded-full", meta.cls)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {row.name}
          {row.mandatory && <span className="ml-1.5 text-xs font-semibold text-accent">required</span>}
          {row.learnable && <span className="ml-1.5 text-xs text-muted-fg">learnable</span>}
        </p>
        <p className="text-xs text-muted-fg">
          {meta.text}
          {row.status === "related" && row.via ? ` (${skillName(row.via)})` : ""} · needs {LEVELS[row.required_level].toLowerCase()}
          {row.student_level != null ? `, has ${LEVELS[row.student_level].toLowerCase()}` : ""}
          {row.wants_to_learn ? " · wants to learn" : ""}
        </p>
      </div>
    </li>
  );
}

function Bar({ label, value, weight }: { label: string; value: number | null; weight: number }) {
  const pct = value == null ? 0 : Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">
          {label} <span className="text-muted-fg">· weight {Math.round(weight * 100)}%</span>
        </span>
        <span className="tabular-nums text-muted-fg">{value == null ? "n/a" : `${pct}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MatchBreakdown({ match, skillName, audience = "student" }: { match: Match; skillName: (id: string) => string; audience?: "student" | "company" }) {
  const t = tone(match);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <MatchRing match={match} size={72} />
        <div>
          <p className={clsx("text-lg font-bold", t.text)}>{t.label}</p>
          <p className="text-sm text-muted-fg">{match.summary}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {match.highlights.map((h) => (
          <span key={h} className="chip">
            {h}
          </span>
        ))}
      </div>

      {match.blockers.length > 0 && (
        <div className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <p className="mb-1 font-semibold">Hard filters not met</p>
          <ul className="list-inside list-disc space-y-0.5">
            {match.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      {match.to_clarify.length > 0 && (
        <div className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
          <p className="mb-1 font-semibold">To clarify</p>
          <ul className="list-inside list-disc space-y-0.5">
            {match.to_clarify.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {match.skills.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold">Skills</p>
          <ul className="divide-y divide-border">
            {match.skills.map((r) => (
              <SkillMatchRow key={r.skill_id} row={r} skillName={skillName} />
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-semibold">How the score is built</p>
        <Bar label="Skills" value={match.components.skills} weight={match.weights.skills} />
        <Bar label="Relevant experience" value={match.components.experience} weight={match.weights.experience} />
        <Bar label="Interests & goals" value={match.components.interests} weight={match.weights.interests} />
        <Bar label="Description similarity (AI)" value={match.components.semantic} weight={match.weights.semantic} />
      </div>

      <div className="flex flex-wrap gap-2">
        {match.checks.map((c) => (
          <span key={c.label} className="chip" title={c.detail}>
            {c.ok === true ? <Check className="size-3.5 text-success" aria-hidden /> : c.ok === false ? <X className="size-3.5 text-danger" aria-hidden /> : <CircleHelp className="size-3.5 text-warning" aria-hidden />}
            {c.label}
            <span className="sr-only">{c.ok === true ? "ok" : c.ok === false ? "not met" : "to clarify"}</span>
          </span>
        ))}
      </div>

      <p className="flex gap-2 text-xs text-muted-fg">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {audience === "student"
          ? "This is a recommendation, not a decision: you can apply to any opportunity. The score ranks options; it is not a probability of being selected."
          : "This is a recommendation, not a decision: you can invite any student. The score ranks candidates; it is not a probability of success."}
      </p>
    </div>
  );
}
