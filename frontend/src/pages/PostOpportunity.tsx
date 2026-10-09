import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Bot, Check, CircleHelp, Lightbulb, Loader2, Plus, Quote, Rocket, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MatchRing } from "../components/Match";
import { Badge, ErrorBox, Field, Notice, Segmented, Spinner, ToggleChip } from "../components/ui";
import { api, post } from "../lib/api";
import { useFormat } from "../lib/format";
import { texts, useTexts } from "../lib/i18n";
import { useSession } from "../lib/session";
import type { Candidates, Extraction, Opportunity, OppType, Requirement } from "../lib/types";
import { SkillPicker } from "./StudentProfileEdit";

type Example = Record<OppType, { title: string; description: string }>;

// the project example is in Romanian in both languages: it shows that the AI reads Romanian text
const PROJECT_EXAMPLE = {
  title: "Dashboard vanzari Power BI",
  description:
    "Avem o baza de date cu aproximativ 30.000 de tranzactii si dorim un dashboard Power BI cu analiza vanzarilor pe produse, perioade si regiuni. Datele sunt in mai multe fisiere Excel. Power BI este obligatoriu, SQL este un plus. Vrem ca raportul sa se actualizeze lunar si sa fie usor de citit pentru managerii de magazin. Buget: 1.500 lei. Termen: 3 saptamani.",
};

interface Details {
  hours_per_week: number;
  duration_weeks: number;
  start_date: string;
  deadline: string;
  work_mode: "remote" | "onsite" | "hybrid";
  city: string;
  compensation_type: "fixed" | "monthly" | "hourly" | "unpaid";
  compensation_amount: number;
  expected_outcome: string;
  domain: string;
  difficulty: number;
  academic_options: string[];
  mentoring_offered: boolean;
  request_verification: boolean;
}

const DEFAULTS: Record<OppType, Partial<Details>> = {
  project: { hours_per_week: 10, duration_weeks: 3, compensation_type: "fixed", compensation_amount: 1500, academic_options: [] },
  internship: { hours_per_week: 20, duration_weeks: 8, compensation_type: "monthly", compensation_amount: 2500, academic_options: ["mandatory_practice"], mentoring_offered: true },
  job: { hours_per_week: 20, duration_weeks: 52, compensation_type: "monthly", compensation_amount: 4500, academic_options: [] },
};

const T = texts(
  {
    examples: {
      project: PROJECT_EXAMPLE,
      internship: {
        title: "Data & reporting internship",
        description:
          "Summer practice for a year-2 student. You will help our finance team centralise monthly reports from Excel files, clean the data and build simple charts. Good Excel is required; we will teach you Power BI and some SQL. Mentoring from our controller every week.",
      },
      job: {
        title: "Junior Python developer (part-time)",
        description:
          "Part-time role, 20h/week. Build and maintain small internal tools in Python: REST APIs with FastAPI, scripts that automate reports from our ERP, and a PostgreSQL database. Python is required, SQL is a must. Git experience is a plus.",
      },
    } as Example,
    steps: ["Describe", "AI requirements", "Details", "Publish"],
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    mentioned: "Mentioned in your text",
    aiSuggestion: "AI suggestion",
    addedByYou: "Added by you",
    remove: (s: string) => `Remove ${s}`,
    minLevelFor: (s: string) => `Minimum level for ${s}`,
    requiredDayOne: "Required from day one",
    canLearn: "Can be learned with guidance",
    title: "Post an opportunity",
    intro: "Write what you need in your own words, in Romanian or English. AI turns it into tasks and skills, and you check them.",
    whatPublish: "What do you want to publish?",
    oppType: "Opportunity type",
    titleLabel: "Title",
    titlePlaceholder: "e.g. Sales dashboard for our 14 stores",
    whatNeed: "What do you need?",
    whatNeedHint: "Say what must be done, which tools are required, the budget and the deadline.",
    fillExample: "Fill with an example",
    analyzing: "Analyzing...",
    analyze: "Analyze with AI",
    reading: "AI is reading your text. This takes about 10-15 seconds.",
    extractedOllama: (model: string, secs: string): ReactNode => (
      <>
        Extracted by <strong>{model}</strong> via Ollama in {secs} s.
      </>
    ),
    extractedRules: (offline: boolean): ReactNode => (
      <>
        Extracted by the <strong>rule-based fallback</strong>
        {offline ? " (Ollama not reachable - start it to use the LLM)" : ""}.
      </>
    ),
    checkEverything: "Please check everything: suggestions are never made mandatory automatically.",
    tasks: "Tasks",
    task: (n: number) => `Task ${n}`,
    removeTask: (n: number) => `Remove task ${n}`,
    addTask: "Add task",
    skills: "Skills",
    skillsIntro: "Mark what the student must already know, and what they can learn with your help.",
    notInCatalog: (list: string) => `Not in the skill catalog (ignored): ${list}`,
    studentsAsk: "Students will probably ask",
    answerHint: "Answer these in the next step or edit your description.",
    back: "Back",
    continue: "Continue",
    hours: "Hours / week",
    contractLength: "Contract length (weeks)",
    duration: "Duration (weeks)",
    difficulty: "Difficulty",
    startDate: "Start date",
    deadline: "Deadline",
    domain: "Domain",
    workMode: "Work mode",
    modes: { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" },
    city: "City",
    compensation: "Compensation",
    comp: { fixed: "Fixed (whole project)", monthly: "Monthly", hourly: "Hourly", unpaid: "Unpaid" },
    amount: "Amount (lei)",
    outcome: "Expected result / deliverables",
    academicUse: "Academic use (helps universities and students find it)",
    mentoring: "We offer mentoring",
    requestVerified: 'Request "University Verified"',
    publishing: "Publishing...",
    publish: "Publish",
    published: (title: string): ReactNode => (
      <>
        <strong>Published.</strong> Students can now find "{title}". Here are the students the engine recommends right away; invite anyone, or wait for applications.
      </>
    ),
    recommended: "Recommended students",
    ranking: "Ranking students",
    noCompatible: "No compatible students yet. Consider marking some skills as learnable.",
    openManage: "Open and manage candidates",
  },
  {
    examples: {
      project: PROJECT_EXAMPLE,
      internship: {
        title: "Stagiu date și raportare",
        description:
          "Practică de vară pentru un student din anul 2. Vei ajuta echipa financiară să centralizeze rapoartele lunare din fișiere Excel, să curețe datele și să facă grafice simple. Excel la nivel bun este obligatoriu; te învățăm Power BI și puțin SQL. Mentorat săptămânal de la controller-ul nostru.",
      },
      job: {
        title: "Programator Python junior (part-time)",
        description:
          "Post part-time, 20 de ore pe săptămână. Construiești și întreții mici unelte interne în Python: API-uri REST cu FastAPI, scripturi care automatizează rapoartele din ERP și o bază de date PostgreSQL. Python este obligatoriu, SQL este necesar. Experiența cu Git este un plus.",
      },
    },
    steps: ["Descriere", "Cerințe AI", "Detalii", "Publicare"],
    stepOf: (n, total) => `Pasul ${n} din ${total}`,
    mentioned: "Apare în textul tău",
    aiSuggestion: "Sugestie AI",
    addedByYou: "Adăugată de tine",
    remove: (s) => `Șterge ${s}`,
    minLevelFor: (s) => `Nivel minim pentru ${s}`,
    requiredDayOne: "Obligatorie din prima zi",
    canLearn: "Se poate învăța cu îndrumare",
    title: "Publică o oportunitate",
    intro: "Scrie de ce ai nevoie, cu cuvintele tale, în română sau engleză. AI-ul o transformă în sarcini și abilități, iar tu le verifici.",
    whatPublish: "Ce vrei să publici?",
    oppType: "Tipul oportunității",
    titleLabel: "Titlu",
    titlePlaceholder: "ex. Dashboard de vânzări pentru cele 14 magazine",
    whatNeed: "De ce ai nevoie?",
    whatNeedHint: "Spune ce trebuie făcut, ce unelte sunt obligatorii, bugetul și termenul.",
    fillExample: "Completează cu un exemplu",
    analyzing: "Se analizează...",
    analyze: "Analizează cu AI",
    reading: "AI-ul îți citește textul. Durează cam 10-15 secunde.",
    extractedOllama: (model, secs) => (
      <>
        Extras de <strong>{model}</strong> prin Ollama în {secs} s.
      </>
    ),
    extractedRules: (offline) => (
      <>
        Extras de <strong>varianta pe bază de reguli</strong>
        {offline ? " (Ollama nu răspunde - pornește-l ca să folosești modelul AI)" : ""}.
      </>
    ),
    checkEverything: "Verifică totul: sugestiile nu devin niciodată obligatorii automat.",
    tasks: "Sarcini",
    task: (n) => `Sarcina ${n}`,
    removeTask: (n) => `Șterge sarcina ${n}`,
    addTask: "Adaugă o sarcină",
    skills: "Abilități",
    skillsIntro: "Marchează ce trebuie să știe deja studentul și ce poate învăța cu ajutorul tău.",
    notInCatalog: (list) => `Nu sunt în catalogul de abilități (ignorate): ${list}`,
    studentsAsk: "Studenții probabil vor întreba",
    answerHint: "Răspunde la ele în pasul următor sau modifică descrierea.",
    back: "Înapoi",
    continue: "Continuă",
    hours: "Ore / săptămână",
    contractLength: "Durata contractului (săptămâni)",
    duration: "Durata (săptămâni)",
    difficulty: "Dificultate",
    startDate: "Data de început",
    deadline: "Termen",
    domain: "Domeniu",
    workMode: "Mod de lucru",
    modes: { remote: "Remote", hybrid: "Hibrid", onsite: "La birou" },
    city: "Oraș",
    compensation: "Plată",
    comp: { fixed: "Fixă (tot proiectul)", monthly: "Lunară", hourly: "Pe oră", unpaid: "Neplătit" },
    amount: "Suma (lei)",
    outcome: "Rezultat așteptat / ce se predă",
    academicUse: "Utilizare academică (ajută universitățile și studenții să o găsească)",
    mentoring: "Oferim mentorat",
    requestVerified: "Cere „Validat de universitate”",
    publishing: "Se publică...",
    publish: "Publică",
    published: (title) => (
      <>
        <strong>Publicat.</strong> Studenții pot găsi acum „{title}”. Mai jos sunt studenții recomandați imediat; invită pe oricine sau așteaptă aplicări.
      </>
    ),
    recommended: "Studenți recomandați",
    ranking: "Se ordonează studenții",
    noCompatible: "Încă niciun student compatibil. Poți marca unele abilități ca „se poate învăța”.",
    openManage: "Deschide și administrează candidații",
  },
);

function Stepper({ step }: { step: number }) {
  const t = useTexts(T);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label={t.stepOf(step + 1, t.steps.length)}>
      {t.steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
          <span
            className={clsx(
              "flex size-7 items-center justify-center rounded-full text-xs font-bold",
              i < step ? "bg-primary text-primary-fg" : i === step ? "border-2 border-primary text-primary-strong" : "bg-muted text-muted-fg",
            )}
          >
            {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={clsx("text-sm font-semibold", i === step ? "text-fg" : "text-muted-fg")}>{s}</span>
          {i < t.steps.length - 1 && <span className="mx-1 hidden h-px w-8 bg-border sm:block" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function RequirementRow({ r, onChange, onRemove }: { r: Requirement; onChange: (p: Partial<Requirement>) => void; onRemove: () => void }) {
  const t = useTexts(T);
  const f = useFormat();
  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{r.name}</span>
        {r.source === "explicit" && <Badge tone="success">{t.mentioned}</Badge>}
        {r.source === "suggested" && (
          <Badge tone="warning" icon={<Lightbulb className="size-3" aria-hidden />}>
            {t.aiSuggestion}
          </Badge>
        )}
        {r.source === "manual" && <Badge>{t.addedByYou}</Badge>}
        <button type="button" className="btn-ghost ml-auto min-h-8 px-2" onClick={onRemove} aria-label={t.remove(r.name)}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {r.note && (
        <p className="flex gap-1.5 text-xs text-muted-fg">
          <Quote className="size-3.5 shrink-0" aria-hidden />
          {r.note}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented size="sm" label={t.minLevelFor(r.name)} value={r.min_level} onChange={(v) => onChange({ min_level: v })} options={[1, 2, 3].map((l) => ({ value: l, label: f.levels[l] }))} />
        <ToggleChip checked={r.mandatory} onChange={(v) => onChange({ mandatory: v })}>
          {t.requiredDayOne}
        </ToggleChip>
        <ToggleChip checked={r.learnable} onChange={(v) => onChange({ learnable: v })}>
          {t.canLearn}
        </ToggleChip>
      </div>
    </li>
  );
}

export default function PostOpportunity() {
  const t = useTexts(T);
  const f = useFormat();
  const { meta } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<OppType>("project");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ex, setEx] = useState<Extraction | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [reqs, setReqs] = useState<Requirement[]>([]);
  const [d, setD] = useState<Details>({
    hours_per_week: 10, duration_weeks: 3, start_date: "", deadline: "", work_mode: "remote", city: "",
    compensation_type: "fixed", compensation_amount: 1500, expected_outcome: "", domain: "", difficulty: 2,
    academic_options: [], mentoring_offered: false, request_verification: false,
  });
  const [published, setPublished] = useState<Opportunity | null>(null);

  const extract = useMutation({
    mutationFn: () => post<Extraction>("/ai/extract", { title, description, type }),
    onSuccess: (data) => {
      setEx(data);
      setTasks(data.tasks);
      setReqs(data.skills);
      setD((x) => ({ ...x, domain: meta?.domains.includes(data.domain) ? data.domain : x.domain, difficulty: data.difficulty }));
      setStep(1);
    },
  });

  const publish = useMutation({
    mutationFn: () =>
      post<Opportunity>("/opportunities", {
        type, title, description, tasks: tasks.filter((task) => task.trim()), ...d,
        start_date: d.start_date || null, deadline: d.deadline || null,
        requirements: reqs.map(({ skill_id, min_level, mandatory, learnable, source }) => ({ skill_id, min_level, mandatory, learnable, source })),
        ai_extraction: ex ? { provider: ex.provider, model: ex.model, summary: ex.summary, missing_info: ex.missing_info, skills: ex.skills } : null,
      }),
    onSuccess: (o) => {
      setPublished(o);
      setStep(3);
    },
  });

  const candidates = useQuery({
    queryKey: ["candidates", published?.id],
    queryFn: () => api<Candidates>(`/opportunities/${published!.id}/candidates`),
    enabled: !!published,
  });

  const chooseType = (ty: OppType) => {
    setType(ty);
    setD((x) => ({ ...x, ...DEFAULTS[ty] }));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">{t.title}</h1>
        <p className="mt-1 max-w-2xl text-muted-fg">{t.intro}</p>
      </div>
      <Stepper step={step} />

      {step === 0 && (
        <section className="card space-y-5 p-6">
          <div>
            <p className="label">{t.whatPublish}</p>
            <Segmented label={t.oppType} value={type} onChange={chooseType} options={(["project", "internship", "job"] as OppType[]).map((ty) => ({ value: ty, label: f.types[ty] }))} />
          </div>
          <Field label={t.titleLabel} htmlFor="title">
            <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePlaceholder} />
          </Field>
          <Field label={t.whatNeed} htmlFor="desc" hint={t.whatNeedHint}>
            <textarea id="desc" className="input" rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setTitle(t.examples[type].title);
                setDescription(t.examples[type].description);
              }}
            >
              <Wand2 className="size-4" aria-hidden /> {t.fillExample}
            </button>
            <button className="btn-primary px-5" disabled={description.trim().length < 20 || title.trim().length < 4 || extract.isPending} onClick={() => extract.mutate()}>
              {extract.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
              {extract.isPending ? t.analyzing : t.analyze}
            </button>
          </div>
          {extract.isPending && <Notice>{t.reading}</Notice>}
          <ErrorBox error={extract.error} />
        </section>
      )}

      {step === 1 && ex && (
        <section className="space-y-4">
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <Bot className="size-5 text-primary-strong" aria-hidden />
            <p className="text-sm">
              {ex.provider === "ollama" ? t.extractedOllama(ex.model ?? "", (ex.elapsed_ms / 1000).toFixed(1)) : t.extractedRules(!!ex.fallback_reason)} {t.checkEverything}
            </p>
          </div>

          {ex.summary && <Notice tone="neutral">{ex.summary}</Notice>}

          <div className="card p-6">
            <h2 className="text-lg font-bold">{t.tasks}</h2>
            <ul className="mt-3 space-y-2">
              {tasks.map((task, i) => (
                <li key={i} className="flex gap-2">
                  <label className="sr-only" htmlFor={`task-${i}`}>
                    {t.task(i + 1)}
                  </label>
                  <input id={`task-${i}`} className="input" value={task} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button type="button" className="btn-ghost px-2" onClick={() => setTasks(tasks.filter((_, j) => j !== i))} aria-label={t.removeTask(i + 1)}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-outline mt-3" onClick={() => setTasks([...tasks, ""])}>
              <Plus className="size-4" aria-hidden /> {t.addTask}
            </button>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-bold">{t.skills}</h2>
            <p className="text-muted-fg">{t.skillsIntro}</p>
            <ul className="mt-2 divide-y divide-border">
              {reqs.map((r) => (
                <RequirementRow
                  key={r.skill_id}
                  r={r}
                  onChange={(p) => setReqs(reqs.map((x) => (x.skill_id === r.skill_id ? { ...x, ...p } : x)))}
                  onRemove={() => setReqs(reqs.filter((x) => x.skill_id !== r.skill_id))}
                />
              ))}
            </ul>
            {ex.unrecognized_skills.length > 0 && <p className="mt-2 text-xs text-muted-fg">{t.notInCatalog(ex.unrecognized_skills.join(", "))}</p>}
            <div className="mt-3">
              <SkillPicker
                exclude={reqs.map((r) => r.skill_id)}
                onPick={(id) =>
                  setReqs([...reqs, { skill_id: id, name: meta?.skills.find((s) => s.id === id)?.name ?? id, min_level: 1, mandatory: false, learnable: false, source: "manual" }])
                }
              />
            </div>
          </div>

          {ex.missing_info.length > 0 && (
            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <CircleHelp className="size-5 text-warning" aria-hidden /> {t.studentsAsk}
              </h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                {ex.missing_info.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="hint">{t.answerHint}</p>
            </div>
          )}

          <div className="flex justify-between">
            <button className="btn-ghost" onClick={() => setStep(0)}>
              <ArrowLeft className="size-4" aria-hidden /> {t.back}
            </button>
            <button className="btn-primary" disabled={reqs.length === 0} onClick={() => setStep(2)}>
              {t.continue} <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.hours} htmlFor="hours">
              <input id="hours" type="number" min={1} max={60} className="input" value={d.hours_per_week} onChange={(e) => setD({ ...d, hours_per_week: Number(e.target.value) })} />
            </Field>
            <Field label={type === "job" ? t.contractLength : t.duration} htmlFor="weeks">
              <input id="weeks" type="number" min={1} max={104} className="input" value={d.duration_weeks} onChange={(e) => setD({ ...d, duration_weeks: Number(e.target.value) })} />
            </Field>
            <Field label={t.difficulty} htmlFor="diff">
              <select id="diff" className="input cursor-pointer" value={d.difficulty} onChange={(e) => setD({ ...d, difficulty: Number(e.target.value) })}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {f.difficulty[n]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.startDate} htmlFor="start">
              <input id="start" type="date" className="input" value={d.start_date} onChange={(e) => setD({ ...d, start_date: e.target.value })} />
            </Field>
            {type === "project" && (
              <Field label={t.deadline} htmlFor="deadline">
                <input id="deadline" type="date" className="input" value={d.deadline} onChange={(e) => setD({ ...d, deadline: e.target.value })} />
              </Field>
            )}
            <Field label={t.domain} htmlFor="domain">
              <select id="domain" className="input cursor-pointer" value={d.domain} onChange={(e) => setD({ ...d, domain: e.target.value })}>
                <option value="">-</option>
                {meta?.domains.map((x) => (
                  <option key={x} value={x}>
                    {f.domain(x)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.workMode} htmlFor="wm">
              <select id="wm" className="input cursor-pointer" value={d.work_mode} onChange={(e) => setD({ ...d, work_mode: e.target.value as Details["work_mode"] })}>
                <option value="remote">{t.modes.remote}</option>
                <option value="hybrid">{t.modes.hybrid}</option>
                <option value="onsite">{t.modes.onsite}</option>
              </select>
            </Field>
            <Field label={t.city} htmlFor="city">
              <input id="city" className="input" value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} />
            </Field>
            <Field label={t.compensation} htmlFor="comp-type">
              <select id="comp-type" className="input cursor-pointer" value={d.compensation_type} onChange={(e) => setD({ ...d, compensation_type: e.target.value as Details["compensation_type"] })}>
                <option value="fixed">{t.comp.fixed}</option>
                <option value="monthly">{t.comp.monthly}</option>
                <option value="hourly">{t.comp.hourly}</option>
                <option value="unpaid">{t.comp.unpaid}</option>
              </select>
            </Field>
            {d.compensation_type !== "unpaid" && (
              <Field label={t.amount} htmlFor="amount">
                <input id="amount" type="number" min={0} step={50} className="input" value={d.compensation_amount} onChange={(e) => setD({ ...d, compensation_amount: Number(e.target.value) })} />
              </Field>
            )}
          </div>
          <Field label={t.outcome} htmlFor="outcome">
            <textarea id="outcome" className="input" rows={2} value={d.expected_outcome} onChange={(e) => setD({ ...d, expected_outcome: e.target.value })} />
          </Field>
          <div>
            <p className="label">{t.academicUse}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(f.academic).map(([k, label]) => (
                <ToggleChip
                  key={k}
                  checked={d.academic_options.includes(k)}
                  onChange={(on) => setD({ ...d, academic_options: on ? [...d.academic_options, k] : d.academic_options.filter((x) => x !== k) })}
                >
                  {label}
                </ToggleChip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToggleChip checked={d.mentoring_offered} onChange={(v) => setD({ ...d, mentoring_offered: v })}>
              {t.mentoring}
            </ToggleChip>
            <ToggleChip checked={d.request_verification} onChange={(v) => setD({ ...d, request_verification: v })}>
              {t.requestVerified}
            </ToggleChip>
          </div>
          <ErrorBox error={publish.error} />
          <div className="flex justify-between">
            <button className="btn-ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" aria-hidden /> {t.back}
            </button>
            <button className="btn-accent px-5" disabled={publish.isPending} onClick={() => publish.mutate()}>
              <Rocket className="size-4" aria-hidden /> {publish.isPending ? t.publishing : t.publish}
            </button>
          </div>
        </section>
      )}

      {step === 3 && published && (
        <section className="space-y-4">
          <Notice tone="success">{t.published(published.title)}</Notice>
          <div className="card p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Sparkles className="size-5 text-primary-strong" aria-hidden /> {t.recommended}
            </h2>
            {candidates.isLoading ? (
              <Spinner label={t.ranking} />
            ) : candidates.data?.ai_matches.length ? (
              <ul className="divide-y divide-border">
                {candidates.data.ai_matches.slice(0, 5).map((c) => (
                  <li key={c.student.id} className="flex items-center gap-3 py-3">
                    <MatchRing match={c.match} size={44} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/students/${c.student.id}`} className="link font-semibold">
                        {c.student.name}
                      </Link>
                      <p className="truncate text-sm text-muted-fg">{c.match.summary}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-fg">{t.noCompatible}</p>
            )}
            <button className="btn-primary mt-4" onClick={() => navigate(`/opportunities/${published.id}`)}>
              {t.openManage} <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
