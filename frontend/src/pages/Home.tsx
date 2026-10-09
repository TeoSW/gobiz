import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Check, FileText, GraduationCap, Heart, School, Sparkles, Star, X } from "lucide-react";
import { Link } from "react-router-dom";
import { LogoMark, useSlogan } from "../components/Logo";
import { api } from "../lib/api";
import { texts, useTexts } from "../lib/i18n";
import { homeFor, useSession } from "../lib/session";
import type { Opportunity, OppType, Role } from "../lib/types";

const STEP_ICONS = [FileText, Sparkles, Heart, Star];
const ROLE_ICONS: Record<Role, typeof GraduationCap> = { student: GraduationCap, company: Building2, university: School };

type RoleCard = { role: Role; title: string; points: string[]; cta: string };

const T = texts(
  {
    kicker: "Projects · Internships · Jobs",
    intro: "Students and small companies swipe right on each other. When both say yes, it's a match and the work can start. AI shows who fits, people decide.",
    startMatching: "Start matching",
    myDashboard: "Go to my dashboard",
    seeOpportunities: "See opportunities",
    open: { project: "Open projects", internship: "Open internships", job: "Open jobs" } as Record<OppType, string>,
    example: "Example of a swipe card",
    card: {
      yes: "Yes",
      meta: "Test SRL · Project",
      title: "Sales dashboard in Power BI",
      facts: "1,500 lei · 3 weeks · remote",
      fit: "Very good fit",
      reasons: ["Knows Power BI and Excel", "Has 20 hours a week free", "Did a similar project before"],
    },
    howTitle: "How it works",
    steps: [
      { title: "A company describes a problem", text: "In plain words. AI turns it into a clear task list." },
      { title: "SkillSync shows who fits", text: "Based on skills, time and experience. People decide." },
      { title: "Both swipe right", text: "When the student and the company both say yes, it's a match." },
      { title: "Work, then review", text: "The finished project goes into the student's portfolio." },
    ],
    whoTitle: "Who it is for",
    roles: [
      {
        role: "student",
        title: "For students",
        points: ["Real projects, paid work or practice", "A portfolio that proves your skills", "Course credit or a thesis topic"],
        cta: "Try as a student",
      },
      {
        role: "company",
        title: "For companies",
        points: ["Get small projects done fast", "Write the problem, AI structures it", "See which students fit and why"],
        cta: "Try as a company",
      },
      {
        role: "university",
        title: "For professors",
        points: ["Mentor students on real problems", "Validate good projects", "See which skills companies want"],
        cta: "Try as a professor",
      },
    ] as RoleCard[],
  },
  {
    kicker: "Proiecte · Stagii · Joburi",
    intro: "Studenții și firmele mici își dau swipe la dreapta. Când amândoi spun da, e match și munca poate începe. AI-ul arată cine se potrivește, oamenii decid.",
    startMatching: "Începe potrivirea",
    myDashboard: "Mergi la panoul meu",
    seeOpportunities: "Vezi oportunitățile",
    open: { project: "Proiecte deschise", internship: "Stagii deschise", job: "Joburi deschise" },
    example: "Exemplu de card pentru swipe",
    card: {
      yes: "Da",
      meta: "Test SRL · Proiect",
      title: "Dashboard de vânzări în Power BI",
      facts: "1.500 lei · 3 săptămâni · remote",
      fit: "Potrivire foarte bună",
      reasons: ["Știe Power BI și Excel", "Are 20 de ore libere pe săptămână", "A mai făcut un proiect asemănător"],
    },
    howTitle: "Cum funcționează",
    steps: [
      { title: "O firmă descrie o problemă", text: "În cuvinte simple. AI-ul o transformă într-o listă clară de sarcini." },
      { title: "SkillSync arată cine se potrivește", text: "După abilități, timp liber și experiență. Oamenii decid." },
      { title: "Amândoi dau swipe la dreapta", text: "Când studentul și firma spun amândoi da, e match." },
      { title: "Munca, apoi recenzia", text: "Proiectul terminat intră în portofoliul studentului." },
    ],
    whoTitle: "Pentru cine este",
    roles: [
      {
        role: "student",
        title: "Pentru studenți",
        points: ["Proiecte reale, muncă plătită sau practică", "Un portofoliu care îți dovedește abilitățile", "Notă la o materie sau temă de licență"],
        cta: "Încearcă ca student",
      },
      {
        role: "company",
        title: "Pentru firme",
        points: ["Proiecte mici rezolvate repede", "Scrii problema, AI-ul o structurează", "Vezi ce studenți se potrivesc și de ce"],
        cta: "Încearcă ca firmă",
      },
      {
        role: "university",
        title: "Pentru profesori",
        points: ["Îndrumă studenți pe probleme reale", "Validează proiectele bune", "Vezi ce abilități cer firmele"],
        cta: "Încearcă ca profesor",
      },
    ],
  },
);

export default function Home() {
  const t = useTexts(T);
  const slogan = useSlogan();
  const { user } = useSession();
  const opps = useQuery({ queryKey: ["opps", "home"], queryFn: () => api<Opportunity[]>("/opportunities") });
  const counts = (["project", "internship", "job"] as OppType[]).map((type) => ({ type, n: opps.data?.filter((o) => o.type === type).length }));

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="animate-in">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary-strong">
            <LogoMark className="size-4" /> {t.kicker}
          </p>
          <h1 className="mt-4 text-4xl leading-[1.1] font-extrabold sm:text-6xl">{slogan}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted-fg">{t.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={!user ? "/login" : user.role === "university" ? homeFor(user.role) : "/match"} className="btn-primary px-5">
              {user?.role === "university" ? t.myDashboard : t.startMatching} <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link to="/explore" className="btn-outline px-5">
              {t.seeOpportunities}
            </Link>
          </div>
          <dl className="mt-10 flex flex-wrap gap-10">
            {counts.map(({ type, n }) => (
              <div key={type}>
                <dt className="text-muted-fg">{t.open[type]}</dt>
                <dd className="text-3xl font-extrabold tabular-nums">{n ?? "-"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="animate-in relative mx-auto w-full max-w-sm [animation-delay:80ms]" aria-label={t.example} role="img">
          <div className="card absolute inset-0 translate-y-5 scale-[0.92] opacity-60" aria-hidden />
          <div className="card absolute inset-0 translate-y-2.5 scale-[0.96] opacity-80" aria-hidden />
          <div className="card relative rotate-3 p-6" aria-hidden>
            <span className="absolute top-5 left-5 -rotate-12 rounded-lg border-4 border-success px-2 text-xl font-black text-success uppercase">{t.card.yes}</span>
            <p className="text-right text-sm font-semibold text-muted-fg">{t.card.meta}</p>
            <h2 className="mt-6 text-xl font-bold">{t.card.title}</h2>
            <p className="text-muted-fg">{t.card.facts}</p>
            <div className="mt-5 flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-[6px] border-success text-lg font-extrabold text-success">92%</div>
              <p className="text-lg font-bold text-success">{t.card.fit}</p>
            </div>
            <ul className="mt-4 space-y-1.5">
              {t.card.reasons.map((r) => (
                <li key={r} className="flex items-center gap-2">
                  <Check className="size-5 text-success" aria-hidden /> {r}
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
          {t.howTitle}
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.map((s, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <li key={s.title} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg">{i + 1}</span>
                  <Icon className="size-5 text-primary-strong" aria-hidden />
                </div>
                <p className="mt-3 font-bold">{s.title}</p>
                <p className="mt-1 text-muted-fg">{s.text}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="who-title">
        <h2 id="who-title" className="text-2xl font-bold">
          {t.whoTitle}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {t.roles.map((r) => {
            const Icon = ROLE_ICONS[r.role];
            return (
              <div key={r.role} className="card flex flex-col p-6">
                <Icon className="size-8 text-primary-strong" aria-hidden />
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
            );
          })}
        </div>
      </section>
    </div>
  );
}
