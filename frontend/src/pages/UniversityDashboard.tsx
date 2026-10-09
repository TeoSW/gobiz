import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, CheckCircle2, FolderKanban, GraduationCap, HandHelping, Network, Star, Table2, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TypeBadge } from "../components/OpportunityCard";
import { Badge, Empty, ErrorBox, SectionTitle, Spinner, StatCard } from "../components/ui";
import { api, post } from "../lib/api";
import { money, number, shortDate, useFormat } from "../lib/format";
import { texts, useTexts } from "../lib/i18n";
import type { MentorshipRow, Opportunity, UniversityDashboard as Dash } from "../lib/types";

const axisTick = { fill: "var(--muted-fg)", fontSize: 12 };

const T = texts(
  {
    chart: "Chart",
    table: "Table",
    queue: "Verification queue",
    queueSub: "Companies asking for the University Verified label",
    nothingToVerify: "Nothing to verify",
    noAcademic: "no academic use declared",
    verify: "Verify",
    reject: "Reject",
    mentorship: "Mentorship requests",
    mentorshipSub: "Students asking for guidance on harder projects",
    noRequests: "No requests",
    on: "on",
    mentor: "Mentor",
    decline: "Decline",
    reqStatus: { pending: "pending", accepted: "accepted", declined: "declined" } as Record<string, string>,
    title: "University insights",
    intro: "What companies ask for, and what students can already do.",
    opportunities: "Opportunities",
    openProgress: (open: number, progress: number) => `${open} open · ${progress} in progress`,
    completed: "Completed collaborations",
    avgRating: (r: number) => `avg. student rating ${r}/5`,
    students: "Students",
    companies: (n: number) => `${n} companies`,
    verified: "University Verified",
    avg: (amount: string, unit: string) => `avg. ${amount} lei ${unit}`,
    units: { fixed: "per project", monthly: "/ month", hourly: "/ hour" } as Record<string, string>,
    noPaid: "no paid offers",
    topSkills: "Most requested skills",
    topSkillsSub: "Number of opportunities that list the skill",
    skill: "Skill",
    requiredIn: "Required in",
    gap: "Skill gap",
    gapSub: "How often companies ask for a skill, compared to how many students have it",
    demand: "Demand (% of opportunities)",
    supply: "Supply (% of students, intermediate+)",
    gapHead: ["Skill", "Demand %", "Supply %", "Gap (pp)", "Want to learn"],
    domains: "Domains in demand",
    domainsSub: "Opportunities per industry",
    domain: "Domain",
    together: "Skills requested together",
    fromNeo4j: "From the Neo4j skill knowledge graph",
    fromSql: "Computed from MySQL (start the graph profile for Neo4j)",
    pair: "Skill pair",
    academicUse: "Academic use",
    footer: "Aggregated, anonymous statistics.",
    footerRatings: "Ratings come from completed collaborations only.",
  },
  {
    chart: "Grafic",
    table: "Tabel",
    queue: "Cereri de validare",
    queueSub: "Firme care cer eticheta „Validat de universitate”",
    nothingToVerify: "Nimic de validat",
    noAcademic: "nu e declarată utilizare academică",
    verify: "Validează",
    reject: "Respinge",
    mentorship: "Cereri de îndrumare",
    mentorshipSub: "Studenți care cer ajutor pe proiecte mai grele",
    noRequests: "Nicio cerere",
    on: "pentru",
    mentor: "Îndrum",
    decline: "Refuz",
    reqStatus: { pending: "în așteptare", accepted: "acceptată", declined: "refuzată" },
    title: "Statistici pentru universitate",
    intro: "Ce cer firmele și ce știu deja studenții.",
    opportunities: "Oportunități",
    openProgress: (open, progress) => `${open} deschise · ${progress} în lucru`,
    completed: "Colaborări finalizate",
    avgRating: (r) => `nota medie a studenților ${r}/5`,
    students: "Studenți",
    companies: (n) => `${n} ${n === 1 ? "firmă" : "firme"}`,
    verified: "Validat de universitate",
    avg: (amount, unit) => `în medie ${amount} lei ${unit}`,
    units: { fixed: "pe proiect", monthly: "/ lună", hourly: "/ oră" },
    noPaid: "nicio ofertă plătită",
    topSkills: "Cele mai cerute abilități",
    topSkillsSub: "Numărul de oportunități care cer abilitatea",
    skill: "Abilitate",
    requiredIn: "Obligatorie în",
    gap: "Diferența dintre cerere și ofertă",
    gapSub: "Cât de des cer firmele o abilitate, față de câți studenți o au",
    demand: "Cerere (% din oportunități)",
    supply: "Ofertă (% din studenți, intermediar+)",
    gapHead: ["Abilitate", "Cerere %", "Ofertă %", "Diferență (pp)", "Vor să învețe"],
    domains: "Domenii căutate",
    domainsSub: "Oportunități pe domeniu",
    domain: "Domeniu",
    together: "Abilități cerute împreună",
    fromNeo4j: "Din graful de cunoștințe Neo4j",
    fromSql: "Calculat din MySQL (pornește profilul graph pentru Neo4j)",
    pair: "Pereche de abilități",
    academicUse: "Utilizare academică",
    footer: "Statistici agregate și anonime.",
    footerRatings: "Notele vin doar din colaborări finalizate.",
  },
);

function ChartTooltip({ active, payload, label, unit = "" }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-fg">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name}:{" "}
          <span className="font-semibold text-fg tabular-nums">
            {p.value}
            {unit}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Chart card with a table view (accessibility: identity/values never depend on the chart alone). */
function ChartCard({ title, sub, chart, table }: { title: string; sub?: string; chart: ReactNode; table: ReactNode }) {
  const t = useTexts(T);
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="card p-5">
      <SectionTitle
        sub={sub}
        action={
          <button className="btn-ghost min-h-9 px-3" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            <Table2 className="size-4" aria-hidden /> {asTable ? t.chart : t.table}
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
  const t = useTexts(T);
  const f = useFormat();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["verify-queue"], queryFn: () => api<Opportunity[]>("/university/verification-queue") });
  const verify = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) => post(`/university/opportunities/${id}/verify`, { approve }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <section className="card p-5">
      <SectionTitle sub={t.queueSub}>{t.queue}</SectionTitle>
      {q.isLoading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <Empty icon={<BadgeCheck className="size-8" />} title={t.nothingToVerify} />
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
                  {o.company.name} · {money(o)} · {o.academic_options.map((a) => f.academic[a]).join(", ") || t.noAcademic}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary min-h-9 px-3" onClick={() => verify.mutate({ id: o.id, approve: true })}>
                  <BadgeCheck className="size-4" aria-hidden /> {t.verify}
                </button>
                <button className="btn-outline min-h-9 px-3" onClick={() => verify.mutate({ id: o.id, approve: false })}>
                  {t.reject}
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
  const t = useTexts(T);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["mentorship"], queryFn: () => api<MentorshipRow[]>("/university/mentorship") });
  const respond = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) => post(`/university/mentorship/${id}/respond`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentorship"] }),
  });
  return (
    <section className="card p-5">
      <SectionTitle sub={t.mentorshipSub}>{t.mentorship}</SectionTitle>
      {q.isLoading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <Empty icon={<HandHelping className="size-8" />} title={t.noRequests} />
      ) : (
        <ul className="divide-y divide-border">
          {q.data.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <Link className="link font-semibold" to={`/students/${r.student.id}`}>
                    {r.student.name}
                  </Link>{" "}
                  {t.on}{" "}
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
                    {t.mentor}
                  </button>
                  <button className="btn-outline min-h-9 px-3" onClick={() => respond.mutate({ id: r.id, action: "decline" })}>
                    {t.decline}
                  </button>
                </div>
              ) : (
                <Badge tone={r.status === "accepted" ? "success" : "neutral"}>{t.reqStatus[r.status] ?? r.status}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function UniversityDashboard() {
  const t = useTexts(T);
  const f = useFormat();
  const q = useQuery({ queryKey: ["uni-dash"], queryFn: () => api<Dash>("/university/dashboard") });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  const k = d.kpis;
  const top = d.top_skills.map((s) => ({ name: s.name, count: s.opportunities }));
  const gap = d.skill_gap.map((s) => ({ name: s.name, demand: s.demand_pct, supply: s.supply_pct }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">{t.title}</h1>
        <p className="mt-1 max-w-2xl text-muted-fg">{t.intro}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<FolderKanban className="size-5" />} label={t.opportunities} value={k.opportunities} sub={t.openProgress(k.open, k.in_progress)} />
        <StatCard icon={<CheckCircle2 className="size-5" />} label={t.completed} value={k.completed} sub={k.avg_student_rating ? t.avgRating(k.avg_student_rating) : undefined} />
        <StatCard icon={<Users className="size-5" />} label={t.students} value={k.students} sub={t.companies(k.companies)} />
        <StatCard icon={<BadgeCheck className="size-5" />} label={t.verified} value={k.university_verified} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {d.by_type.map((bt) => (
          <div key={bt.type} className="card p-4">
            <p className="text-sm text-muted-fg">{f.typesPlural[bt.type]}</p>
            <p className="text-2xl font-bold tabular-nums">{bt.count}</p>
            <p className="text-xs text-muted-fg">
              {d.compensation
                .filter((c) => c.type === bt.type)
                .map((c) => t.avg(number(c.average), t.units[c.unit] ?? c.unit))
                .join(" · ") || t.noPaid}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title={t.topSkills}
          sub={t.topSkillsSub}
          chart={
            <div className="h-96">
              <ResponsiveContainer>
                <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={4}>
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" interval={0} width={160} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
                  <Bar dataKey="count" name={t.opportunities} fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }
          table={<SimpleTable head={[t.skill, t.opportunities, t.requiredIn]} rows={d.top_skills.map((s) => [s.name, s.opportunities, s.mandatory])} />}
        />

        <ChartCard
          title={t.gap}
          sub={t.gapSub}
          chart={
            <div className="h-96">
              <ResponsiveContainer>
                <BarChart data={gap} layout="vertical" margin={{ left: 8, right: 16 }} barGap={2} barCategoryGap={8}>
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" unit="%" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" interval={0} width={160} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-fg)" }} />
                  <Bar dataKey="demand" name={t.demand} fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={10} />
                  <Bar dataKey="supply" name={t.supply} fill="var(--series-2)" radius={[0, 4, 4, 0]} maxBarSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }
          table={<SimpleTable head={t.gapHead} rows={d.skill_gap.map((s) => [s.name, s.demand_pct, s.supply_pct, s.gap, s.students_want_to_learn])} />}
        />

        <ChartCard
          title={t.domains}
          sub={t.domainsSub}
          chart={
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={d.domains.map((x) => ({ name: f.domain(x.domain), count: x.count }))} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={4}>
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" interval={0} width={110} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
                  <Bar dataKey="count" name={t.opportunities} fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }
          table={<SimpleTable head={[t.domain, t.opportunities]} rows={d.domains.map((x) => [f.domain(x.domain), x.count])} />}
        />

        <section className="card p-5">
          <SectionTitle
            sub={d.co_demand.source === "neo4j" ? t.fromNeo4j : t.fromSql}
            action={
              <Badge tone={d.co_demand.source === "neo4j" ? "success" : "neutral"} icon={<Network className="size-3" aria-hidden />}>
                {d.co_demand.source}
              </Badge>
            }
          >
            {t.together}
          </SectionTitle>
          <SimpleTable head={[t.pair, t.opportunities]} rows={d.co_demand.pairs.map((p) => [`${p.a} + ${p.b}`, p.n])} />
          <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <GraduationCap className="size-4" aria-hidden /> {t.academicUse}
            </p>
            <p className="text-muted-fg">{d.academic.map((a) => `${f.academic[a.option] ?? a.option}: ${a.count}`).join(" · ")}</p>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <VerificationQueue />
        <Mentorship />
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-fg">
        <Building2 className="size-3.5" aria-hidden /> {t.footer} <Star className="size-3.5" aria-hidden /> {t.footerRatings}
      </p>
    </div>
  );
}
