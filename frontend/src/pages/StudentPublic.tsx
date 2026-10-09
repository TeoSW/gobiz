import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Github, Globe, GraduationCap, MapPin, UserPlus } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { MatchBreakdown } from "../components/Match";
import { Avatar, Badge, ErrorBox, Notice, SectionTitle, Spinner, Stars } from "../components/ui";
import { api, post } from "../lib/api";
import { cap, shortDate, useFormat } from "../lib/format";
import { roPlural, texts, useTexts } from "../lib/i18n";
import { useSession, useSkillName } from "../lib/session";
import type { Opportunity, Student, StudentCard } from "../lib/types";
import { PortfolioSummary } from "./StudentDashboard";

const T = texts(
  {
    inviteTitle: "Invite to an opportunity",
    yourOpen: "Your open opportunity",
    choose: "Choose...",
    personal: "Personal message (optional)",
    sent: "Invitation sent. The student sees it on their dashboard.",
    send: "Send invitation",
    year: (n: number) => `year ${n}`,
    portfolio: "Portfolio",
    reviews: (n: number) => `${n} review${n === 1 ? "" : "s"}`,
    skills: "Skills",
    selfDeclared: "Self-declared levels",
    wantsToLearn: "Wants to learn:",
    otherProjects: "Other projects",
    notVerified: "Not verified by SkillSync",
    lookingFor: "Looking for",
    hoursWeek: (n: number) => `${n} h/week`,
    domains: "Domains:",
    courses: "Courses:",
    ratingBreakdown: "Rating breakdown",
    dims: { quality: "Quality", deadline: "Deadline", communication: "Communication", clarity: "Clarity", collaboration: "Collaboration", payment: "Payment" } as Record<string, string>,
  },
  {
    inviteTitle: "Invită la o oportunitate",
    yourOpen: "Oportunitatea ta deschisă",
    choose: "Alege...",
    personal: "Mesaj personal (opțional)",
    sent: "Invitația a fost trimisă. Studentul o vede în panoul lui.",
    send: "Trimite invitația",
    year: (n) => `anul ${n}`,
    portfolio: "Portofoliu",
    reviews: (n) => roPlural(n, "recenzie", "recenzii"),
    skills: "Abilități",
    selfDeclared: "Niveluri declarate de student",
    wantsToLearn: "Vrea să învețe:",
    otherProjects: "Alte proiecte",
    notVerified: "Neverificate de SkillSync",
    lookingFor: "Caută",
    hoursWeek: (n) => `${n} h/săptămână`,
    domains: "Domenii:",
    courses: "Materii:",
    ratingBreakdown: "Notele pe criterii",
    dims: { quality: "Calitate", deadline: "Termen", communication: "Comunicare", clarity: "Claritate", collaboration: "Colaborare", payment: "Plată" },
  },
);

function InvitePanel({ studentId }: { studentId: number }) {
  const t = useTexts(T);
  const qc = useQueryClient();
  const skillName = useSkillName();
  const mine = useQuery({ queryKey: ["my-opps"], queryFn: () => api<Opportunity[]>("/opportunities/mine") });
  const open = mine.data?.filter((o) => o.status === "open") ?? [];
  const [oppId, setOppId] = useState<number | "">("");
  const [msg, setMsg] = useState("");
  const preview = useQuery({
    queryKey: ["talent-preview", oppId, studentId],
    queryFn: () => api<StudentCard[]>(`/students?opportunity_id=${oppId}`).then((l) => l.find((s) => s.id === studentId) ?? null),
    enabled: oppId !== "",
  });
  const invite = useMutation({
    mutationFn: () => post(`/opportunities/${oppId}/invite`, { student_id: studentId, message: msg }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <div className="card space-y-3 p-5">
      <h2 className="text-lg font-bold">{t.inviteTitle}</h2>
      <label className="label" htmlFor="inv-opp">
        {t.yourOpen}
      </label>
      <select id="inv-opp" className="input cursor-pointer" value={oppId} onChange={(e) => setOppId(e.target.value ? Number(e.target.value) : "")}>
        <option value="">{t.choose}</option>
        {open.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </select>
      {preview.data?.match && (
        <div className="rounded-xl border border-border p-4">
          <MatchBreakdown match={preview.data.match} skillName={skillName} audience="company" />
        </div>
      )}
      <label className="label" htmlFor="inv-msg">
        {t.personal}
      </label>
      <textarea id="inv-msg" className="input" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} />
      {invite.isSuccess ? (
        <Notice tone="success">{t.sent}</Notice>
      ) : (
        <button className="btn-primary w-full" disabled={oppId === "" || invite.isPending} onClick={() => invite.mutate()}>
          <UserPlus className="size-4" aria-hidden /> {t.send}
        </button>
      )}
      <ErrorBox error={invite.error} />
    </div>
  );
}

export default function StudentPublic() {
  const t = useTexts(T);
  const f = useFormat();
  const { id } = useParams();
  const { user } = useSession();
  const q = useQuery({ queryKey: ["student", id], queryFn: () => api<Student>(`/students/${id}`) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const s = q.data!;
  const known = s.skills.filter((k) => k.level > 0);
  const learning = s.skills.filter((k) => k.wants_to_learn);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="card p-6">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar name={s.name} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold">{s.name}</h1>
              <p className="text-muted-fg">{s.headline}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-fg">
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="size-4" aria-hidden /> {s.study_program}, {t.year(s.year)} · {s.university}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden /> {s.city} · {f.modes[s.work_mode]}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.github_url && (
                  <a className="btn-outline min-h-9 px-3" href={s.github_url} target="_blank" rel="noreferrer">
                    <Github className="size-4" aria-hidden /> GitHub
                  </a>
                )}
                {s.portfolio_url && (
                  <a className="btn-outline min-h-9 px-3" href={s.portfolio_url} target="_blank" rel="noreferrer">
                    <Globe className="size-4" aria-hidden /> {t.portfolio}
                  </a>
                )}
                {s.cv_filename && (
                  <button
                    className="btn-outline min-h-9 px-3"
                    onClick={async () => {
                      const res = await fetch(`/api/students/${s.id}/cv`, { headers: { "X-User-Id": String(user?.id) } });
                      const url = URL.createObjectURL(await res.blob());
                      window.open(url, "_blank", "noopener");
                    }}
                  >
                    <Download className="size-4" aria-hidden /> CV
                  </button>
                )}
              </div>
            </div>
            {s.ratings.average != null && (
              <div className="text-right">
                <p className="text-3xl font-extrabold">{s.ratings.average.toFixed(1)}</p>
                <Stars value={s.ratings.average} />
                <p className="text-xs text-muted-fg">{t.reviews(s.ratings.count)}</p>
              </div>
            )}
          </div>
          {s.bio && <p className="mt-5 text-[15px] leading-relaxed">{s.bio}</p>}
        </div>

        <PortfolioSummary s={s} />

        <div className="card p-6">
          <SectionTitle sub={t.selfDeclared}>{t.skills}</SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2">
            {known.map((k) => (
              <li key={k.skill_id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2">
                <span className="font-medium">{k.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted-fg">
                  <span className="flex gap-0.5" aria-hidden>
                    {[1, 2, 3].map((n) => (
                      <span key={n} className={`h-2 w-4 rounded-full ${n <= k.level ? "bg-primary" : "bg-border"}`} />
                    ))}
                  </span>
                  {f.levels[k.level]}
                </span>
              </li>
            ))}
          </ul>
          {learning.length > 0 && (
            <p className="mt-4 text-sm">
              <span className="font-semibold">{t.wantsToLearn}</span> {learning.map((l) => l.name).join(", ")}
            </p>
          )}
        </div>

        {s.past_projects.length > 0 && (
          <div className="card p-6">
            <SectionTitle sub={t.notVerified}>{t.otherProjects}</SectionTitle>
            <ul className="space-y-3">
              {s.past_projects.map((p) => (
                <li key={p.id ?? p.title}>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-muted-fg">{p.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {user?.role === "company" && <InvitePanel studentId={s.id} />}
        <div className="card space-y-3 p-5 text-sm">
          <h2 className="text-lg font-bold">{t.lookingFor}</h2>
          <div className="flex flex-wrap gap-1.5">
            {s.accepted_types.map((ty) => (
              <Badge key={ty} tone="primary">
                {f.typesPlural[ty]}
              </Badge>
            ))}
          </div>
          <p>{s.goals.map((g) => f.goals[g] ?? g).join(" · ")}</p>
          <p className="text-muted-fg">
            {t.hoursWeek(s.hours_per_week)} · {shortDate(s.available_from)} → {shortDate(s.available_to)}
          </p>
          {s.domains.length > 0 && (
            <p className="text-muted-fg">
              {t.domains} {s.domains.map(f.domain).join(", ")}
            </p>
          )}
          {s.courses.length > 0 && (
            <p className="text-muted-fg">
              {t.courses} {s.courses.join(", ")}
            </p>
          )}
        </div>
        {s.ratings.count > 0 && (
          <div className="card space-y-2 p-5 text-sm">
            <h2 className="text-lg font-bold">{t.ratingBreakdown}</h2>
            {Object.entries(s.ratings.dimensions).map(([k, v]) => (
              <p key={k} className="flex items-center justify-between">
                {t.dims[k] ?? cap(k)}{" "}
                <span className="flex items-center gap-2">
                  <Stars value={v} /> {v.toFixed(1)}
                </span>
              </p>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
