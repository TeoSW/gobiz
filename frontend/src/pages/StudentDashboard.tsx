import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, BadgeCheck, Inbox, Mail, Sparkles, Star, UserPen } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CvUpload } from "../components/CvUpload";
import { OpportunityCard, StatusBadge, TypeBadge } from "../components/OpportunityCard";
import { Badge, Empty, ErrorBox, SectionTitle, Skeleton, StatCard, Stars, Tabs } from "../components/ui";
import { api, post } from "../lib/api";
import { TYPE_PLURAL, shortDate } from "../lib/format";
import type { MyApplication, Opportunity, OppType, Student } from "../lib/types";

export function PortfolioSummary({ s }: { s: Student }) {
  const p = s.portfolio;
  return (
    <div className="card p-5">
      <SectionTitle sub="Projects finished on GoBiz and rated by the company">Your portfolio</SectionTitle>
      {p.completed === 0 ? (
        <Empty icon={<Award className="size-8" />} title="No verified projects yet">
          Complete your first project to turn "I know Power BI" into proof.
        </Empty>
      ) : (
        <>
          <p className="text-lg font-bold">
            {p.completed} completed project{p.completed > 1 ? "s" : ""}
            {p.by_skill.slice(0, 3).map((b) => ` · ${b.count} ${b.name}`)}
            {p.average_rating != null && ` · rating ${p.average_rating.toFixed(1)}/5`}
          </p>
          <ul className="mt-4 divide-y divide-border">
            {p.items.map((i) => (
              <li key={i.opportunity_id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div className="min-w-0">
                  <Link to={`/opportunities/${i.opportunity_id}`} className="link font-semibold">
                    {i.title}
                  </Link>
                  <p className="text-sm text-muted-fg">
                    {i.company} · {shortDate(i.completed_at)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {i.skills.map((sk) => (
                      <span key={sk} className="chip">
                        {sk}
                      </span>
                    ))}
                    {i.university_verified && <Badge tone="primary" icon={<BadgeCheck className="size-3" aria-hidden />}>University Verified</Badge>}
                  </div>
                  {i.review && <p className="mt-1 text-sm italic text-muted-fg">"{i.review}"</p>}
                </div>
                {i.rating != null && (
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <Stars value={i.rating} /> {i.rating.toFixed(1)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function StudentDashboard() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<OppType>("project");
  const me = useQuery({ queryKey: ["student-me"], queryFn: () => api<Student>("/students/me") });
  const recs = useQuery({ queryKey: ["recs", tab], queryFn: () => api<Opportunity[]>(`/students/me/recommendations?type=${tab}&limit=6`) });
  const apps = useQuery({ queryKey: ["my-apps"], queryFn: () => api<MyApplication[]>("/applications/mine") });
  const respond = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) => post(`/applications/${id}/respond`, { action }),
    onSuccess: () => qc.invalidateQueries(),
  });

  const invites = apps.data?.filter((a) => a.kind === "invitation" && a.status === "pending") ?? [];
  const active = apps.data?.filter((a) => a.status === "selected" && a.opportunity.status !== "completed") ?? [];
  const pendingApps = apps.data?.filter((a) => !(a.kind === "invitation" && a.status === "pending") && a.status !== "selected") ?? [];
  const s = me.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{s ? `Hi, ${s.name.split(" ")[0]}` : "Dashboard"}</h1>
          <p className="mt-1 text-muted-fg">{s?.headline}</p>
        </div>
        <Link to="/student/profile" className="btn-outline">
          <UserPen className="size-4" aria-hidden /> Edit my profile
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Award className="size-5" />} label="Finished projects" value={s?.portfolio.completed ?? "-"} />
        <StatCard icon={<Star className="size-5" />} label="Your rating" value={s?.ratings.average?.toFixed(1) ?? "-"} sub={s ? `from ${s.ratings.count} review${s.ratings.count === 1 ? "" : "s"}` : undefined} />
        <StatCard icon={<Mail className="size-5" />} label="New invitations" value={apps.data ? invites.length : "-"} />
      </div>

      {s && !s.cv_filename && <CvUpload studentId={s.id} cvFilename="" />}

      {invites.length > 0 && (
        <section className="card border-accent/40 p-5" aria-labelledby="inv-title">
          <SectionTitle sub="Companies that would like to work with you">
            <span id="inv-title">Invitations</span>
          </SectionTitle>
          <ul className="divide-y divide-border">
            {invites.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeBadge type={a.opportunity.type} />
                    <Link to={`/opportunities/${a.opportunity.id}`} className="link font-semibold">
                      {a.opportunity.title}
                    </Link>
                  </div>
                  <p className="text-sm text-muted-fg">
                    {a.opportunity.company.name}
                    {a.message ? ` · "${a.message}"` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary min-h-9 px-3" onClick={() => respond.mutate({ id: a.id, action: "accept" })}>
                    Accept
                  </button>
                  <button className="btn-outline min-h-9 px-3" onClick={() => respond.mutate({ id: a.id, action: "decline" })}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <ErrorBox error={respond.error} />
        </section>
      )}

      {active.length > 0 && (
        <section aria-labelledby="active-title">
          <SectionTitle>
            <span id="active-title">Your current work</span>
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((a) => (
              <OpportunityCard key={a.id} o={a.opportunity} showStatus compact />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="recs-title">
        <SectionTitle
          sub="Best fits first. You can see all of them in Opportunities."
          action={<Tabs label="Recommendation type" value={tab} onChange={setTab} tabs={(["project", "internship", "job"] as OppType[]).map((t) => ({ id: t, label: TYPE_PLURAL[t] }))} />}
        >
          <span id="recs-title" className="inline-flex items-center gap-2">
            <Sparkles className="size-5 text-primary-strong" aria-hidden /> Recommended for you
          </span>
        </SectionTitle>
        <ErrorBox error={recs.error} />
        {recs.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : recs.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recs.data.map((o) => (
              <OpportunityCard key={o.id} o={o} />
            ))}
          </div>
        ) : (
          <Empty icon={<Sparkles className="size-8" />} title={`No compatible ${TYPE_PLURAL[tab].toLowerCase()} right now`} action={<Link className="btn-outline" to={`/explore?type=${tab}`}>Browse all</Link>}>
            Check that this type is selected in your profile interests, or add skills.
          </Empty>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="apps-title">
          <SectionTitle>
            <span id="apps-title">My applications</span>
          </SectionTitle>
          {pendingApps.length === 0 ? (
            <Empty icon={<Inbox className="size-8" />} title="No applications yet" />
          ) : (
            <ul className="divide-y divide-border">
              {pendingApps.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <Link to={`/opportunities/${a.opportunity.id}`} className="link font-semibold">
                      {a.opportunity.title}
                    </Link>
                    <p className="text-sm text-muted-fg">
                      {a.opportunity.company.name} · {a.kind === "invitation" ? "invitation" : "applied"} {shortDate(a.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.match_score != null && <Badge tone="primary">{Math.round(a.match_score)}% match</Badge>}
                    <Badge tone={a.status === "accepted" ? "success" : a.status === "rejected" || a.status === "declined" ? "danger" : "neutral"}>{a.status}</Badge>
                    {a.opportunity.status !== "open" && <StatusBadge status={a.opportunity.status} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {s && <PortfolioSummary s={s} />}
      </div>
    </div>
  );
}
