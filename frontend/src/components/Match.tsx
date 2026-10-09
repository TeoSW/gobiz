import clsx from "clsx";
import { Check, ChevronDown, CircleHelp, Info, Sparkles, X } from "lucide-react";
import { useFormat } from "../lib/format";
import { getLang, texts, useTexts } from "../lib/i18n";
import type { Match, SkillRow } from "../lib/types";
import { Badge } from "./ui";

const T = texts(
  {
    notFit: "Not a fit",
    veryGood: "Very good fit",
    good: "Good fit",
    possible: "Possible fit",
    weak: "Weak fit",
    ringLabel: (score: number, label: string) => `${score}% match, ${label}`,
    checks: {
      type: "Is looking for this kind of work",
      availability: "Has enough free time",
      period: "Is available in that period",
      mode: "Work mode fits (remote / office)",
      experience: "Has done similar work before",
    } as Record<string, string>,
    knows: (s: string) => `Knows ${s}`,
    canLearn: (s: string) => `Can learn ${s} with guidance`,
    skillStatus: {
      met: "meets the level",
      learnable: "can learn it with guidance",
      below: "level lower than needed",
      related: (via: string) => `not in profile, knows related ${via}`,
      missing: "missing",
      unknown: "not in profile",
    },
    required: " (required)",
    needs: (level: string) => `needs ${level}`,
    has: (level: string) => `, has ${level}`,
    ofScore: (pct: number) => `(${pct}% of the score)`,
    na: "n/a",
    whyFits: "Why it fits",
    problems: "Problems",
    toCheck: "To check",
    niceMissing: (list: string) => `Nice to have, not in the profile: ${list}.`,
    howCalculated: "How is this score calculated?",
    bars: { skills: "Skills", experience: "Similar experience", interests: "Interests and goals", semantic: "Similar descriptions (AI)" },
    onlySuggestionStudent: "This is only a suggestion. You can apply to any opportunity.",
    onlySuggestionCompany: "This is only a suggestion. You can invite any student.",
  },
  {
    notFit: "Nu se potrivește",
    veryGood: "Potrivire foarte bună",
    good: "Potrivire bună",
    possible: "Potrivire posibilă",
    weak: "Potrivire slabă",
    ringLabel: (score, label) => `potrivire ${score}%, ${label}`,
    checks: {
      type: "Caută acest tip de activitate",
      availability: "Are destul timp liber",
      period: "Este disponibil în acea perioadă",
      mode: "Modul de lucru se potrivește (remote / birou)",
      experience: "A mai făcut ceva asemănător",
    },
    knows: (s) => `Știe ${s}`,
    canLearn: (s) => `Poate învăța ${s} cu îndrumare`,
    skillStatus: {
      met: "are nivelul cerut",
      learnable: "poate învăța cu îndrumare",
      below: "nivel mai mic decât cel cerut",
      related: (via) => `nu e în profil, știe ${via} (înrudit)`,
      missing: "lipsește",
      unknown: "nu e în profil",
    },
    required: " (obligatoriu)",
    needs: (level) => `cere ${level}`,
    has: (level) => `, are ${level}`,
    ofScore: (pct) => `(${pct}% din scor)`,
    na: "n/a",
    whyFits: "De ce se potrivește",
    problems: "Probleme",
    toCheck: "De verificat",
    niceMissing: (list) => `Ar fi util, dar nu apare în profil: ${list}.`,
    howCalculated: "Cum se calculează scorul?",
    bars: { skills: "Abilități", experience: "Experiență similară", interests: "Interese și obiective", semantic: "Descrieri asemănătoare (AI)" },
    onlySuggestionStudent: "Este doar o sugestie. Poți aplica la orice oportunitate.",
    onlySuggestionCompany: "Este doar o sugestie. Poți invita orice student.",
  },
);

export function fitLabel(m: Match) {
  const t = T[getLang()];
  if (m.status === "incompatible") return t.notFit;
  if (m.score >= 80) return t.veryGood;
  if (m.score >= 65) return t.good;
  if (m.score >= 50) return t.possible;
  return t.weak;
}

function tone(m: Match) {
  if (m.status === "incompatible") return { ring: "var(--danger)", text: "text-danger" };
  if (m.score >= 80) return { ring: "var(--success)", text: "text-success" };
  if (m.score >= 60) return { ring: "var(--primary)", text: "text-primary-strong" };
  return { ring: "var(--warning)", text: "text-warning" };
}

/** Circular score, always paired with a text label (never color alone). */
export function MatchRing({ match, size = 56 }: { match: Match; size?: number }) {
  const tx = useTexts(T);
  const t = tone(match);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = match.status === "incompatible" ? 0 : match.score;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={tx.ringLabel(Math.round(match.score), fitLabel(match))} role="img">
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
  const tx = useTexts(T);
  if (match.status === "incompatible") return <Badge tone="danger">{tx.notFit}</Badge>;
  const t = match.score >= 80 ? "success" : match.score >= 60 ? "primary" : "warning";
  return (
    <Badge tone={t} icon={<Sparkles className="size-3" aria-hidden />}>
      {Math.round(match.score)}% · {fitLabel(match)}
    </Badge>
  );
}

function plainReasons(m: Match, t: (typeof T)["en"]) {
  const fits: string[] = [];
  const missingNice: string[] = [];
  for (const r of m.skills) {
    if (r.status === "met") fits.push(t.knows(r.name));
    else if (r.status === "learnable") fits.push(t.canLearn(r.name));
    else if (!r.mandatory) missingNice.push(r.name);
  }
  for (const c of m.checks) if (c.ok === true && t.checks[c.code]) fits.push(t.checks[c.code]);
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
  const t = useTexts(T);
  const f = useFormat();
  const s = t.skillStatus;
  const status = row.status === "related" ? s.related(row.via ? skillName(row.via) : "") : s[row.status];
  return (
    <li className="flex flex-wrap justify-between gap-x-3 py-1.5">
      <span>
        <span className="font-medium">{row.name}</span>
        {row.mandatory && <span className="text-accent">{t.required}</span>}
      </span>
      <span className="text-muted-fg">
        {t.needs(f.levels[row.required_level].toLowerCase())}
        {row.student_level != null ? t.has(f.levels[row.student_level].toLowerCase()) : ""} · {status}
      </span>
    </li>
  );
}

function Bar({ label, value, weight }: { label: string; value: number | null; weight: number }) {
  const t = useTexts(T);
  const pct = value == null ? 0 : Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>
          {label} <span className="text-muted-fg">{t.ofScore(Math.round(weight * 100))}</span>
        </span>
        <span className="tabular-nums text-muted-fg">{value == null ? t.na : `${pct}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MatchBreakdown({ match, skillName, audience = "student" }: { match: Match; skillName: (id: string) => string; audience?: "student" | "company" }) {
  const tx = useTexts(T);
  const t = tone(match);
  const { fits, missingNice } = plainReasons(match, tx);
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
          <p className="mb-2 font-semibold">{tx.whyFits}</p>
          <ReasonList items={fits} kind="ok" />
        </div>
      )}
      {match.blockers.length > 0 && (
        <div>
          <p className="mb-2 font-semibold">{tx.problems}</p>
          <ReasonList items={match.blockers} kind="bad" />
        </div>
      )}
      {match.to_clarify.length > 0 && (
        <div>
          <p className="mb-2 font-semibold">{tx.toCheck}</p>
          <ReasonList items={match.to_clarify} kind="check" />
        </div>
      )}
      {missingNice.length > 0 && <p className="text-muted-fg">{tx.niceMissing(missingNice.join(", "))}</p>}

      <details className="group rounded-xl border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-semibold">
          {tx.howCalculated}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="space-y-3">
            <Bar label={tx.bars.skills} value={match.components.skills} weight={match.weights.skills} />
            <Bar label={tx.bars.experience} value={match.components.experience} weight={match.weights.experience} />
            <Bar label={tx.bars.interests} value={match.components.interests} weight={match.weights.interests} />
            <Bar label={tx.bars.semantic} value={match.components.semantic} weight={match.weights.semantic} />
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
            {audience === "student" ? tx.onlySuggestionStudent : tx.onlySuggestionCompany}
          </p>
        </div>
      </details>
    </div>
  );
}
