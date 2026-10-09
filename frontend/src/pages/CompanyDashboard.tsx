import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle2, FolderOpen, Hourglass, Pencil, Plus, Star, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { MatchCta } from "../components/MatchCta";
import { StatusBadge, TypeBadge } from "../components/OpportunityCard";
import { Badge, Empty, ErrorBox, Field, Modal, SectionTitle, Skeleton, StatCard, Stars, Tabs } from "../components/ui";
import { api, put } from "../lib/api";
import { money, shortDate } from "../lib/format";
import { roPlural, texts, useTexts } from "../lib/i18n";
import type { Company, Opportunity } from "../lib/types";

type CompanyField = "name" | "headline" | "industry" | "size" | "city" | "website";

const T = texts(
  {
    profile: "Company profile",
    fields: { name: "Company name", headline: "One-line description", industry: "Industry", size: "Employees", city: "City", website: "Website" } as Record<CompanyField, string>,
    about: "About the company",
    cancel: "Cancel",
    save: "Save",
    company: "Company",
    editProfile: "Edit company profile",
    post: "Post an opportunity",
    open: "Open",
    applicantsWaiting: "Applicants waiting",
    inProgress: "In progress",
    yourRating: "Your rating from students",
    fromReviews: (n: number) => `from ${n} review${n === 1 ? "" : "s"}`,
    noReviews: "no reviews yet",
    statusTabs: "Opportunity status",
    completed: "Completed",
    yourOpportunities: "Your opportunities",
    nothing: "Nothing here yet",
    nothingText: "Write what you need in plain words. AI turns it into tasks and skills for you to check.",
    verified: "Verified",
    posted: (d: string) => `posted ${d}`,
    applicants: "applicants",
    invited: "invited",
    studentsRate: "Students rate you on clarity, collaboration and payment:",
    dims: { clarity: "clarity", collaboration: "collaboration", payment: "payment" } as Record<string, string>,
  },
  {
    profile: "Profilul firmei",
    fields: { name: "Numele firmei", headline: "Descriere pe un rând", industry: "Domeniu", size: "Angajați", city: "Oraș", website: "Site web" },
    about: "Despre firmă",
    cancel: "Renunță",
    save: "Salvează",
    company: "Firmă",
    editProfile: "Editează profilul firmei",
    post: "Publică o oportunitate",
    open: "Deschise",
    applicantsWaiting: "Aplicări în așteptare",
    inProgress: "În lucru",
    yourRating: "Nota ta de la studenți",
    fromReviews: (n) => `din ${roPlural(n, "recenzie", "recenzii")}`,
    noReviews: "încă fără recenzii",
    statusTabs: "Starea oportunităților",
    completed: "Finalizate",
    yourOpportunities: "Oportunitățile tale",
    nothing: "Încă nimic aici",
    nothingText: "Scrie în cuvinte simple de ce ai nevoie. AI-ul o transformă în sarcini și abilități pe care le verifici tu.",
    verified: "Validat",
    posted: (d) => `publicat ${d}`,
    applicants: "aplicări",
    invited: "invitați",
    studentsRate: "Studenții îți dau note pentru claritate, colaborare și plată:",
    dims: { clarity: "claritate", collaboration: "colaborare", payment: "plată" },
  },
);

function EditCompany({ c, open, onClose }: { c: Company; open: boolean; onClose: () => void }) {
  const t = useTexts(T);
  const qc = useQueryClient();
  const [f, setF] = useState(c);
  const save = useMutation({
    mutationFn: () => put<Company>("/companies/me", f),
    onSuccess: () => {
      qc.invalidateQueries();
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title={t.profile}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {(["name", "headline", "industry", "size", "city", "website"] as const).map((k) => (
          <Field key={k} label={t.fields[k]} htmlFor={`c-${k}`}>
            <input id={`c-${k}`} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Field label={t.about} htmlFor="c-desc">
            <textarea id="c-desc" className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <ErrorBox error={save.error} />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="btn-primary" disabled={save.isPending}>
            {t.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const GROUPS = {
  active: ["open", "draft"],
  progress: ["in_progress", "delivered", "paid"],
  done: ["completed", "closed"],
} as const;

export default function CompanyDashboard() {
  const t = useTexts(T);
  const me = useQuery({ queryKey: ["company-me"], queryFn: () => api<Company>("/companies/me") });
  const opps = useQuery({ queryKey: ["my-opps"], queryFn: () => api<Opportunity[]>("/opportunities/mine") });
  const [tab, setTab] = useState<keyof typeof GROUPS>("active");
  const [edit, setEdit] = useState(false);
  const list = opps.data?.filter((o) => (GROUPS[tab] as readonly string[]).includes(o.status)) ?? [];
  const count = (k: keyof typeof GROUPS) => opps.data?.filter((o) => (GROUPS[k] as readonly string[]).includes(o.status)).length;
  const applicants = opps.data?.filter((o) => o.status === "open").reduce((n, o) => n + o.applications_count, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{me.data?.name ?? t.company}</h1>
          <p className="mt-1 flex items-center gap-2 text-muted-fg">
            {me.data?.headline}
            {me.data && (
              <button className="btn-ghost min-h-8 px-2" onClick={() => setEdit(true)} aria-label={t.editProfile}>
                <Pencil className="size-4" aria-hidden />
              </button>
            )}
          </p>
        </div>
        <Link to="/company/new" className="btn-accent px-5">
          <Plus className="size-4" aria-hidden /> {t.post}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<FolderOpen className="size-5" />} label={t.open} value={count("active") ?? "-"} />
        <StatCard icon={<Users className="size-5" />} label={t.applicantsWaiting} value={applicants ?? "-"} />
        <StatCard icon={<Hourglass className="size-5" />} label={t.inProgress} value={count("progress") ?? "-"} />
        <StatCard
          icon={<Star className="size-5" />}
          label={t.yourRating}
          value={me.data?.ratings.average?.toFixed(1) ?? "-"}
          sub={me.data?.ratings.count ? t.fromReviews(me.data.ratings.count) : t.noReviews}
        />
      </div>

      <MatchCta role="company" />

      <section>
        <SectionTitle
          action={
            <Tabs
              label={t.statusTabs}
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "active", label: t.open, count: count("active") },
                { id: "progress", label: t.inProgress, count: count("progress") },
                { id: "done", label: t.completed, count: count("done") },
              ]}
            />
          }
        >
          {t.yourOpportunities}
        </SectionTitle>
        <ErrorBox error={opps.error} />
        {opps.isLoading ? (
          <Skeleton className="h-48" />
        ) : list.length === 0 ? (
          <Empty
            icon={<FolderOpen className="size-8" />}
            title={t.nothing}
            action={
              <Link className="btn-primary" to="/company/new">
                {t.post}
              </Link>
            }
          >
            {t.nothingText}
          </Empty>
        ) : (
          <div className="card divide-y divide-border">
            {list.map((o) => (
              <Link key={o.id} to={`/opportunities/${o.id}`} className="flex cursor-pointer flex-wrap items-center gap-4 p-4 transition-colors hover:bg-muted/60">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <TypeBadge type={o.type} />
                    <StatusBadge status={o.status} />
                    {o.university_verified && (
                      <Badge tone="primary" icon={<BadgeCheck className="size-3" aria-hidden />}>
                        {t.verified}
                      </Badge>
                    )}
                  </div>
                  <p className="font-bold">{o.title}</p>
                  <p className="text-sm text-muted-fg">
                    {money(o)} · {t.posted(shortDate(o.created_at))}
                    {o.selected_student ? ` · ${o.selected_student.name}` : ""}
                  </p>
                </div>
                <div className="flex gap-4 text-center text-sm">
                  <div>
                    <p className="text-xl font-bold tabular-nums">{o.applications_count}</p>
                    <p className="text-xs text-muted-fg">{t.applicants}</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular-nums">{o.invitations_count}</p>
                    <p className="text-xs text-muted-fg">{t.invited}</p>
                  </div>
                  {o.status === "completed" && <CheckCircle2 className="size-6 self-center text-success" aria-label={t.completed} />}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {me.data && me.data.ratings.count > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-fg">
          {t.studentsRate} <Stars value={me.data.ratings.average ?? 0} />
          {Object.entries(me.data.ratings.dimensions)
            .map(([k, v]) => `${t.dims[k] ?? k} ${v.toFixed(1)}`)
            .join(" · ")}
        </p>
      )}
      {me.data && <EditCompany c={me.data} open={edit} onClose={() => setEdit(false)} />}
    </div>
  );
}
