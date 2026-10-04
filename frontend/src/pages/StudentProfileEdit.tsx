import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ErrorBox, Field, Notice, Segmented, Spinner, ToggleChip } from "../components/ui";
import { api, ApiError, put } from "../lib/api";
import { GOAL_LABEL, LEVELS, TYPE_PLURAL, cap } from "../lib/format";
import { useSession } from "../lib/session";
import type { OppType, PastProject, Student, StudentSkill } from "../lib/types";

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {sub && <p className="mb-4 text-sm text-muted-fg">{sub}</p>}
      <div className={sub ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export function SkillPicker({ exclude, onPick, label = "Add a skill" }: { exclude: string[]; onPick: (id: string) => void; label?: string }) {
  const { meta } = useSession();
  const groups = useMemo(() => {
    const g: Record<string, { id: string; name: string }[]> = {};
    meta?.skills.filter((s) => !exclude.includes(s.id)).forEach((s) => (g[s.category] ??= []).push(s));
    return g;
  }, [meta, exclude]);
  return (
    <label className="flex items-center gap-2">
      <Plus className="size-4 text-muted-fg" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        className="input w-auto min-w-[220px] cursor-pointer"
        value=""
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
      >
        <option value="">{label}...</option>
        {Object.entries(groups).map(([cat, list]) => (
          <optgroup key={cat} label={cap(cat)}>
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

  const cv = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/students/me/cv", { method: "POST", body: fd, headers: { "X-User-Id": String(me.data!.id) } });
      if (!res.ok) throw new ApiError(res.status, (await res.json()).detail ?? "Upload failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student-me"] }),
  });

  if (me.isLoading || !f) return <Spinner />;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const toggleIn = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));
  const setSkill = (id: string, patch: Partial<StudentSkill>) => set("skills", f.skills.map((s) => (s.skill_id === id ? { ...s, ...patch } : s)));
  const setProject = (i: number, patch: Partial<PastProject>) => set("past_projects", f.past_projects.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <form
      className="mx-auto max-w-4xl space-y-6 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(f);
      }}
    >
      <div>
        <h1 className="text-3xl font-extrabold">My profile</h1>
        <p className="mt-1 text-muted-fg">The matching engine reads this profile. "Know" and "want to learn" are scored differently.</p>
      </div>

      <Section title="About you">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name">
            <input id="name" className="input" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Headline" htmlFor="headline">
            <input id="headline" className="input" value={f.headline} onChange={(e) => set("headline", e.target.value)} />
          </Field>
          <Field label="University" htmlFor="uni">
            <input id="uni" className="input" value={f.university} onChange={(e) => set("university", e.target.value)} />
          </Field>
          <Field label="Faculty" htmlFor="faculty">
            <input id="faculty" className="input" value={f.faculty} onChange={(e) => set("faculty", e.target.value)} />
          </Field>
          <Field label="Study program" htmlFor="program">
            <input id="program" className="input" value={f.study_program} onChange={(e) => set("study_program", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Level" htmlFor="level">
              <select id="level" className="input cursor-pointer" value={f.study_level} onChange={(e) => set("study_level", e.target.value as Form["study_level"])}>
                <option value="bachelor">Bachelor</option>
                <option value="master">Master</option>
                <option value="phd">PhD</option>
              </select>
            </Field>
            <Field label="Year" htmlFor="year">
              <input id="year" type="number" min={1} max={6} className="input" value={f.year} onChange={(e) => set("year", Number(e.target.value))} />
            </Field>
          </div>
          <Field label="City" htmlFor="city">
            <input id="city" className="input" value={f.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Courses taken" htmlFor="courses" hint="Comma-separated">
            <input id="courses" className="input" value={courseText} onChange={(e) => setCourseText(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="About me" htmlFor="bio" hint="Describe what you have built. This text feeds the semantic (AI) part of the match, in Romanian or English.">
              <textarea id="bio" className="input" rows={4} value={f.bio} onChange={(e) => set("bio", e.target.value)} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="What are you looking for?" sub="Pick everything that applies. A year-2 student might want only mandatory practice; another only course credit for a project.">
        <p className="label">Opportunity types</p>
        <div className="flex flex-wrap gap-2">
          {(["project", "internship", "job"] as OppType[]).map((t) => (
            <ToggleChip key={t} checked={f.accepted_types.includes(t)} onChange={(on) => set("accepted_types", toggleIn(f.accepted_types, t, on))}>
              {TYPE_PLURAL[t]}
            </ToggleChip>
          ))}
        </div>
        <p className="label mt-5">Goals</p>
        <div className="flex flex-wrap gap-2">
          {meta?.goals.map((g) => (
            <ToggleChip key={g} checked={f.goals.includes(g)} onChange={(on) => set("goals", toggleIn(f.goals, g, on))}>
              {GOAL_LABEL[g] ?? g}
            </ToggleChip>
          ))}
        </div>
        <p className="label mt-5">Domains of interest</p>
        <div className="flex flex-wrap gap-2">
          {meta?.domains.map((d) => (
            <ToggleChip key={d} checked={f.domains.includes(d)} onChange={(on) => set("domains", toggleIn(f.domains, d, on))}>
              {cap(d)}
            </ToggleChip>
          ))}
        </div>
      </Section>

      <Section title="Availability">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Hours / week" htmlFor="hours">
            <input id="hours" type="number" min={1} max={60} className="input" value={f.hours_per_week} onChange={(e) => set("hours_per_week", Number(e.target.value))} />
          </Field>
          <Field label="Available from" htmlFor="from">
            <input id="from" type="date" className="input" value={f.available_from ?? ""} onChange={(e) => set("available_from", e.target.value || null)} />
          </Field>
          <Field label="Available until" htmlFor="to">
            <input id="to" type="date" className="input" value={f.available_to ?? ""} onChange={(e) => set("available_to", e.target.value || null)} />
          </Field>
          <Field label="Work mode" htmlFor="mode">
            <select id="mode" className="input cursor-pointer" value={f.work_mode} onChange={(e) => set("work_mode", e.target.value as Form["work_mode"])}>
              <option value="any">Any</option>
              <option value="remote">Remote only</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Skills" sub="Be honest: required skills declared below the minimum are a hard filter. Mark skills you want to learn; internships with mentoring will value that.">
        <ul className="divide-y divide-border">
          {f.skills.map((s) => (
            <li key={s.skill_id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-[160px] flex-1 font-semibold">{meta?.skills.find((m) => m.id === s.skill_id)?.name ?? s.skill_id}</span>
              <Segmented size="sm" label={`Level for ${s.skill_id}`} value={s.level} onChange={(v) => setSkill(s.skill_id, { level: v })} options={LEVELS.map((l, i) => ({ value: i, label: l }))} />
              <ToggleChip checked={s.wants_to_learn} onChange={(v) => setSkill(s.skill_id, { wants_to_learn: v })}>
                Want to learn
              </ToggleChip>
              <button type="button" className="btn-ghost min-h-9 px-2" aria-label={`Remove ${s.skill_id}`} onClick={() => set("skills", f.skills.filter((x) => x.skill_id !== s.skill_id))}>
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

      <Section title="Projects you have done" sub="Self-declared (course or personal). Verified GoBiz projects are added automatically after completion.">
        <div className="space-y-4">
          {f.past_projects.map((p, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <Field label="Title" htmlFor={`pt-${i}`}>
                  <input id={`pt-${i}`} className="input" value={p.title} onChange={(e) => setProject(i, { title: e.target.value })} />
                </Field>
                <Field label="Domain" htmlFor={`pd-${i}`}>
                  <select id={`pd-${i}`} className="input cursor-pointer" value={p.domain} onChange={(e) => setProject(i, { domain: e.target.value })}>
                    <option value="">-</option>
                    {meta?.domains.map((d) => (
                      <option key={d} value={d}>
                        {cap(d)}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="button" className="btn-ghost self-end" onClick={() => set("past_projects", f.past_projects.filter((_, j) => j !== i))} aria-label="Remove project">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <Field label="Description" htmlFor={`pdesc-${i}`}>
                <textarea id={`pdesc-${i}`} className="input" rows={2} value={p.description} onChange={(e) => setProject(i, { description: e.target.value })} />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                {p.skills.map((sk) => (
                  <button type="button" key={sk} className="chip cursor-pointer hover:border-danger" onClick={() => setProject(i, { skills: p.skills.filter((x) => x !== sk) })} aria-label={`Remove ${sk}`}>
                    {meta?.skills.find((m) => m.id === sk)?.name ?? sk} ×
                  </button>
                ))}
                <SkillPicker label="Skill used" exclude={p.skills} onPick={(id) => setProject(i, { skills: [...p.skills, id] })} />
              </div>
            </div>
          ))}
          <button type="button" className="btn-outline" onClick={() => set("past_projects", [...f.past_projects, { title: "", description: "", skills: [], domain: "", url: "" }])}>
            <Plus className="size-4" aria-hidden /> Add project
          </button>
        </div>
      </Section>

      <Section title="Links & CV">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Portfolio URL" htmlFor="pf">
            <input id="pf" type="url" className="input" value={f.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} />
          </Field>
          <Field label="GitHub URL" htmlFor="gh">
            <input id="gh" type="url" className="input" value={f.github_url} onChange={(e) => set("github_url", e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <label className="btn-outline cursor-pointer">
            <FileUp className="size-4" aria-hidden />
            {me.data?.cv_filename ? "Replace CV" : "Upload CV"} (PDF, DOC, DOCX, ODT · max 5 MB)
            <input type="file" accept=".pdf,.doc,.docx,.odt" className="sr-only" onChange={(e) => e.target.files?.[0] && cv.mutate(e.target.files[0])} />
          </label>
          {me.data?.cv_filename && <p className="hint">Current: {me.data.cv_filename.split("_").slice(2).join("_")}</p>}
          {cv.isPending && <p className="hint">Uploading...</p>}
          <div className="mt-2">
            <ErrorBox error={cv.error} />
          </div>
        </div>
      </Section>

      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-3 px-4 py-3">
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-success" role="status">
              <CheckCircle2 className="size-4" aria-hidden /> Saved · recommendations updated
            </span>
          )}
          <ErrorBox error={save.error} />
          {f.accepted_types.length === 0 && <Notice tone="warning">Select at least one opportunity type</Notice>}
          <button className="btn-primary px-6" disabled={save.isPending}>
            <Save className="size-4" aria-hidden /> {save.isPending ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    </form>
  );
}
