import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CvUpload } from "../components/CvUpload";
import { ErrorBox, Field, Notice, Segmented, Spinner, ToggleChip } from "../components/ui";
import { api, put } from "../lib/api";
import { cap, useFormat } from "../lib/format";
import { texts, useTexts } from "../lib/i18n";
import { useSession } from "../lib/session";
import type { OppType, PastProject, Student, StudentSkill } from "../lib/types";

const T = texts(
  {
    categories: {
      data: "Data",
      bi: "Business intelligence",
      quant: "Statistics",
      programming: "Programming",
      web: "Web and mobile",
      tools: "Tools",
      automation: "Automation",
      ai: "AI",
      business: "Business",
      design: "Design",
      language: "Languages",
      soft: "Soft skills",
    } as Record<string, string>,
    addSkill: "Add a skill",
    title: "My profile",
    intro: "Companies and the matching use this profile. Skills you know and skills you want to learn count differently.",
    about: "About you",
    fullName: "Full name",
    headline: "Headline",
    university: "University",
    faculty: "Faculty",
    program: "Study program",
    level: "Level",
    levels: { bachelor: "Bachelor", master: "Master", phd: "PhD" },
    year: "Year",
    city: "City",
    courses: "Courses taken",
    commaSeparated: "Comma-separated",
    bio: "About me",
    bioHint: "A few sentences about what you have done. Romanian or English is fine.",
    looking: "What are you looking for?",
    lookingSub: "Pick everything that applies.",
    types: "Opportunity types",
    goals: "Goals",
    domains: "Domains of interest",
    availability: "Availability",
    hours: "Hours / week",
    from: "Available from",
    until: "Available until",
    workMode: "Work mode",
    modes: { any: "Any", remote: "Remote only", hybrid: "Hybrid", onsite: "On-site" },
    skills: "Skills",
    skillsSub: "Choose your level for each skill. Mark the skills you want to learn: internships with a mentor count them.",
    levelFor: (s: string) => `Level for ${s}`,
    wantToLearn: "Want to learn",
    remove: (s: string) => `Remove ${s}`,
    projects: "Projects you have done",
    projectsSub: "From courses or your own. Projects you finish on SkillSync are added automatically.",
    projectTitle: "Title",
    domain: "Domain",
    removeProject: "Remove project",
    description: "Description",
    skillUsed: "Skill used",
    addProject: "Add project",
    links: "Links",
    portfolio: "Portfolio URL",
    github: "GitHub URL",
    saved: "Saved · recommendations updated",
    pickType: "Select at least one opportunity type",
    saving: "Saving...",
    save: "Save profile",
  },
  {
    categories: {
      data: "Date",
      bi: "Business intelligence",
      quant: "Statistică",
      programming: "Programare",
      web: "Web și mobil",
      tools: "Unelte",
      automation: "Automatizare",
      ai: "AI",
      business: "Business",
      design: "Design",
      language: "Limbi străine",
      soft: "Abilități personale",
    },
    addSkill: "Adaugă o abilitate",
    title: "Profilul meu",
    intro: "Firmele și algoritmul de potrivire folosesc acest profil. Abilitățile pe care le știi și cele pe care vrei să le înveți contează diferit.",
    about: "Despre tine",
    fullName: "Nume complet",
    headline: "Descriere scurtă",
    university: "Universitate",
    faculty: "Facultate",
    program: "Specializare",
    level: "Nivel",
    levels: { bachelor: "Licență", master: "Master", phd: "Doctorat" },
    year: "Anul",
    city: "Oraș",
    courses: "Materii urmate",
    commaSeparated: "Separate prin virgulă",
    bio: "Despre mine",
    bioHint: "Câteva propoziții despre ce ai făcut. Poți scrie în română sau engleză.",
    looking: "Ce cauți?",
    lookingSub: "Bifează tot ce se aplică.",
    types: "Tipuri de oportunități",
    goals: "Obiective",
    domains: "Domenii de interes",
    availability: "Disponibilitate",
    hours: "Ore / săptămână",
    from: "Disponibil de la",
    until: "Disponibil până la",
    workMode: "Mod de lucru",
    modes: { any: "Oricum", remote: "Doar remote", hybrid: "Hibrid", onsite: "La birou" },
    skills: "Abilități",
    skillsSub: "Alege nivelul pentru fiecare abilitate. Marchează ce vrei să înveți: stagiile cu mentor țin cont de asta.",
    levelFor: (s) => `Nivel pentru ${s}`,
    wantToLearn: "Vreau să învăț",
    remove: (s) => `Șterge ${s}`,
    projects: "Proiecte făcute",
    projectsSub: "De la facultate sau personale. Proiectele terminate pe SkillSync se adaugă automat.",
    projectTitle: "Titlu",
    domain: "Domeniu",
    removeProject: "Șterge proiectul",
    description: "Descriere",
    skillUsed: "Abilitate folosită",
    addProject: "Adaugă un proiect",
    links: "Linkuri",
    portfolio: "Link portofoliu",
    github: "Link GitHub",
    saved: "Salvat · recomandările s-au actualizat",
    pickType: "Alege cel puțin un tip de oportunitate",
    saving: "Se salvează...",
    save: "Salvează profilul",
  },
);

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {sub && <p className="mb-4 text-sm text-muted-fg">{sub}</p>}
      <div className={sub ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export function SkillPicker({ exclude, onPick, label }: { exclude: string[]; onPick: (id: string) => void; label?: string }) {
  const t = useTexts(T);
  const { meta } = useSession();
  const text = label ?? t.addSkill;
  const groups = useMemo(() => {
    const g: Record<string, { id: string; name: string }[]> = {};
    meta?.skills.filter((s) => !exclude.includes(s.id)).forEach((s) => (g[s.category] ??= []).push(s));
    return g;
  }, [meta, exclude]);
  return (
    <label className="flex items-center gap-2">
      <Plus className="size-4 text-muted-fg" aria-hidden />
      <span className="sr-only">{text}</span>
      <select
        className="input w-auto min-w-[220px] cursor-pointer"
        value=""
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
      >
        <option value="">{text}...</option>
        {Object.entries(groups).map(([cat, list]) => (
          <optgroup key={cat} label={t.categories[cat] ?? cap(cat)}>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

type Form = Omit<Student, "portfolio" | "ratings" | "id" | "email" | "cv_filename">;

export default function StudentProfileEdit() {
  const t = useTexts(T);
  const fm = useFormat();
  const qc = useQueryClient();
  const { meta } = useSession();
  const me = useQuery({ queryKey: ["student-me"], queryFn: () => api<Student>("/students/me") });
  const [f, setF] = useState<Form | null>(null);
  const [courseText, setCourseText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (me.data && !f) {
      const { portfolio: _p, ratings: _r, id: _i, email: _e, cv_filename: _c, ...rest } = me.data;
      setF(rest);
      setCourseText(rest.courses.join(", "));
    }
  }, [me.data, f]);

  const save = useMutation({
    mutationFn: (body: Form) => put<Student>("/students/me", { ...body, courses: courseText.split(",").map((c) => c.trim()).filter(Boolean) }),
    onSuccess: (data) => {
      qc.setQueryData(["student-me"], data);
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "student-me" });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (me.isLoading || !f) return <Spinner />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const toggleIn = <V,>(list: V[], v: V, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));
  const setSkill = (id: string, patch: Partial<StudentSkill>) => set("skills", f.skills.map((s) => (s.skill_id === id ? { ...s, ...patch } : s)));
  const setProject = (i: number, patch: Partial<PastProject>) => set("past_projects", f.past_projects.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const skillLabel = (id: string) => meta?.skills.find((m) => m.id === id)?.name ?? id;

  return (
    <form
      className="mx-auto max-w-4xl space-y-6 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(f);
      }}
    >
      <div>
        <h1 className="text-3xl font-extrabold">{t.title}</h1>
        <p className="mt-1 max-w-2xl text-muted-fg">{t.intro}</p>
      </div>

      <CvUpload studentId={me.data!.id} cvFilename={me.data!.cv_filename} />

      <Section title={t.about}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.fullName} htmlFor="name">
            <input id="name" className="input" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={t.headline} htmlFor="headline">
            <input id="headline" className="input" value={f.headline} onChange={(e) => set("headline", e.target.value)} />
          </Field>
          <Field label={t.university} htmlFor="uni">
            <input id="uni" className="input" value={f.university} onChange={(e) => set("university", e.target.value)} />
          </Field>
          <Field label={t.faculty} htmlFor="faculty">
            <input id="faculty" className="input" value={f.faculty} onChange={(e) => set("faculty", e.target.value)} />
          </Field>
          <Field label={t.program} htmlFor="program">
            <input id="program" className="input" value={f.study_program} onChange={(e) => set("study_program", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.level} htmlFor="level">
              <select id="level" className="input cursor-pointer" value={f.study_level} onChange={(e) => set("study_level", e.target.value as Form["study_level"])}>
                <option value="bachelor">{t.levels.bachelor}</option>
                <option value="master">{t.levels.master}</option>
                <option value="phd">{t.levels.phd}</option>
              </select>
            </Field>
            <Field label={t.year} htmlFor="year">
              <input id="year" type="number" min={1} max={6} className="input" value={f.year} onChange={(e) => set("year", Number(e.target.value))} />
            </Field>
          </div>
          <Field label={t.city} htmlFor="city">
            <input id="city" className="input" value={f.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label={t.courses} htmlFor="courses" hint={t.commaSeparated}>
            <input id="courses" className="input" value={courseText} onChange={(e) => setCourseText(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t.bio} htmlFor="bio" hint={t.bioHint}>
              <textarea id="bio" className="input" rows={4} value={f.bio} onChange={(e) => set("bio", e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title={t.looking} sub={t.lookingSub}>
        <p className="label">{t.types}</p>
        <div className="flex flex-wrap gap-2">
          {(["project", "internship", "job"] as OppType[]).map((ty) => (
            <ToggleChip key={ty} checked={f.accepted_types.includes(ty)} onChange={(on) => set("accepted_types", toggleIn(f.accepted_types, ty, on))}>
              {fm.typesPlural[ty]}
            </ToggleChip>
          ))}
        </div>
        <p className="label mt-5">{t.goals}</p>
        <div className="flex flex-wrap gap-2">
          {meta?.goals.map((g) => (
            <ToggleChip key={g} checked={f.goals.includes(g)} onChange={(on) => set("goals", toggleIn(f.goals, g, on))}>
              {fm.goals[g] ?? g}
            </ToggleChip>
          ))}
        </div>
        <p className="label mt-5">{t.domains}</p>
        <div className="flex flex-wrap gap-2">
          {meta?.domains.map((d) => (
            <ToggleChip key={d} checked={f.domains.includes(d)} onChange={(on) => set("domains", toggleIn(f.domains, d, on))}>
              {fm.domain(d)}
            </ToggleChip>
          ))}
        </div>
      </Section>

      <Section title={t.availability}>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t.hours} htmlFor="hours">
            <input id="hours" type="number" min={1} max={60} className="input" value={f.hours_per_week} onChange={(e) => set("hours_per_week", Number(e.target.value))} />
          </Field>
          <Field label={t.from} htmlFor="from">
            <input id="from" type="date" className="input" value={f.available_from ?? ""} onChange={(e) => set("available_from", e.target.value || null)} />
          </Field>
          <Field label={t.until} htmlFor="to">
            <input id="to" type="date" className="input" value={f.available_to ?? ""} onChange={(e) => set("available_to", e.target.value || null)} />
          </Field>
          <Field label={t.workMode} htmlFor="mode">
            <select id="mode" className="input cursor-pointer" value={f.work_mode} onChange={(e) => set("work_mode", e.target.value as Form["work_mode"])}>
              <option value="any">{t.modes.any}</option>
              <option value="remote">{t.modes.remote}</option>
              <option value="hybrid">{t.modes.hybrid}</option>
              <option value="onsite">{t.modes.onsite}</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title={t.skills} sub={t.skillsSub}>
        <ul className="divide-y divide-border">
          {f.skills.map((s) => (
            <li key={s.skill_id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-[160px] flex-1 font-semibold">{skillLabel(s.skill_id)}</span>
              <Segmented size="sm" label={t.levelFor(skillLabel(s.skill_id))} value={s.level} onChange={(v) => setSkill(s.skill_id, { level: v })} options={fm.levels.map((l, i) => ({ value: i, label: l }))} />
              <ToggleChip checked={s.wants_to_learn} onChange={(v) => setSkill(s.skill_id, { wants_to_learn: v })}>
                {t.wantToLearn}
              </ToggleChip>
              <button type="button" className="btn-ghost min-h-9 px-2" aria-label={t.remove(skillLabel(s.skill_id))} onClick={() => set("skills", f.skills.filter((x) => x.skill_id !== s.skill_id))}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <SkillPicker
            exclude={f.skills.map((s) => s.skill_id)}
            onPick={(id) => set("skills", [...f.skills, { skill_id: id, name: id, category: "", level: 1, wants_to_learn: false }])}
          />
        </div>
      </Section>

      <Section title={t.projects} sub={t.projectsSub}>
        <div className="space-y-4">
          {f.past_projects.map((p, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <Field label={t.projectTitle} htmlFor={`pt-${i}`}>
                  <input id={`pt-${i}`} className="input" value={p.title} onChange={(e) => setProject(i, { title: e.target.value })} />
                </Field>
                <Field label={t.domain} htmlFor={`pd-${i}`}>
                  <select id={`pd-${i}`} className="input cursor-pointer" value={p.domain} onChange={(e) => setProject(i, { domain: e.target.value })}>
                    <option value="">-</option>
                    {meta?.domains.map((d) => (
                      <option key={d} value={d}>
                        {fm.domain(d)}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="button" className="btn-ghost self-end" onClick={() => set("past_projects", f.past_projects.filter((_, j) => j !== i))} aria-label={t.removeProject}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <Field label={t.description} htmlFor={`pdesc-${i}`}>
                <textarea id={`pdesc-${i}`} className="input" rows={2} value={p.description} onChange={(e) => setProject(i, { description: e.target.value })} />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                {p.skills.map((sk) => (
                  <button type="button" key={sk} className="chip cursor-pointer hover:border-danger" onClick={() => setProject(i, { skills: p.skills.filter((x) => x !== sk) })} aria-label={t.remove(skillLabel(sk))}>
                    {skillLabel(sk)} ×
                  </button>
                ))}
                <SkillPicker label={t.skillUsed} exclude={p.skills} onPick={(id) => setProject(i, { skills: [...p.skills, id] })} />
              </div>
            </div>
          ))}
          <button type="button" className="btn-outline" onClick={() => set("past_projects", [...f.past_projects, { title: "", description: "", skills: [], domain: "", url: "" }])}>
            <Plus className="size-4" aria-hidden /> {t.addProject}
          </button>
        </div>
      </Section>

      <Section title={t.links}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.portfolio} htmlFor="pf">
            <input id="pf" type="url" className="input" value={f.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} />
          </Field>
          <Field label={t.github} htmlFor="gh">
            <input id="gh" type="url" className="input" value={f.github_url} onChange={(e) => set("github_url", e.target.value)} />
          </Field>
        </div>
      </Section>

      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-3 px-4 py-3">
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-success" role="status">
              <CheckCircle2 className="size-4" aria-hidden /> {t.saved}
            </span>
          )}
          <ErrorBox error={save.error} />
          {f.accepted_types.length === 0 && <Notice tone="warning">{t.pickType}</Notice>}
          <button className="btn-primary px-6" disabled={save.isPending}>
            <Save className="size-4" aria-hidden /> {save.isPending ? t.saving : t.save}
          </button>
        </div>
      </div>
    </form>
  );
}
