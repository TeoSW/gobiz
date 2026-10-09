import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Briefcase, FolderKanban, GraduationCap, Search, SlidersHorizontal, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { OpportunityCard } from "../components/OpportunityCard";
import { Empty, ErrorBox, Skeleton, Tabs, ToggleChip } from "../components/ui";
import { api } from "../lib/api";
import { useFormat } from "../lib/format";
import { texts, useTexts } from "../lib/i18n";
import { useSession } from "../lib/session";
import type { Opportunity, OppType } from "../lib/types";

const TAB_ICON = { project: FolderKanban, internship: GraduationCap, job: Briefcase };

const T = texts(
  {
    title: "Opportunities",
    subStudent: "The percentage shows how well each one fits you. You can apply to any of them.",
    subOther: "Projects, internships and jobs posted by companies.",
    typeTabs: "Opportunity type",
    search: "Search",
    searchPlaceholder: "Search by title, company or skill",
    hideFilters: "Hide filters",
    moreFilters: "More filters",
    skill: "Skill",
    anySkill: "Any skill",
    workMode: "Work mode",
    anyMode: "Remote or office",
    remote: "Remote",
    hybrid: "Hybrid",
    onsite: "At the office",
    sort: "Sort",
    bestFit: "Best fit first",
    newest: "Newest first",
    highestPay: "Highest pay first",
    verified: "University Verified",
    mentor: "With a mentor",
    hideNotFit: 'Hide "Not a fit"',
    none: (types: string) => `No ${types} match these filters`,
    noneText: "Try removing a filter or searching for another skill.",
  },
  {
    title: "Oportunități",
    subStudent: "Procentul arată cât de bine ți se potrivește fiecare. Poți aplica la oricare.",
    subOther: "Proiecte, stagii și joburi publicate de firme.",
    typeTabs: "Tipul oportunității",
    search: "Caută",
    searchPlaceholder: "Caută după titlu, firmă sau abilitate",
    hideFilters: "Ascunde filtrele",
    moreFilters: "Mai multe filtre",
    skill: "Abilitate",
    anySkill: "Orice abilitate",
    workMode: "Mod de lucru",
    anyMode: "Remote sau la birou",
    remote: "Remote",
    hybrid: "Hibrid",
    onsite: "La birou",
    sort: "Ordonare",
    bestFit: "Cele mai potrivite primele",
    newest: "Cele mai noi primele",
    highestPay: "Cele mai bine plătite primele",
    verified: "Validat de universitate",
    mentor: "Cu mentor",
    hideNotFit: "Ascunde „Nu se potrivește”",
    none: (types) => `Nu există ${types} pentru aceste filtre`,
    noneText: "Încearcă să scoți un filtru sau să cauți altă abilitate.",
  },
);

export default function Explore() {
  const t = useTexts(T);
  const f = useFormat();
  const { user, meta } = useSession();
  const [params, setParams] = useSearchParams();
  const type = (params.get("type") as OppType) || "project";
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [mode, setMode] = useState("");
  const [academic, setAcademic] = useState("");
  const [verified, setVerified] = useState(false);
  const [mentoring, setMentoring] = useState(false);
  const [hideIncompatible, setHideIncompatible] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const isStudent = user?.role === "student";
  const [sort, setSort] = useState(isStudent ? "match" : "recent");

  const qs = new URLSearchParams({ sort: isStudent ? sort : sort === "match" ? "recent" : sort });
  if (skill) qs.set("skill", skill);
  if (mode) qs.set("work_mode", mode);
  if (academic) qs.set("academic", academic);
  if (verified) qs.set("verified", "true");
  if (mentoring) qs.set("mentoring", "true");

  const activeFilters = [skill, mode, academic, verified, mentoring, hideIncompatible].filter(Boolean).length;

  const all = useQuery({
    queryKey: ["opps", user?.id, qs.toString()],
    queryFn: () => api<Opportunity[]>(`/opportunities?${qs}`),
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all.data ?? []).filter(
      (o) =>
        (!needle || `${o.title} ${o.description} ${o.company.name} ${o.skills.map((s) => s.name).join(" ")}`.toLowerCase().includes(needle)) &&
        (!hideIncompatible || o.match?.status !== "incompatible"),
    );
  }, [all.data, q, hideIncompatible]);
  const byType = (ty: OppType) => filtered.filter((o) => o.type === ty);
  const items = byType(type);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t.title}</h1>
          <p className="mt-1 max-w-2xl text-muted-fg">{isStudent ? t.subStudent : t.subOther}</p>
        </div>
      </div>

      <Tabs
        label={t.typeTabs}
        value={type}
        onChange={(ty) => setParams({ type: ty })}
        tabs={(["project", "internship", "job"] as OppType[]).map((ty) => {
          const Icon = TAB_ICON[ty];
          return {
            id: ty,
            label: (
              <>
                <Icon className="size-4" aria-hidden /> {f.typesPlural[ty]}
              </>
            ),
            count: all.data ? byType(ty).length : undefined,
          };
        })}
      />

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-fg" aria-hidden />
            <label htmlFor="search" className="sr-only">
              {t.search}
            </label>
            <input id="search" className="input pl-9" placeholder={t.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button type="button" className="btn-outline" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="more-filters">
            <SlidersHorizontal className="size-4" aria-hidden /> {showFilters ? t.hideFilters : t.moreFilters}
            {activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-fg">{activeFilters}</span>}
          </button>
        </div>
        {showFilters && (
          <div id="more-filters" className="space-y-3 border-t border-border pt-3">
            <div className="flex flex-wrap gap-3">
              <label className="sr-only" htmlFor="skill-filter">
                {t.skill}
              </label>
              <select id="skill-filter" className="input w-auto min-w-[160px] cursor-pointer" value={skill} onChange={(e) => setSkill(e.target.value)}>
                <option value="">{t.anySkill}</option>
                {meta?.skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="mode-filter">
                {t.workMode}
              </label>
              <select id="mode-filter" className="input w-auto cursor-pointer" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="">{t.anyMode}</option>
                <option value="remote">{t.remote}</option>
                <option value="hybrid">{t.hybrid}</option>
                <option value="onsite">{t.onsite}</option>
              </select>
              <label className="sr-only" htmlFor="sort">
                {t.sort}
              </label>
              <select id="sort" className="input w-auto cursor-pointer" value={sort} onChange={(e) => setSort(e.target.value)}>
                {isStudent && <option value="match">{t.bestFit}</option>}
                <option value="recent">{t.newest}</option>
                <option value="budget">{t.highestPay}</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleChip checked={verified} onChange={setVerified}>
                <BadgeCheck className="size-4" aria-hidden /> {t.verified}
              </ToggleChip>
              <ToggleChip checked={mentoring} onChange={setMentoring}>
                <Users className="size-4" aria-hidden /> {t.mentor}
              </ToggleChip>
              {Object.entries(f.academic).map(([k, label]) => (
                <ToggleChip key={k} checked={academic === k} onChange={(v) => setAcademic(v ? k : "")}>
                  <GraduationCap className="size-4" aria-hidden /> {label}
                </ToggleChip>
              ))}
              {isStudent && (
                <ToggleChip checked={hideIncompatible} onChange={setHideIncompatible}>
                  {t.hideNotFit}
                </ToggleChip>
              )}
            </div>
          </div>
        )}
      </div>

      <ErrorBox error={all.error} />
      {all.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty icon={<Search className="size-8" />} title={t.none(f.typesPlural[type].toLowerCase())}>
          {t.noneText}
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((o) => (
            <OpportunityCard key={o.id} o={o} />
          ))}
        </div>
      )}
    </div>
  );
}
