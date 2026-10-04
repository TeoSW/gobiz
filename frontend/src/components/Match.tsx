import clsx from "clsx";
import { Check, ChevronDown, CircleHelp, Info, Sparkles, X } from "lucide-react";
import { LEVELS } from "../lib/format";
import type { Match, SkillRow } from "../lib/types";
import { Badge } from "./ui";

export function fitLabel(m: Match) {
  if (m.status === "incompatible") return "Not a fit";
  if (m.score >= 80) return "Very good fit";
  if (m.score >= 65) return "Good fit";
  if (m.score >= 50) return "Possible fit";
  return "Weak fit";
}

function tone(m: Match) {
  if (m.status === "incompatible") return { ring: "var(--danger)", text: "text-danger" };
  if (m.score >= 80) return { ring: "var(--success)", text: "text-success" };
  if (m.score >= 60) return { ring: "var(--primary)", text: "text-primary-strong" };
  return { ring: "var(--warning)", text: "text-warning" };
}

/** Circular score, always paired with a text label (never color alone). */
export function MatchRing({ match, size = 56 }: { match: Match; size?: number }) {
  const t = tone(match);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = match.status === "incompatible" ? 0 : match.score;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`${Math.round(match.score)}% match, ${fitLabel(match)}`} role="img">
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
  if (match.status === "incompatible") return <Badge tone="danger">Not a fit</Badge>;
  const t = match.score >= 80 ? "success" : match.score >= 60 ? "primary" : "warning";
  return (
    <Badge tone={t} icon={<Sparkles className="size-3" aria-hidden />}>
      {Math.round(match.score)}% · {fitLabel(match)}
    </Badge>
  );
}

const CHECK_TEXT: Record<string, string> = {
  "Opportunity type": "Is looking for this kind of work",
  Availability: "Has enough free time",
  Period: "Is available in that period",
  "Work mode": "Work mode fits (remote / office)",
  "Similar experience": "Has done similar work before",
};

function plainReasons(m: Match) {
  const fits: string[] = [];
  const missingNice: string[] = [];
  for (const r of m.skills) {
    if (r.status === "met") fits.push(`Knows ${r.name}`);
    else if (r.status === "learnable") fits.push(`Can learn ${r.name} with guidance`);
    else if (!r.mandatory) missingNice.push(r.name);
  }
  for (const c of m.checks) if (c.ok === true && CHECK_TEXT[c.label]) fits.push(CHECK_TEXT[c.label]);
  return { fits, missingNice };
}

function ReasonList({ items, kind }: { items: string[]; kind: "ok" | "bad" | "check" }) {
  const Icon = kind === "ok" ? Check : kind === "bad" ? X : CircleHelp;
  const cls = kind === "ok" ? "text-success" : kind === "bad" ? "text-danger" : "text-warning";
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <Icon className={clsx("mt-1 size-4 shrink-0", cls)} aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function SkillDetail({ row, skillName }: { row: SkillRow; skillName: (id: string) => string }) {
  const status: Record<SkillRow["status"], string> = {
    met: "meets the level",
    learnable: "can learn it with guidance",
    below: "level lower than needed",
    related: `not in profile, knows related ${row.via ? skillName(row.via) : ""}`,
    missing: "missing",
    unknown: "not in profile",
  };
  return (
    <li className="flex flex-wrap justify-between gap-x-3 py-1.5">
      <span>
        <span className="font-medium">{row.name}</span>
        {row.mandatory && <span className="text-accent"> (required)</span>}
      </span>
      <span className="text-muted-fg">
        needs {LEVELS[row.required_level].toLowerCase()}
        {row.student_level != null ? `, has ${LEVELS[row.student_level].toLowerCase()}` : ""} · {status[row.status]}
      </span>
    </li>
  );
}

function Bar({ label, value, weight }: { label: string; value: number | null; weight: number }) {
  const pct = value == null ? 0 : Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>
          {label} <span className="text-muted-fg">({Math.round(weight * 100)}% of the score)</span>
        </span>
        <span className="tabular-nums text-muted-fg">{value == null ? "n/a" : `${pct}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MatchBreakdown({ match, skillName, audience = "student" }: { match: Match; skillName: (id: string) => string; audience?: "student" | "company" }) {
  const t = tone(match);
  const { fits, missingNice } = plainReasons(match);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <MatchRing match={match} size={64} />
        <div>
          <p className={clsx("text-xl font-bold", t.text)}>{fitLabel(match)}</p>
          <p className="text-muted-fg">{match.summary}</p>
        </div>
      </div>

      {fits.length > 0 && (
        <div>
          <p className="mb-2 font-semibold">Why it fits</p>
          <ReasonList items={fits} kind="ok" />
        </div>
      )}
      {match.blockers.length > 0 && (
        <div>
          <p className="mb-2 font-semibold">Problems</p>
          <ReasonList items={match.blockers} kind="bad" />
        </div>
      )}
      {match.to_clarify.length > 0 && (
        <div>
          <p className="mb-2 font-semibold">To check</p>
          <ReasonList items={match.to_clarify} kind="check" />
        </div>
      )}
      {missingNice.length > 0 && <p className="text-muted-fg">Nice to have, not in the profile: {missingNice.join(", ")}.</p>}

      <details className="group rounded-xl border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-semibold">
          How is this score calculated?
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="space-y-3">
            <Bar label="Skills" value={match.components.skills} weight={match.weights.skills} />
            <Bar label="Similar experience" value={match.components.experience} weight={match.weights.experience} />
            <Bar label="Interests and goals" value={match.components.interests} weight={match.weights.interests} />
            <Bar label="Similar descriptions (AI)" value={match.components.semantic} weight={match.weights.semantic} />
          </div>
          {match.skills.length > 0 && (
            <ul className="divide-y divide-border text-sm">
              {match.skills.map((r) => (
                <SkillDetail key={r.skill_id} row={r} skillName={skillName} />
              ))}
            </ul>
          )}
          <p className="flex gap-2 text-sm text-muted-fg">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {audience === "student"
              ? "This is only a suggestion. You can apply to any opportunity."
              : "This is only a suggestion. You can invite any student."}
          </p>
        </div>
      </details>
    </div>
  );
}
