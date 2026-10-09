import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BadgeCheck, Bot, Building2, CalendarClock, CheckCircle2, Clock, GraduationCap, HandHelping, MapPin, MessageSquare,
  Send, ShieldCheck, Sparkles, Star, Target, UserPlus, Users, Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Chat } from "../components/Chat";
import { MatchBreakdown, MatchPill, MatchRing } from "../components/Match";
import { StatusBadge, TypeBadge } from "../components/OpportunityCard";
import { Pipeline } from "../components/Pipeline";
import { Avatar, Badge, Empty, ErrorBox, Modal, Notice, Spinner, StarInput, Stars, Tabs } from "../components/ui";
import { api, post } from "../lib/api";
import { ACADEMIC_LABEL, DIFFICULTY, LEVELS, MODE_LABEL, cap, money, shortDate } from "../lib/format";
import { useSession, useSkillName } from "../lib/session";
import type { CandidateCard, Candidates, Opportunity } from "../lib/types";

const DIMENSIONS = {
  company_to_student: [
    ["quality", "Quality of the result"],
    ["deadline", "Respected the deadline"],
    ["communication", "Communication"],
  ],
  student_to_company: [
    ["clarity", "Clarity of requirements"],
    ["collaboration", "Collaboration"],
    ["payment", "Paid as agreed"],
  ],
} as const;

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted-fg">{icon}</span>
      <div>
        <p className="text-xs text-muted-fg">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function ReviewDialog({ o, direction, open, onClose }: { o: Opportunity; direction: keyof typeof DIMENSIONS; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const dims = DIMENSIONS[direction];
  const m = useMutation({
    mutationFn: () => post(`/opportunities/${o.id}/reviews`, { ratings, comment }),
    onSuccess: () => {
      qc.invalidateQueries();
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title={direction === "company_to_student" ? `Review ${o.selected_student?.name}` : `Review ${o.company.name}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        {dims.map(([k, label]) => (
          <div key={k} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{label}</span>
            <StarInput label={label} value={ratings[k] ?? 0} onChange={(v) => setRatings((r) => ({ ...r, [k]: v }))} />
          </div>
        ))}
        <div>
          <label className="label" htmlFor="review-comment">
            Comment (public on the profile)
          </label>
          <textarea id="review-comment" className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        {direction === "company_to_student" && <Notice>After your review, the project is finished and goes into the student's portfolio.</Notice>}
        <ErrorBox error={m.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={dims.some(([k]) => !ratings[k]) || m.isPending}>
            Submit review
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CandidateRow({ c, o, onChanged }: { c: CandidateCard; o: Opportunity; onChanged: () => void }) {
  const skillName = useSkillName();
  const [expanded, setExpanded] = useState(false);
  const [chat, setChat] = useState(false);
  const invite = useMutation({ mutationFn: () => post(`/opportunities/${o.id}/invite`, { student_id: c.student.id }), onSuccess: onChanged });
  const select = useMutation({ mutationFn: () => post(`/opportunities/${o.id}/select`, { student_id: c.student.id }), onSuccess: onChanged });
  const a = c.application;
  const canSelect = o.status === "open" && a && (a.kind === "application" ? a.status === "pending" : a.status === "accepted");

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <MatchRing match={c.match} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/students/${c.student.id}`} className="link font-bold">
              {c.student.name}
            </Link>
            {a && (
              <Badge tone={a.status === "selected" || a.kind === "match" ? "success" : a.status === "declined" || a.status === "rejected" ? "danger" : "neutral"}>
                {a.kind === "match" ? "Matched" : `${a.kind === "invitation" ? "Invited" : "Applied"} · ${a.status}`}
              </Badge>
            )}
            {c.match.status === "to_clarify" && <Badge tone="warning">To clarify</Badge>}
          </div>
          <p className="text-xs text-muted-fg">
            {c.student.headline} · {c.student.university}, year {c.student.year}
          </p>
          <p className="mt-1 text-sm text-muted-fg">{c.match.summary}</p>
          {a?.message && <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-sm italic">"{a.message}"</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {!a && o.status === "open" && (
              <button className="btn-outline min-h-9 px-3" onClick={() => invite.mutate()} disabled={invite.isPending}>
                <UserPlus className="size-4" aria-hidden /> Invite
              </button>
            )}
            {canSelect && (
              <button className="btn-primary min-h-9 px-3" onClick={() => select.mutate()} disabled={select.isPending}>
                <CheckCircle2 className="size-4" aria-hidden /> Select
              </button>
            )}
            {a && (
              <button className="btn-ghost min-h-9 px-3" onClick={() => setChat((v) => !v)} aria-expanded={chat}>
                <MessageSquare className="size-4" aria-hidden /> Message
              </button>
            )}
            <button className="btn-ghost min-h-9 px-3" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
              <Sparkles className="size-4" aria-hidden /> {expanded ? "Hide details" : "Why?"}
            </button>
          </div>
          <ErrorBox error={invite.error || select.error} />
          {expanded && (
            <div className="mt-3 rounded-xl border border-border p-4">
              <MatchBreakdown match={c.match} skillName={skillName} audience="company" />
            </div>
          )}
          {chat && (
            <div className="mt-3">
              <Chat opportunityId={o.id} withUser={c.student.id} withName={c.student.name} height="h-56" />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function CandidatesPanel({ o }: { o: Opportunity }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"ai" | "matches" | "applicants" | "invited">("ai");
  const cands = useQuery({ queryKey: ["candidates", o.id], queryFn: () => api<Candidates>(`/opportunities/${o.id}/candidates`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["candidates", o.id] });
    qc.invalidateQueries({ queryKey: ["opp", String(o.id)] });
  };
  const list = { ai: cands.data?.ai_matches, matches: cands.data?.matches, applicants: cands.data?.applicants, invited: cands.data?.invited }[tab];
  return (
    <section className="card p-5" aria-labelledby="cand-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="cand-title" className="text-lg font-bold">
          Candidates
        </h2>
        <Link to={`/talent?opportunity=${o.id}`} className="link text-sm">
          Search all students
        </Link>
      </div>
      <Tabs
        label="Candidate lists"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "ai", label: <><Sparkles className="size-4" aria-hidden /> Suggested</>, count: cands.data?.ai_matches.length },
          { id: "matches", label: "Matches", count: cands.data?.matches.length },
          { id: "applicants", label: "Applicants", count: cands.data?.applicants.length },
          { id: "invited", label: "Invited", count: cands.data?.invited.length },
        ]}
      />
      {tab === "ai" && (
        <p className="mt-3 text-sm text-muted-fg">
          All {cands.data?.all_count ?? ""} students, best fits first. Students who clearly do not fit are left out.
        </p>
      )}
      <ErrorBox error={cands.error} />
      {cands.isLoading ? (
        <Spinner />
      ) : list && list.length > 0 ? (
        <ul className="divide-y divide-border">
          {list.map((c) => (
            <CandidateRow key={c.student.id} c={c} o={o} onChanged={refresh} />
          ))}
        </ul>
      ) : (
        <Empty title={{ ai: "No compatible students yet", matches: "No matches yet", applicants: "No applications yet", invited: "No invitations yet" }[tab]}>
          {tab === "ai" ? "Try making some skills optional or learnable." : tab === "matches" ? "Swipe right on students on the Match page." : "You can invite students from the Suggested tab."}
        </Empty>
      )}
    </section>
  );
}

function OwnerActions({ o }: { o: Opportunity }) {
  const qc = useQueryClient();
  const [review, setReview] = useState(false);
  const status = useMutation({
    mutationFn: (s: string) => post(`/opportunities/${o.id}/status`, { status: s }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const verify = useMutation({ mutationFn: () => post(`/opportunities/${o.id}/request-verification`), onSuccess: () => qc.invalidateQueries() });
  const reviewed = o.reviews?.some((r) => r.direction === "company_to_student");
  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-lg font-bold">Manage</h2>
      <Pipeline status={o.status} />
      {o.selected_student && (
        <p className="text-sm">
          Selected student:{" "}
          <Link className="link" to={`/students/${o.selected_student.id}`}>
            {o.selected_student.name}
          </Link>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {o.status === "delivered" && (
          <>
            <button className="btn-primary" onClick={() => status.mutate("paid")}>
              <Wallet className="size-4" aria-hidden /> Confirm payment
            </button>
            <button className="btn-outline" onClick={() => status.mutate("in_progress")}>
              Request changes
            </button>
          </>
        )}
        {o.status === "paid" && !reviewed && (
          <button className="btn-accent" onClick={() => setReview(true)}>
            <Star className="size-4" aria-hidden /> Review student & complete
          </button>
        )}
        {o.status === "open" && (
          <button className="btn-danger" onClick={() => status.mutate("closed")}>
            Close opportunity
          </button>
        )}
        {!o.university_verified && !o.verification_requested && (
          <button className="btn-outline" onClick={() => verify.mutate()}>
            <ShieldCheck className="size-4" aria-hidden /> Request University verification
          </button>
        )}
        {o.verification_requested && !o.university_verified && <Badge tone="warning">Verification pending</Badge>}
      </div>
      {o.status === "in_progress" && <p className="text-sm text-muted-fg">Waiting for the student to mark the work as delivered.</p>}
      <ErrorBox error={status.error || verify.error} />
      <ReviewDialog o={o} direction="company_to_student" open={review} onClose={() => setReview(false)} />
    </div>
  );
}

function StudentPanel({ o }: { o: Opportunity }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const skillName = useSkillName();
  const [applyOpen, setApplyOpen] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const done = () => {
    qc.invalidateQueries();
    setApplyOpen(false);
    setMentorOpen(false);
  };
  const apply = useMutation({ mutationFn: () => post(`/opportunities/${o.id}/apply`, { message }), onSuccess: done });
  const respond = useMutation({ mutationFn: (action: string) => post(`/applications/${o.my_application!.id}/respond`, { action }), onSuccess: done });
  const mentor = useMutation({ mutationFn: () => post(`/opportunities/${o.id}/mentorship`, { note }), onSuccess: done });
  const deliver = useMutation({ mutationFn: () => post(`/opportunities/${o.id}/status`, { status: "delivered" }), onSuccess: done });

  const app = o.my_application;
  const selected = o.selected_student?.id === user?.id;
  const reviewed = o.reviews?.some((r) => r.direction === "student_to_company");

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-5">
        {selected ? (
          <>
            <h2 className="text-lg font-bold">Your collaboration</h2>
            <Pipeline status={o.status} />
            {o.status === "in_progress" && (
              <button className="btn-primary w-full" onClick={() => deliver.mutate()} disabled={deliver.isPending}>
                <Send className="size-4" aria-hidden /> Mark work as delivered
              </button>
            )}
            {(o.status === "paid" || o.status === "completed") && !reviewed && (
              <button className="btn-accent w-full" onClick={() => setReview(true)}>
                <Star className="size-4" aria-hidden /> Review {o.company.name}
              </button>
            )}
          </>
        ) : app ? (
          <>
            <h2 className="text-lg font-bold">{app.kind === "match" ? "It's a match!" : app.kind === "invitation" ? "You were invited" : "You applied"}</h2>
            <p className="text-sm text-muted-fg">
              {app.kind === "match" ? "You and the company both said yes. Send them a message." : <>Status: <span className="font-semibold text-fg">{app.status}</span></>} · {shortDate(app.created_at)}
            </p>
            {app.kind === "invitation" && app.status === "pending" && (
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={() => respond.mutate("accept")}>
                  Accept invitation
                </button>
                <button className="btn-outline flex-1" onClick={() => respond.mutate("decline")}>
                  Decline
                </button>
              </div>
            )}
            {app.status === "pending" && app.kind === "application" && (
              <button className="btn-ghost w-full" onClick={() => respond.mutate("withdraw")}>
                Withdraw application
              </button>
            )}
          </>
        ) : o.status === "open" ? (
          <>
            <h2 className="text-lg font-bold">Interested?</h2>
            <p className="text-muted-fg">You can apply even if it was not suggested to you.</p>
            <button className="btn-accent w-full" onClick={() => setApplyOpen(true)}>
              <Send className="size-4" aria-hidden /> Apply to this {o.type}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-fg">This opportunity is no longer accepting applications.</p>
        )}
        {!o.my_mentorship ? (
          <button className="btn-outline w-full" onClick={() => setMentorOpen(true)}>
            <HandHelping className="size-4" aria-hidden /> Ask a professor for help
          </button>
        ) : (
          <p className="text-sm text-muted-fg">
            Mentorship: <span className="font-semibold text-fg">{o.my_mentorship.status}</span>
            {o.my_mentorship.mentor ? ` with ${o.my_mentorship.mentor.name}` : ""}
          </p>
        )}
        <ErrorBox error={apply.error || respond.error || mentor.error || deliver.error} />
      </div>

      {o.match && (
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="size-5 text-primary-strong" aria-hidden /> How well you fit
          </h2>
          <MatchBreakdown match={o.match} skillName={skillName} />
        </div>
      )}

      {(app || selected) && (
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Messages with {o.company.name}</h2>
          <Chat opportunityId={o.id} withUser={o.company.id} withName={o.company.name} />
        </div>
      )}

      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title={`Apply: ${o.title}`}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply.mutate();
          }}
        >
          {o.match && (
            <div className="flex items-center gap-2 text-sm">
              <MatchPill match={o.match} /> <span className="text-muted-fg">Your match score is shared with the company.</span>
            </div>
          )}
          <div>
            <label className="label" htmlFor="apply-msg">
              Short message to {o.company.name}
            </label>
            <textarea id="apply-msg" className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why are you a good fit? Link relevant work." />
          </div>
          <ErrorBox error={apply.error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setApplyOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={apply.isPending}>
              Send application
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={mentorOpen} onClose={() => setMentorOpen(false)} title="Request mentorship">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mentor.mutate();
          }}
        >
          <p className="text-muted-fg">A professor can guide you on a harder project, or help you use it for a course or your thesis.</p>
          <div>
            <label className="label" htmlFor="mentor-note">
              What would you like help with?
            </label>
            <textarea id="mentor-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setMentorOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={mentor.isPending}>
              Send request
            </button>
          </div>
        </form>
      </Modal>
      <ReviewDialog o={o} direction="student_to_company" open={review} onClose={() => setReview(false)} />
    </div>
  );
}

function UniversityPanel({ o }: { o: Opportunity }) {
  const qc = useQueryClient();
  const verify = useMutation({
    mutationFn: (approve: boolean) => post(`/university/opportunities/${o.id}/verify`, { approve }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <div className="card space-y-3 p-5">
      <h2 className="text-lg font-bold">University validation</h2>
      {o.university_verified ? (
        <Notice tone="success">
          Verified{o.verified_by ? ` by ${o.verified_by.name}` : ""}. Suitable as an applied project for students.
        </Notice>
      ) : (
        <>
          <p className="text-sm text-muted-fg">
            {o.verification_requested ? "The company asked for University Verified status." : "You can mark this opportunity as University Verified."}
          </p>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={() => verify.mutate(true)}>
              <BadgeCheck className="size-4" aria-hidden /> Verify
            </button>
            {o.verification_requested && (
              <button className="btn-outline flex-1" onClick={() => verify.mutate(false)}>
                Reject
              </button>
            )}
          </div>
        </>
      )}
      <ErrorBox error={verify.error} />
    </div>
  );
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const { user } = useSession();
  const q = useQuery({ queryKey: ["opp", id, user?.id], queryFn: () => api<Opportunity>(`/opportunities/${id}`) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const o = q.data!;
  const required = o.skills.filter((s) => s.mandatory);
  const optional = o.skills.filter((s) => !s.mandatory);

  return (
    <div className="space-y-6">
      <Link to={`/explore?type=${o.type}`} className="btn-ghost -ml-3 min-h-9 px-3">
        <ArrowLeft className="size-4" aria-hidden /> Back to {o.type}s
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <article className="card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={o.type} />
              <StatusBadge status={o.status} />
              {o.university_verified && (
                <Badge tone="primary" icon={<BadgeCheck className="size-3" aria-hidden />}>
                  University Verified
                </Badge>
              )}
              {o.mentoring_offered && <Badge tone="success" icon={<Users className="size-3" aria-hidden />}>Mentoring offered</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{o.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-muted-fg">
              <Building2 className="size-4" aria-hidden />
              {o.company.name} · {cap(o.company.industry)} · {o.company.city}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-muted/60 p-4 sm:grid-cols-3">
              <Fact icon={<Wallet className="size-4" />} label="Compensation" value={money(o)} />
              <Fact icon={<Clock className="size-4" />} label="Effort" value={`${o.hours_per_week}h/week · ${o.type === "job" ? "ongoing" : `${o.duration_weeks} weeks`}`} />
              <Fact icon={<MapPin className="size-4" />} label="Work mode" value={`${MODE_LABEL[o.work_mode]}${o.work_mode !== "remote" ? ` · ${o.city}` : ""}`} />
              <Fact icon={<CalendarClock className="size-4" />} label={o.deadline ? "Start → deadline" : "Start"} value={o.deadline ? `${shortDate(o.start_date)} → ${shortDate(o.deadline)}` : shortDate(o.start_date)} />
              <Fact icon={<Target className="size-4" />} label="Difficulty · domain" value={`${DIFFICULTY[o.difficulty]} · ${cap(o.domain) || "-"}`} />
              <Fact icon={<GraduationCap className="size-4" />} label="Academic use" value={o.academic_options.length ? o.academic_options.map((a) => ACADEMIC_LABEL[a]).join(", ") : "-"} />
            </div>

            <h2 className="mt-6 text-lg font-bold">What the company needs</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed">{o.description}</p>

            {o.tasks.length > 0 && (
              <>
                <h2 className="mt-6 text-lg font-bold">Tasks</h2>
                <ol className="mt-2 space-y-2">
                  {o.tasks.map((t, i) => (
                    <li key={t} className="flex gap-3 text-[15px]">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-strong">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {o.expected_outcome && (
              <>
                <h2 className="mt-6 text-lg font-bold">Expected result</h2>
                <p className="mt-2 text-[15px]">{o.expected_outcome}</p>
              </>
            )}

            <h2 className="mt-6 text-lg font-bold">Skills</h2>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {[
                { title: "Required", list: required },
                { title: "Nice to have", list: optional },
              ].map(({ title, list }) => (
                <div key={title}>
                  <p className="mb-2 text-sm font-semibold text-muted-fg">{title}</p>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-fg">-</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {list.map((s) => (
                        <li key={s.skill_id} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">{s.name}</span>
                          <span className="text-muted-fg">{LEVELS[s.min_level]}+</span>
                          {s.learnable && <Badge tone="success">learnable with guidance</Badge>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {o.ai_extraction && o.is_owner && (
              <p className="mt-6 flex items-center gap-2 text-xs text-muted-fg">
                <Bot className="size-4" aria-hidden />
                Requirements extracted by {String((o.ai_extraction as { provider?: string }).provider ?? "AI")} and confirmed by you.
              </p>
            )}
          </article>

          {o.is_owner && <CandidatesPanel o={o} />}

          {o.reviews && o.reviews.length > 0 && (
            <section className="card p-6" aria-labelledby="reviews-title">
              <h2 id="reviews-title" className="mb-3 text-lg font-bold">
                Reviews
              </h2>
              <ul className="space-y-4">
                {o.reviews.map((r) => (
                  <li key={r.id} className="flex gap-3">
                    <Avatar name={r.reviewer.name} size="sm" tone={r.direction === "company_to_student" ? "accent" : "primary"} />
                    <div>
                      <p className="text-sm font-semibold">
                        {r.reviewer.name} <Stars value={r.overall} /> <span className="text-muted-fg">{r.overall.toFixed(1)}</span>
                      </p>
                      <p className="text-xs text-muted-fg">{Object.entries(r.ratings).map(([k, v]) => `${cap(k)} ${v}/5`).join(" · ")}</p>
                      {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {o.is_owner && <OwnerActions o={o} />}
          {user?.role === "student" && <StudentPanel o={o} />}
          {user?.role === "university" && <UniversityPanel o={o} />}
          {!user && (
            <Notice>
              <Link className="link" to="/">
                Choose a student persona
              </Link>{" "}
              to see your match and apply.
            </Notice>
          )}
          {user?.role === "company" && !o.is_owner && <Notice tone="neutral">You are viewing another company's opportunity.</Notice>}
        </aside>
      </div>
    </div>
  );
}
