import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle2, FolderOpen, Hourglass, Pencil, Plus, Star, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge, TypeBadge } from "../components/OpportunityCard";
import { Badge, Empty, ErrorBox, Field, Modal, SectionTitle, Skeleton, StatCard, Stars, Tabs } from "../components/ui";
import { api, put } from "../lib/api";
import { money, shortDate } from "../lib/format";
import type { Company, Opportunity } from "../lib/types";

function EditCompany({ c, open, onClose }: { c: Company; open: boolean; onClose: () => void }) {
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
    <Modal open={open} onClose={onClose} title="Company profile">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {(
          [
            ["name", "Company name"],
            ["headline", "One-line description"],
            ["industry", "Industry"],
            ["size", "Employees"],
            ["city", "City"],
            ["website", "Website"],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label} htmlFor={`c-${k}`}>
            <input id={`c-${k}`} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Field label="About the company" htmlFor="c-desc">
            <textarea id="c-desc" className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <ErrorBox error={save.error} />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={save.isPending}>
            Save
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
          <h1 className="text-3xl font-extrabold">{me.data?.name ?? "Company"}</h1>
          <p className="mt-1 flex items-center gap-2 text-muted-fg">
            {me.data?.headline}
            {me.data && (
              <button className="btn-ghost min-h-8 px-2" onClick={() => setEdit(true)} aria-label="Edit company profile">
                <Pencil className="size-4" aria-hidden />
              </button>
            )}
          </p>
        </div>
        <Link to="/company/new" className="btn-accent px-5">
          <Plus className="size-4" aria-hidden /> Post an opportunity
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<FolderOpen className="size-5" />} label="Open" value={count("active") ?? "-"} />
        <StatCard icon={<Users className="size-5" />} label="Applicants waiting" value={applicants ?? "-"} />
        <StatCard icon={<Hourglass className="size-5" />} label="In progress" value={count("progress") ?? "-"} />
        <StatCard
          icon={<Star className="size-5" />}
          label="Your rating from students"
          value={me.data?.ratings.average?.toFixed(1) ?? "-"}
          sub={me.data?.ratings.count ? `from ${me.data.ratings.count} review${me.data.ratings.count === 1 ? "" : "s"}` : "no reviews yet"}
        />
      </div>

      <section>
        <SectionTitle
          action={
            <Tabs
              label="Opportunity status"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "active", label: "Open", count: count("active") },
                { id: "progress", label: "In progress", count: count("progress") },
                { id: "done", label: "Completed", count: count("done") },
              ]}
            />
          }
        >
          Your opportunities
        </SectionTitle>
        <ErrorBox error={opps.error} />
        {opps.isLoading ? (
          <Skeleton className="h-48" />
        ) : list.length === 0 ? (
          <Empty icon={<FolderOpen className="size-8" />} title="Nothing here yet" action={<Link className="btn-primary" to="/company/new">Post an opportunity</Link>}>
            Write what you need in plain words. AI turns it into tasks and skills for you to check.
          </Empty>
        ) : (
          <div className="card divide-y divide-border">
            {list.map((o) => (
              <Link key={o.id} to={`/opportunities/${o.id}`} className="flex cursor-pointer flex-wrap items-center gap-4 p-4 transition-colors hover:bg-muted/60">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <TypeBadge type={o.type} />
                    <StatusBadge status={o.status} />
                    {o.university_verified && <Badge tone="primary" icon={<BadgeCheck className="size-3" aria-hidden />}>Verified</Badge>}
                  </div>
                  <p className="font-bold">{o.title}</p>
                  <p className="text-sm text-muted-fg">
                    {money(o)} · posted {shortDate(o.created_at)}
                    {o.selected_student ? ` · ${o.selected_student.name}` : ""}
                  </p>
                </div>
                <div className="flex gap-4 text-center text-sm">
                  <div>
                    <p className="text-xl font-bold tabular-nums">{o.applications_count}</p>
                    <p className="text-xs text-muted-fg">applicants</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular-nums">{o.invitations_count}</p>
                    <p className="text-xs text-muted-fg">invited</p>
                  </div>
                  {o.status === "completed" && <CheckCircle2 className="size-6 self-center text-success" aria-label="Completed" />}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {me.data && me.data.ratings.count > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-fg">
          Students rate you on clarity, collaboration and payment: <Stars value={me.data.ratings.average ?? 0} />
          {Object.entries(me.data.ratings.dimensions)
            .map(([k, v]) => `${k} ${v.toFixed(1)}`)
            .join(" · ")}
        </p>
      )}
      {me.data && <EditCompany c={me.data} open={edit} onClose={() => setEdit(false)} />}
    </div>
  );
}
