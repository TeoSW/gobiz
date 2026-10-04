import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Briefcase, Building2, Check, FileSearch, GraduationCap, Handshake, Rocket, Send, Sparkles, Star, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { TYPE_PLURAL } from "../lib/format";
import { useSession } from "../lib/session";
import type { Opportunity, OppType, Role } from "../lib/types";

const FLOW = [
  { icon: FileSearch, title: "Company describes a problem", text: "Free text in a guided form" },
  { icon: Sparkles, title: "AI extracts requirements", text: "Tasks + skills, confirmed by the company" },
  { icon: Handshake, title: "Recommend, apply, invite", text: "AI Match + Apply + Invite, side by side" },
  { icon: Rocket, title: "Work & deliver", text: "Status pipeline and messaging" },
  { icon: Wallet, title: "Payment confirmed", text: "Simulated in the prototype" },
  { icon: Star, title: "Mutual reviews", text: "Quality, deadline, communication / clarity, payment" },
  { icon: BadgeCheck, title: "Verified portfolio", text: "Proof instead of claims" },
];

const ROLES: { role: Role; icon: typeof GraduationCap; title: string; value: string[]; demo: string; cta: string }[] = [
  {
    role: "student",
    icon: GraduationCap,
    title: "Students",
    value: ["Real experience + income", "Verified portfolio, not just a CV", "Practice, course credit or thesis topics", "A small project can lead to a job"],
    demo: "Andrei Popescu",
    cta: "Try as a student",
  },
  {
    role: "company",
    icon: Building2,
    title: "SMEs",
    value: ["Fast, affordable access to skills", "Describe the problem, AI structures it", "Ranked candidates with explanations", "No need to hire for a 2-week job"],
    demo: "Carpathia Retail SRL",
    cta: "Try as a company",
  },
  {
    role: "university",
    icon: Briefcase,
    title: "Universities",
    value: ["Mentor and validate projects", "Real company data in courses", "Skills in demand vs. skills students have", "Evidence for curriculum updates"],
    demo: "Prof. Elena Marin",
    cta: "Try as the university",
  },
];

export default function Home() {
  const { personas, switchTo, user } = useSession();
  const navigate = useNavigate();
  const opps = useQuery({ queryKey: ["opps", "all-home"], queryFn: () => api<Opportunity[]>("/opportunities") });
  const counts = (["project", "internship", "job"] as OppType[]).map((t) => ({ t, n: opps.data?.filter((o) => o.type === t).length ?? 0 }));

  const tryAs = (name: string, role: Role) => {
    const p = personas.find((x) => x.name === name) ?? personas.find((x) => x.role === role);
    if (!p) return;
    switchTo(p.id);
    navigate(role === "student" ? "/student" : role === "company" ? "/company" : "/university");
  };

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="animate-in">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-muted-fg">
            <Sparkles className="size-4 text-accent" aria-hidden />
            Micro-projects · Internships · Jobs
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl">
            Connect student skills with <span className="text-primary-strong">real company problems</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-fg">
            SMEs post small, well-defined projects they can't staff internally. Students build verified experience. Universities see what the economy actually needs.
            AI recommends; people decide.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/explore" className="btn-primary px-5">
              Explore opportunities <ArrowRight className="size-4" aria-hidden />
            </Link>
            <button className="btn-accent px-5" onClick={() => (user?.role === "company" ? navigate("/company/new") : tryAs("Carpathia Retail SRL", "company"))}>
              <Send className="size-4" aria-hidden /> Post a project
            </button>
          </div>
          <dl className="mt-10 flex flex-wrap gap-8">
            {counts.map(({ t, n }) => (
              <div key={t}>
                <dt className="text-sm text-muted-fg">Open {TYPE_PLURAL[t].toLowerCase()}</dt>
                <dd className="text-3xl font-extrabold tabular-nums">{opps.isLoading ? "-" : n}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* illustrative match card */}
        <div className="card animate-in relative overflow-hidden p-6 [animation-delay:80ms]">
          <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/15 blur-3xl" aria-hidden />
          <p className="text-xs font-semibold tracking-wide text-muted-fg uppercase">Example recommendation</p>
          <h2 className="mt-2 text-lg font-bold">Sales dashboard in Power BI</h2>
          <p className="text-sm text-muted-fg">30,000 transactions · 1,500 lei · 3 weeks · Retail SME</p>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex size-20 items-center justify-center rounded-full border-[6px] border-success text-xl font-extrabold text-success">92%</div>
            <div>
              <p className="font-bold text-success">Excellent match</p>
              <p className="text-sm text-muted-fg">Recommendation, not decision</p>
            </div>
          </div>
          <ul className="mt-5 flex flex-wrap gap-2">
            {["Power BI", "SQL", "Data analysis", "Availability", "Similar experience"].map((s) => (
              <li key={s} className="chip">
                <Check className="size-3.5 text-success" aria-hidden /> {s}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-xl bg-muted p-4 text-sm">
            <p className="font-semibold">Verified portfolio</p>
            <p className="text-muted-fg">4 completed projects · 2 Power BI · 1 Python analysis · rating 4.8/5</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="flow-title">
        <h2 id="flow-title" className="text-2xl font-bold">
          From problem to verified experience
        </h2>
        <p className="mt-1 text-muted-fg">Not students matched with jobs, but student skills matched with real problems.</p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {FLOW.map((s, i) => (
            <li key={s.title} className="card relative p-4">
              <span className="absolute top-3 right-3 text-xs font-bold text-muted-fg tabular-nums">{i + 1}</span>
              <s.icon className="size-6 text-primary-strong" aria-hidden />
              <p className="mt-3 text-sm font-bold leading-snug">{s.title}</p>
              <p className="mt-1 text-xs text-muted-fg">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="roles-title">
        <h2 id="roles-title" className="text-2xl font-bold">
          Why each side joins
        </h2>
        <p className="mt-1 text-muted-fg">Pick a demo persona; no sign-up in this prototype.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.role} className="card flex flex-col p-6">
              <r.icon className="size-8 text-primary-strong" aria-hidden />
              <h3 className="mt-4 text-lg font-bold">{r.title}</h3>
              <ul className="mt-3 flex-1 space-y-2 text-sm">
                {r.value.map((v) => (
                  <li key={v} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {v}
                  </li>
                ))}
              </ul>
              <button className="btn-outline mt-6" onClick={() => tryAs(r.demo, r.role)}>
                {r.cta} <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
