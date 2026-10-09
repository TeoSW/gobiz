import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Search, Star, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MatchPill, MatchRing } from "../components/Match";
import { Avatar, Badge, Empty, ErrorBox, Segmented, Skeleton } from "../components/ui";
import { api, post } from "../lib/api";
import { useFormat } from "../lib/format";
import { texts, useTexts } from "../lib/i18n";
import { useSession } from "../lib/session";
import type { Opportunity, StudentCard } from "../lib/types";

const T = texts(
  {
    invited: "Invited",
    invite: "Invite",
    title: "Talent search",
    intro: "Search every student, not only the recommended ones. Pick one of your opportunities to rank them by match.",
    searchStudents: "Search students",
    placeholder: "Name, university, keyword",
    skill: "Skill",
    anySkill: "Any skill",
    lookingFor: "Looking for",
    anything: "Looking for anything",
    rankFor: "Rank for opportunity",
    rankForPlaceholder: "Rank for opportunity...",
    minLevel: "Minimum level",
    none: "No students match these filters",
    year: (n: number) => `year ${n}`,
    verified: (n: number) => `${n} verified`,
    viewProfile: "View profile",
  },
  {
    invited: "Invitat",
    invite: "Invită",
    title: "Caută talente",
    intro: "Caută printre toți studenții, nu doar printre cei recomandați. Alege una dintre oportunitățile tale ca să-i ordonezi după potrivire.",
    searchStudents: "Caută studenți",
    placeholder: "Nume, universitate, cuvânt cheie",
    skill: "Abilitate",
    anySkill: "Orice abilitate",
    lookingFor: "Caută",
    anything: "Caută orice",
    rankFor: "Ordonează pentru oportunitatea",
    rankForPlaceholder: "Ordonează pentru oportunitatea...",
    minLevel: "Nivel minim",
    none: "Niciun student pentru aceste filtre",
    year: (n) => `anul ${n}`,
    verified: (n) => `${n} verificate`,
    viewProfile: "Vezi profilul",
  },
);

function InviteButton({ oppId, studentId }: { oppId: number; studentId: number }) {
  const t = useTexts(T);
  const qc = useQueryClient();
  const m = useMutation({ mutationFn: () => post(`/opportunities/${oppId}/invite`, { student_id: studentId }), onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }) });
  if (m.isSuccess) return <Badge tone="success">{t.invited}</Badge>;
  return (
    <>
      <button className="btn-primary min-h-9 px-3" onClick={() => m.mutate()} disabled={m.isPending}>
        <UserPlus className="size-4" aria-hidden /> {t.invite}
      </button>
      {m.error && <span className="text-xs text-danger">{(m.error as Error).message}</span>}
    </>
  );
}

export default function Talent() {
  const t = useTexts(T);
  const f = useFormat();
  const { meta } = useSession();
  const [params, setParams] = useSearchParams();
  const oppId = params.get("opportunity") ?? "";
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [level, setLevel] = useState(1);
  const [type, setType] = useState("");
  const mine = useQuery({ queryKey: ["my-opps"], queryFn: () => api<Opportunity[]>("/opportunities/mine") });
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (skill) {
    qs.set("skill", skill);
    qs.set("min_level", String(level));
  }
  if (type) qs.set("type", type);
  if (oppId) qs.set("opportunity_id", oppId);
  const students = useQuery({ queryKey: ["talent", qs.toString()], queryFn: () => api<StudentCard[]>(`/students?${qs}`) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">{t.title}</h1>
        <p className="mt-1 text-muted-fg">{t.intro}</p>
      </div>

      <div className="card grid gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-fg" aria-hidden />
          <label htmlFor="tq" className="sr-only">
            {t.searchStudents}
          </label>
          <input id="tq" className="input pl-9" placeholder={t.placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="tskill">
          {t.skill}
        </label>
        <select id="tskill" className="input cursor-pointer md:w-48" value={skill} onChange={(e) => setSkill(e.target.value)}>
          <option value="">{t.anySkill}</option>
          {meta?.skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="ttype">
          {t.lookingFor}
        </label>
        <select id="ttype" className="input cursor-pointer md:w-44" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t.anything}</option>
          {(["project", "internship", "job"] as const).map((ty) => (
            <option key={ty} value={ty}>
              {f.typesPlural[ty]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="topp">
          {t.rankFor}
        </label>
        <select
          id="topp"
          className="input cursor-pointer md:w-64"
          value={oppId}
          onChange={(e) => setParams(e.target.value ? { opportunity: e.target.value } : {})}
        >
          <option value="">{t.rankForPlaceholder}</option>
          {mine.data
            ?.filter((o) => o.status === "open")
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
        </select>
        {skill && (
          <div className="flex items-center gap-2 md:col-span-4">
            <span className="text-sm text-muted-fg">{t.minLevel}</span>
            <Segmented size="sm" label={t.minLevel} value={level} onChange={setLevel} options={[1, 2, 3].map((l) => ({ value: l, label: f.levels[l] }))} />
          </div>
        )}
      </div>

      <ErrorBox error={students.error} />
      {students.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : !students.data?.length ? (
        <Empty icon={<Users className="size-8" />} title={t.none} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {students.data.map((s) => (
            <div key={s.id} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <Link to={`/students/${s.id}`} className="link font-bold">
                    {s.name}
                  </Link>
                  <p className="text-sm text-muted-fg">{s.headline}</p>
                  <p className="text-xs text-muted-fg">
                    {s.university} · {t.year(s.year)} · {s.city}
                  </p>
                </div>
                {s.match && <MatchRing match={s.match} size={48} />}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.top_skills.map((k) => (
                  <span key={k.skill_id} className="chip">
                    {k.name} <span className="text-muted-fg">{"●".repeat(k.level)}</span>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-fg">
                <span className="inline-flex items-center gap-1">
                  <Award className="size-4" aria-hidden /> {t.verified(s.completed_projects)}
                </span>
                {s.rating != null && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden /> {s.rating.toFixed(1)}
                  </span>
                )}
                <span>{s.accepted_types.map((ty) => f.typesPlural[ty]).join(" · ")}</span>
              </div>
              {s.match && (
                <p className="text-xs text-muted-fg">
                  <MatchPill match={s.match} /> {s.match.summary}
                </p>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Link to={`/students/${s.id}`} className="btn-outline min-h-9 px-3">
                  {t.viewProfile}
                </Link>
                {oppId && <InviteButton oppId={Number(oppId)} studentId={s.id} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
