import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, CheckCircle2, FolderKanban, GraduationCap, HandHelping, Network, Star, Table2, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TypeBadge } from "../components/OpportunityCard";
import { Badge, Empty, ErrorBox, SectionTitle, Spinner, StatCard } from "../components/ui";
import { api, post } from "../lib/api";
import { ACADEMIC_LABEL, TYPE_PLURAL, cap, money, shortDate } from "../lib/format";
import type { MentorshipRow, Opportunity, UniversityDashboard as Dash } from "../lib/types";

const axisTick = { fill: "var(--muted-fg)", fontSize: 12 };

function ChartTooltip({ active, payload, label, unit = "" }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-fg">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="font-semibold text-fg tabular-nums">{p.value}{unit}</span>
        </p>
      ))}
    </div>
  );
}

/** Chart card with a table view (accessibility: identity/values never depend on the chart alone). */
function ChartCard({ title, sub, chart, table }: { title: string; sub?: string; chart: ReactNode; table: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="card p-5">
      <SectionTitle
        sub={sub}
        action={
          <button className="btn-ghost min-h-9 px-3" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            <Table2 className="size-4" aria-hidden /> {asTable ? "Chart" : "Table"}
          </button>
        }
      >
        {title}
      </SectionTitle>
      {asTable ? <div className="max-h-80 overflow-auto">{table}</div> : chart}
    </section>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-fg">
          {head.map((h) => (
            <th key={h} scope="col" className="py-2 pr-3 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/60">
            {r.map((c, j) => (
              <td key={j} className={j ? "py-2 pr-3 tabular-nums" : "py-2 pr-3 font-medium"}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VerificationQueue() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["verify-queue"], queryFn: () => api<Opportunity[]>("/university/verification-queue") });
  const verify = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) => post(`/university/opportunities/${id}/verify`, { approve }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <section className="card p-5">
      <SectionTitle sub="Companies asking for the University Verified label">Verification queue</SectionTitle>
      {q.isLoading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <Empty icon={<BadgeCheck className="size-8" />} title="Nothing to verify" />
      ) : (
        <ul className="divide-y divide-border">
          {q.data.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <TypeBadge type={o.type} />
                  <Link className="link font-semibold" to={`/opportunities/${o.id}`}>
                    {o.title}
                  </Link>
                </div>
                <p className="text-sm text-muted-fg">
                  {o.company.name} · {money(o)} · {o.academic_options.map((a) => ACADEMIC_LABEL[a]).join(", ") || "no academic use declared"}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary min-h-9 px-3" onClick={() => verify.mutate({ id: o.id, approve: true })}>
                  <BadgeCheck className="size-4" aria-hidden /> Verify
                </button>
                <button className="btn-outline min-h-9 px-3" onClick={() => verify.mutate({ id: o.id, approve: false })}>
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ErrorBox error={verify.error} />
    </section>
  );
}

function Mentorship() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["mentorship"], queryFn: () => api<MentorshipRow[]>("/university/mentorship") });
  const respond = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) => post(`/university/mentorship/${id}/respond`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorship"] }),
  });
  return (
    <section className="card p-5">
      <SectionTitle sub="Students asking for guidance on harder projects">Mentorship requests</SectionTitle>
      {q.isLoading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <Empty icon={<HandHelping className="size-8" />} title="No requests" />
      ) : (
        <ul className="divide-y divide-border">
          {q.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <Link className="link font-semibold" to={`/students/${r.student.id}`}>
                    {r.student.name}
                  </Link>{" "}
                  on{" "}
                  <Link className="link" to={`/opportunities/${r.opportunity.id}`}>
                    {r.opportunity.title}
                  </Link>
                </p>
                <p className="text-sm text-muted-fg">
                  {r.opportunity.company} · {shortDate(r.created_at)}
                  {r.note ? ` · "${r.note}"` : ""}
                </p>
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <button className="btn-primary min-h-9 px-3" onClick={() => respond.mutate({ id: r.id, action: "accept" })}>
                    Mentor
                  </button>
                  <button className="btn-outline min-h-9 px-3" onClick={() => respond.mutate({ id: r.id, action: "decline" })}>
                    Decline
                  </button>
                </div>
              ) : (
                <Badge tone={r.status === "accepted" ? "success" : "neutral"}>{r.status}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function UniversityDashboard() {
  const q = useQuery({ queryKey: ["uni-dash"], queryFn: () => api<Dash>("/university/dashboard") });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  const k = d.kpis;
  const top = d.top_skills.map((s) => ({ name: s.name, Opportunities: s.opportunities }));
  const gap = d.skill_gap.map((s) => ({ name: s.name, "Demand (% of opportunities)": s.demand_pct, "Supply (% of students, intermediate+)": s.supply_pct, want: s.students_want_to_learn }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">University insights</h1>
        <p className="mt-1 text-muted-fg">What companies actually ask for, what students can offer, and where the curriculum could adapt.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<FolderKanban className="size-5" />} label="Opportunities" value={k.opportunities} sub={`${k.open} open · ${k.in_progress} in progress`} />
        <StatCard icon={<CheckCircle2 className="size-5" />} label="Completed collaborations" value={k.completed} sub={k.avg_student_rating ? `avg. student rating ${k.avg_student_rating}/5` : undefined} />
        <StatCard icon={<Users className="size-5" />} label="Students" value={k.students} sub={`${k.companies} companies`} />
        <StatCard icon={<BadgeCheck className="size-5" />} label="University Verified" value={k.university_verified} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {d.by_type.map((t) => (
          <div key={t.type} className="card p-4">
            <p className="text-sm text-muted-fg">{TYPE_PLURAL[t.type]}</p>
            <p className="text-2xl font-bold tabular-nums">{t.count}</p>
            <p className="text-xs text-muted-fg">
              {d.compensation
                .filter((c) => c.type === t.type)
                .map((c) => `avg. ${new Intl.NumberFormat("en-US").format(c.average)} lei ${c.unit === "fixed" ? "per project" : `/ ${c.unit.replace("ly", "")}`}`)
                .join(" · ") || "no paid offers"}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Most requested skills"
          sub="Number of opportunities that list the skill"
          chart={
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={4}>
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
                  <Bar dataKey="Opportunities" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }
          table={<SimpleTable head={["Skill", "Opportunities", "Required in"]} rows={d.top_skills.map((s) => [s.name, s.opportunities, s.mandatory])} />}
        />

        <ChartCard
          title="Skill gap"
          sub="Share of opportunities asking for a skill vs. share of students who have it at intermediate level or above"
          chart={
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={gap} layout="vertical" margin={{ left: 8, right: 16 }} barGap={2} barCategoryGap={8}>
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" unit="%" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-fg)" }} />
                  <Bar dataKey="Demand (% of opportunities)" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={10} />
                  <Bar dataKey="Supply (% of students, intermediate+)" fill="var(--series-2)" radius={[0, 4, 4, 0]} maxBarSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }
          table={
            <SimpleTable
              head={["Skill", "Demand %", "Supply %", "Gap (pp)", "Want to learn"]}
              rows={d.skill_gap.map((s) => [s.name, s.demand_pct, s.supply_pct, s.gap, s.students_want_to_learn])}
            />
          }
        />

        <ChartCard
          title="Domains in demand"
          sub="Opportunities per industry"
          chart={
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={d.domains.map((x) => ({ name: cap(x.domain), Opportunities: x.count }))} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={4}>
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
                  <Bar dataKey="Opportunities" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }
          table={<SimpleTable head={["Domain", "Opportunities"]} rows={d.domains.map((x) => [cap(x.domain), x.count])} />}
        />

        <section className="card p-5">
          <SectionTitle
            sub={d.co_demand.source === "neo4j" ? "From the Neo4j skill knowledge graph" : "Computed from MySQL (start the graph profile for Neo4j)"}
            action={<Badge tone={d.co_demand.source === "neo4j" ? "success" : "neutral"} icon={<Network className="size-3" aria-hidden />}>{d.co_demand.source}</Badge>}
          >
            Skills requested together
          </SectionTitle>
          <SimpleTable head={["Skill pair", "Opportunities"]} rows={d.co_demand.pairs.map((p) => [`${p.a} + ${p.b}`, p.n])} />
          <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <GraduationCap className="size-4" aria-hidden /> Academic use
            </p>
            <p className="text-muted-fg">{d.academic.map((a) => `${ACADEMIC_LABEL[a.option]}: ${a.count}`).join(" · ")}</p>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <VerificationQueue />
        <Mentorship />
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-fg">
        <Building2 className="size-3.5" aria-hidden /> Aggregated, anonymous statistics. <Star className="size-3.5" aria-hidden /> Ratings come from completed collaborations only.
      </p>
    </div>
  );
}
