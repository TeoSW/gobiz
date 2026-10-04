import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Briefcase, FolderKanban, GraduationCap, Search, SlidersHorizontal, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { OpportunityCard } from "../components/OpportunityCard";
import { Empty, ErrorBox, Skeleton, Tabs, ToggleChip } from "../components/ui";
import { api } from "../lib/api";
import { ACADEMIC_LABEL, TYPE_PLURAL } from "../lib/format";
import { useSession } from "../lib/session";
import type { Opportunity, OppType } from "../lib/types";

const TAB_ICON = { project: FolderKanban, internship: GraduationCap, job: Briefcase };

export default function Explore() {
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
  const byType = (t: OppType) => filtered.filter((o) => o.type === t);
  const items = byType(type);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Opportunities</h1>
          <p className="mt-1 max-w-2xl text-muted-fg">
            {isStudent
              ? "The percentage shows how well each one fits you. You can apply to any of them."
              : "Projects, internships and jobs posted by companies."}
          </p>
        </div>
      </div>

      <Tabs
        label="Opportunity type"
        value={type}
        onChange={(t) => setParams({ type: t })}
        tabs={(["project", "internship", "job"] as OppType[]).map((t) => {
          const Icon = TAB_ICON[t];
          return {
            id: t,
            label: (
              <>
                <Icon className="size-4" aria-hidden /> {TYPE_PLURAL[t]}
              </>
            ),
            count: all.data ? byType(t).length : undefined,
          };
        })}
      />

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-fg" aria-hidden />
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <input id="search" className="input pl-9" placeholder="Search by title, company or skill" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button type="button" className="btn-outline" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="more-filters">
            <SlidersHorizontal className="size-4" aria-hidden /> {showFilters ? "Hide filters" : "More filters"}
            {activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-fg">{activeFilters}</span>}
          </button>
        </div>
        {showFilters && (
          <div id="more-filters" className="space-y-3 border-t border-border pt-3">
            <div className="flex flex-wrap gap-3">
              <label className="sr-only" htmlFor="skill-filter">
                Skill
              </label>
              <select id="skill-filter" className="input w-auto min-w-[160px] cursor-pointer" value={skill} onChange={(e) => setSkill(e.target.value)}>
                <option value="">Any skill</option>
                {meta?.skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="mode-filter">
                Work mode
              </label>
              <select id="mode-filter" className="input w-auto cursor-pointer" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="">Remote or office</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">At the office</option>
              </select>
              <label className="sr-only" htmlFor="sort">
                Sort
              </label>
              <select id="sort" className="input w-auto cursor-pointer" value={sort} onChange={(e) => setSort(e.target.value)}>
                {isStudent && <option value="match">Best fit first</option>}
                <option value="recent">Newest first</option>
                <option value="budget">Highest pay first</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleChip checked={verified} onChange={setVerified}>
                <BadgeCheck className="size-4" aria-hidden /> University Verified
              </ToggleChip>
              <ToggleChip checked={mentoring} onChange={setMentoring}>
                <Users className="size-4" aria-hidden /> With a mentor
              </ToggleChip>
              {Object.entries(ACADEMIC_LABEL).map(([k, label]) => (
                <ToggleChip key={k} checked={academic === k} onChange={(v) => setAcademic(v ? k : "")}>
                  <GraduationCap className="size-4" aria-hidden /> {label}
                </ToggleChip>
              ))}
              {isStudent && (
                <ToggleChip checked={hideIncompatible} onChange={setHideIncompatible}>
                  Hide "Not a fit"
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
        <Empty icon={<Search className="size-8" />} title={`No ${TYPE_PLURAL[type].toLowerCase()} match these filters`}>
          Try removing a filter or searching for another skill.
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
