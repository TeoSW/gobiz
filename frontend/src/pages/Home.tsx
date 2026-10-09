import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Check, FileText, GraduationCap, Heart, School, Sparkles, Star, X } from "lucide-react";
import { Link } from "react-router-dom";
import { LogoMark, SLOGAN } from "../components/Logo";
import { api } from "../lib/api";
import { TYPE_PLURAL } from "../lib/format";
import { homeFor, useSession } from "../lib/session";
import type { Opportunity, OppType, Role } from "../lib/types";

const STEPS = [
  { icon: FileText, title: "A company describes a problem", text: "In plain words. AI turns it into a clear task list." },
  { icon: Sparkles, title: "SkillSync shows who fits", text: "Based on skills, time and experience. People decide." },
  { icon: Heart, title: "Both swipe right", text: "When the student and the company both say yes, it's a match." },
  { icon: Star, title: "Work, then review", text: "The finished project goes into the student's portfolio." },
];

const ROLES: { role: Role; icon: typeof GraduationCap; title: string; points: string[]; cta: string }[] = [
  {
    role: "student",
    icon: GraduationCap,
    title: "For students",
    points: ["Real projects, paid work or practice", "A portfolio that proves your skills", "Course credit or a thesis topic"],
    cta: "Try as a student",
  },
  {
    role: "company",
    icon: Building2,
    title: "For companies",
    points: ["Get small projects done fast", "Write the problem, AI structures it", "See which students fit and why"],
    cta: "Try as a company",
  },
  {
    role: "university",
    icon: School,
    title: "For professors",
    points: ["Mentor students on real problems", "Validate good projects", "See which skills companies want"],
    cta: "Try as a professor",
  },
];

export default function Home() {
  const { user } = useSession();
  const opps = useQuery({ queryKey: ["opps", "home"], queryFn: () => api<Opportunity[]>("/opportunities") });
  const counts = (["project", "internship", "job"] as OppType[]).map((t) => ({ t, n: opps.data?.filter((o) => o.type === t).length }));

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="animate-in">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary-strong">
            <LogoMark className="size-4" /> Projects · Internships · Jobs
          </p>
          <h1 className="mt-4 text-4xl leading-[1.1] font-extrabold sm:text-6xl">{SLOGAN}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted-fg">
            Students and small companies swipe right on each other. When both say yes, it's a match and the work can start. AI shows who fits, people decide.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={!user ? "/login" : user.role === "university" ? homeFor(user.role) : "/match"} className="btn-primary px-5">
              {user?.role === "university" ? "Go to my dashboard" : "Start matching"} <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to="/explore" className="btn-outline px-5">
              See opportunities
            </Link>
          </div>
          <dl className="mt-10 flex flex-wrap gap-10">
            {counts.map(({ t, n }) => (
              <div key={t}>
                <dt className="text-muted-fg">Open {TYPE_PLURAL[t].toLowerCase()}</dt>
                <dd className="text-3xl font-extrabold tabular-nums">{n ?? "-"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="animate-in relative mx-auto w-full max-w-sm [animation-delay:80ms]" aria-label="Example of a swipe card" role="img">
          <div className="card absolute inset-0 translate-y-5 scale-[0.92] opacity-60" aria-hidden />
          <div className="card absolute inset-0 translate-y-2.5 scale-[0.96] opacity-80" aria-hidden />
          <div className="card relative rotate-3 p-6" aria-hidden>
            <span className="absolute top-5 left-5 -rotate-12 rounded-lg border-4 border-success px-2 text-xl font-black text-success uppercase">Yes</span>
            <p className="text-right text-sm font-semibold text-muted-fg">Test SRL · Project</p>
            <h2 className="mt-6 text-xl font-bold">Sales dashboard in Power BI</h2>
            <p className="text-muted-fg">1,500 lei · 3 weeks · remote</p>
            <div className="mt-5 flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-[6px] border-success text-lg font-extrabold text-success">92%</div>
              <p className="text-lg font-bold text-success">Very good fit</p>
            </div>
            <ul className="mt-4 space-y-1.5">
              {["Knows Power BI and Excel", "Has 20 hours a week free", "Did a similar project before"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-5 text-success" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-center gap-4">
              <span className="inline-flex size-12 items-center justify-center rounded-full border-2 border-danger/40 text-danger">
                <X className="size-6" />
              </span>
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-success text-success-fg">
                <Heart className="size-6 fill-current" />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-bold">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg">{i + 1}</span>
                <s.icon className="size-5 text-primary-strong" aria-hidden />
              </div>
              <p className="mt-3 font-bold">{s.title}</p>
              <p className="mt-1 text-muted-fg">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="who-title">
        <h2 id="who-title" className="text-2xl font-bold">
          Who it is for
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.role} className="card flex flex-col p-6">
              <r.icon className="size-8 text-primary-strong" aria-hidden />
              <h3 className="mt-3 text-lg font-bold">{r.title}</h3>
              <ul className="mt-3 flex-1 space-y-2">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
              {!user && (
                <Link to={`/login?as=${r.role}`} className="btn-outline mt-6">
                  {r.cta} <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
