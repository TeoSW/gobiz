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
import { money, shortDate, useFormat } from "../lib/format";
import { texts, useTexts } from "../lib/i18n";
import { useSession, useSkillName } from "../lib/session";
import type { CandidateCard, Candidates, Opportunity, OppType } from "../lib/types";

const DIMENSIONS = {
  company_to_student: ["quality", "deadline", "communication"],
  student_to_company: ["clarity", "collaboration", "payment"],
} as const;

type Tab = "ai" | "matches" | "applicants" | "invited";

const T = texts(
  {
    dims: {
      quality: "Quality of the result",
      deadline: "Respected the deadline",
      communication: "Communication",
      clarity: "Clarity of requirements",
      collaboration: "Collaboration",
      payment: "Paid as agreed",
    } as Record<string, string>,
    dimShort: { quality: "Quality", deadline: "Deadline", communication: "Communication", clarity: "Clarity", collaboration: "Collaboration", payment: "Payment" } as Record<string, string>,
    review: (name: string) => `Review ${name}`,
    comment: "Comment (public on the profile)",
    reviewNotice: "After your review, the project is finished and goes into the student's portfolio.",
    cancel: "Cancel",
    submitReview: "Submit review",
    matched: "Matched",
    invited: "Invited",
    appliedLabel: "Applied",
    toClarify: "To clarify",
    year: (n: number) => `year ${n}`,
    invite: "Invite",
    select: "Select",
    message: "Message",
    hideDetails: "Hide details",
    why: "Why?",
    candidates: "Candidates",
    searchAll: "Search all students",
    candidateLists: "Candidate lists",
    tabs: { ai: "Suggested", matches: "Matches", applicants: "Applicants", invited: "Invited" } as Record<Tab, string>,
    allStudents: (n: number | string) => `All ${n} students, best fits first. Students who clearly do not fit are left out.`,
    emptyTitle: { ai: "No compatible students yet", matches: "No matches yet", applicants: "No applications yet", invited: "No invitations yet" } as Record<Tab, string>,
    emptyText: {
      ai: "Try making some skills optional or learnable.",
      matches: "Swipe right on students on the Match page.",
      applicants: "You can invite students from the Suggested tab.",
      invited: "You can invite students from the Suggested tab.",
    } as Record<Tab, string>,
    manage: "Manage",
    selectedStudent: "Selected student:",
    confirmPayment: "Confirm payment",
    requestChanges: "Request changes",
    reviewComplete: "Review student & complete",
    close: "Close opportunity",
    requestVerification: "Request University verification",
    verificationPending: "Verification pending",
    waitingDelivery: "Waiting for the student to mark the work as delivered.",
    yourCollaboration: "Your collaboration",
    markDelivered: "Mark work as delivered",
    itsAMatch: "It's a match!",
    youWereInvited: "You were invited",
    youApplied: "You applied",
    matchText: "You and the company both said yes. Send them a message.",
    status: "Status:",
    acceptInvitation: "Accept invitation",
    decline: "Decline",
    withdraw: "Withdraw application",
    interested: "Interested?",
    applyAnyway: "You can apply even if it was not suggested to you.",
    applyTo: { project: "Apply to this project", internship: "Apply to this internship", job: "Apply to this job" } as Record<OppType, string>,
    closedForApps: "This opportunity is no longer accepting applications.",
    askProfessor: "Ask a professor for help",
    mentorship: "Mentorship:",
    mentorStatus: { pending: "pending", accepted: "accepted", declined: "declined" } as Record<string, string>,
    withMentor: (name: string) => ` with ${name}`,
    howWellYouFit: "How well you fit",
    messagesWith: (name: string) => `Messages with ${name}`,
    applyTitle: (title: string) => `Apply: ${title}`,
    scoreShared: "Your match score is shared with the company.",
    shortMessage: (name: string) => `Short message to ${name}`,
    applyPlaceholder: "Why are you a good fit? Link relevant work.",
    sendApplication: "Send application",
    requestMentorship: "Request mentorship",
    mentorIntro: "A professor can guide you on a harder project, or help you use it for a course or your thesis.",
    helpWith: "What would you like help with?",
    sendRequest: "Send request",
    universityValidation: "University validation",
    verifiedBy: (name: string | null) => `Verified${name ? ` by ${name}` : ""}. Suitable as an applied project for students.`,
    companyAsked: "The company asked for University Verified status.",
    youCanVerify: "You can mark this opportunity as University Verified.",
    verify: "Verify",
    reject: "Reject",
    backTo: { project: "Back to projects", internship: "Back to internships", job: "Back to jobs" } as Record<OppType, string>,
    universityVerified: "University Verified",
    mentoringOffered: "Mentoring offered",
    compensation: "Compensation",
    effort: "Effort",
    ongoing: "ongoing",
    workMode: "Work mode",
    startDeadline: "Start → deadline",
    start: "Start",
    difficultyDomain: "Difficulty · domain",
    academicUse: "Academic use",
    needs: "What the company needs",
    tasks: "Tasks",
    expected: "Expected result",
    skills: "Skills",
    required: "Required",
    nice: "Nice to have",
    learnable: "learnable with guidance",
    extractedBy: (p: string) => `Requirements extracted by ${p} and confirmed by you.`,
    reviews: "Reviews",
    logInStudent: "Log in as a student",
    toSeeMatch: " to see your match and apply.",
    otherCompany: "You are viewing another company's opportunity.",
  },
  {
    dims: {
      quality: "Calitatea rezultatului",
      deadline: "A respectat termenul",
      communication: "Comunicare",
      clarity: "Claritatea cerințelor",
      collaboration: "Colaborare",
      payment: "A plătit cum s-a stabilit",
    },
    dimShort: { quality: "Calitate", deadline: "Termen", communication: "Comunicare", clarity: "Claritate", collaboration: "Colaborare", payment: "Plată" },
    review: (name) => `Evaluează-l pe ${name}`,
    comment: "Comentariu (public pe profil)",
    reviewNotice: "După recenzia ta, proiectul se încheie și intră în portofoliul studentului.",
    cancel: "Renunță",
    submitReview: "Trimite recenzia",
    matched: "Match",
    invited: "Invitat",
    appliedLabel: "A aplicat",
    toClarify: "De clarificat",
    year: (n) => `anul ${n}`,
    invite: "Invită",
    select: "Selectează",
    message: "Mesaj",
    hideDetails: "Ascunde detaliile",
    why: "De ce?",
    candidates: "Candidați",
    searchAll: "Caută printre toți studenții",
    candidateLists: "Liste de candidați",
    tabs: { ai: "Sugerați", matches: "Match-uri", applicants: "Au aplicat", invited: "Invitați" },
    allStudents: (n) => `Toți cei ${n} studenți, cei mai potriviți primii. Cei care clar nu se potrivesc nu apar.`,
    emptyTitle: { ai: "Încă niciun student compatibil", matches: "Încă niciun match", applicants: "Încă nicio aplicare", invited: "Încă nicio invitație" },
    emptyText: {
      ai: "Încearcă să faci unele abilități opționale sau „se poate învăța”.",
      matches: "Dă swipe la dreapta pe studenți în pagina Match.",
      applicants: "Poți invita studenți din fila Sugerați.",
      invited: "Poți invita studenți din fila Sugerați.",
    },
    manage: "Administrează",
    selectedStudent: "Student selectat:",
    confirmPayment: "Confirmă plata",
    requestChanges: "Cere modificări",
    reviewComplete: "Evaluează studentul și încheie",
    close: "Închide oportunitatea",
    requestVerification: "Cere validarea universității",
    verificationPending: "Validare în așteptare",
    waitingDelivery: "Se așteaptă ca studentul să marcheze lucrarea ca predată.",
    yourCollaboration: "Colaborarea ta",
    markDelivered: "Marchează lucrarea ca predată",
    itsAMatch: "E match!",
    youWereInvited: "Ai fost invitat",
    youApplied: "Ai aplicat",
    matchText: "Tu și firma ați spus amândoi da. Trimite-le un mesaj.",
    status: "Stare:",
    acceptInvitation: "Acceptă invitația",
    decline: "Refuză",
    withdraw: "Retrage aplicarea",
    interested: "Te interesează?",
    applyAnyway: "Poți aplica chiar dacă nu ți-a fost sugerat.",
    applyTo: { project: "Aplică la acest proiect", internship: "Aplică la acest stagiu", job: "Aplică la acest job" },
    closedForApps: "Oportunitatea nu mai primește aplicări.",
    askProfessor: "Cere ajutorul unui profesor",
    mentorship: "Îndrumare:",
    mentorStatus: { pending: "în așteptare", accepted: "acceptată", declined: "refuzată" },
    withMentor: (name) => ` cu ${name}`,
    howWellYouFit: "Cât de bine te potrivești",
    messagesWith: (name) => `Mesaje cu ${name}`,
    applyTitle: (title) => `Aplică: ${title}`,
    scoreShared: "Scorul tău de potrivire este trimis firmei.",
    shortMessage: (name) => `Mesaj scurt pentru ${name}`,
    applyPlaceholder: "De ce te potrivești? Pune un link la lucrări relevante.",
    sendApplication: "Trimite aplicarea",
    requestMentorship: "Cere îndrumare",
    mentorIntro: "Un profesor te poate ghida pe un proiect mai greu sau te poate ajuta să-l folosești la o materie ori la licență.",
    helpWith: "La ce ai vrea ajutor?",
    sendRequest: "Trimite cererea",
    universityValidation: "Validarea universității",
    verifiedBy: (name) => `Validat${name ? ` de ${name}` : ""}. Potrivit ca proiect aplicat pentru studenți.`,
    companyAsked: "Firma a cerut statutul „Validat de universitate”.",
    youCanVerify: "Poți marca această oportunitate ca „Validat de universitate”.",
    verify: "Validează",
    reject: "Respinge",
    backTo: { project: "Înapoi la proiecte", internship: "Înapoi la stagii", job: "Înapoi la joburi" },
    universityVerified: "Validat de universitate",
    mentoringOffered: "Oferă mentorat",
    compensation: "Plată",
    effort: "Efort",
    ongoing: "pe termen lung",
    workMode: "Mod de lucru",
    startDeadline: "Început → termen",
    start: "Început",
    difficultyDomain: "Dificultate · domeniu",
    academicUse: "Utilizare academică",
    needs: "De ce are nevoie firma",
    tasks: "Sarcini",
    expected: "Rezultat așteptat",
    skills: "Abilități",
    required: "Obligatorii",
    nice: "Ar fi utile",
    learnable: "se poate învăța cu îndrumare",
    extractedBy: (p) => `Cerințe extrase de ${p} și confirmate de tine.`,
    reviews: "Recenzii",
    logInStudent: "Intră ca student",
    toSeeMatch: " ca să-ți vezi potrivirea și să aplici.",
    otherCompany: "Te uiți la oportunitatea altei firme.",
  },
);

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
  const t = useTexts(T);
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
    <Modal open={open} onClose={onClose} title={t.review(direction === "company_to_student" ? (o.selected_student?.name ?? "") : o.company.name)}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        {dims.map((k) => (
          <div key={k} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{t.dims[k]}</span>
            <StarInput label={t.dims[k]} value={ratings[k] ?? 0} onChange={(v) => setRatings((r) => ({ ...r, [k]: v }))} />
          </div>
        ))}
        <div>
          <label className="label" htmlFor="review-comment">
            {t.comment}
          </label>
          <textarea id="review-comment" className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        {direction === "company_to_student" && <Notice>{t.reviewNotice}</Notice>}
        <ErrorBox error={m.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="btn-primary" disabled={dims.some((k) => !ratings[k]) || m.isPending}>
            {t.submitReview}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CandidateRow({ c, o, onChanged }: { c: CandidateCard; o: Opportunity; onChanged: () => void }) {
  const t = useTexts(T);
  const f = useFormat();
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
                {a.kind === "match" ? t.matched : `${a.kind === "invitation" ? t.invited : t.appliedLabel} · ${f.appStatus[a.status] ?? a.status}`}
              </Badge>
            )}
            {c.match.status === "to_clarify" && <Badge tone="warning">{t.toClarify}</Badge>}
          </div>
          <p className="text-xs text-muted-fg">
            {c.student.headline} · {c.student.university}, {t.year(c.student.year)}
          </p>
          <p className="mt-1 text-sm text-muted-fg">{c.match.summary}</p>
          {a?.message && <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-sm italic">"{a.message}"</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {!a && o.status === "open" && (
              <button className="btn-outline min-h-9 px-3" onClick={() => invite.mutate()} disabled={invite.isPending}>
                <UserPlus className="size-4" aria-hidden /> {t.invite}
              </button>
            )}
            {canSelect && (
              <button className="btn-primary min-h-9 px-3" onClick={() => select.mutate()} disabled={select.isPending}>
                <CheckCircle2 className="size-4" aria-hidden /> {t.select}
              </button>
            )}
            {a && (
              <button className="btn-ghost min-h-9 px-3" onClick={() => setChat((v) => !v)} aria-expanded={chat}>
                <MessageSquare className="size-4" aria-hidden /> {t.message}
              </button>
            )}
            <button className="btn-ghost min-h-9 px-3" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
              <Sparkles className="size-4" aria-hidden /> {expanded ? t.hideDetails : t.why}
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
  const t = useTexts(T);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("ai");
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
          {t.candidates}
        </h2>
        <Link to={`/talent?opportunity=${o.id}`} className="link text-sm">
          {t.searchAll}
        </Link>
      </div>
      <Tabs
        label={t.candidateLists}
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: "ai",
            label: (
              <>
                <Sparkles className="size-4" aria-hidden /> {t.tabs.ai}
              </>
            ),
            count: cands.data?.ai_matches.length,
          },
          { id: "matches", label: t.tabs.matches, count: cands.data?.matches.length },
          { id: "applicants", label: t.tabs.applicants, count: cands.data?.applicants.length },
          { id: "invited", label: t.tabs.invited, count: cands.data?.invited.length },
        ]}
      />
      {tab === "ai" && <p className="mt-3 text-sm text-muted-fg">{t.allStudents(cands.data?.all_count ?? "")}</p>}
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
        <Empty title={t.emptyTitle[tab]}>{t.emptyText[tab]}</Empty>
      )}
    </section>
  );
}

function OwnerActions({ o }: { o: Opportunity }) {
  const t = useTexts(T);
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
      <h2 className="text-lg font-bold">{t.manage}</h2>
      <Pipeline status={o.status} />
      {o.selected_student && (
        <p className="text-sm">
          {t.selectedStudent}{" "}
          <Link className="link" to={`/students/${o.selected_student.id}`}>
            {o.selected_student.name}
          </Link>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {o.status === "delivered" && (
          <>
            <button className="btn-primary" onClick={() => status.mutate("paid")}>
              <Wallet className="size-4" aria-hidden /> {t.confirmPayment}
            </button>
            <button className="btn-outline" onClick={() => status.mutate("in_progress")}>
              {t.requestChanges}
            </button>
          </>
        )}
        {o.status === "paid" && !reviewed && (
          <button className="btn-accent" onClick={() => setReview(true)}>
            <Star className="size-4" aria-hidden /> {t.reviewComplete}
          </button>
        )}
        {o.status === "open" && (
          <button className="btn-danger" onClick={() => status.mutate("closed")}>
            {t.close}
          </button>
        )}
        {!o.university_verified && !o.verification_requested && (
          <button className="btn-outline" onClick={() => verify.mutate()}>
            <ShieldCheck className="size-4" aria-hidden /> {t.requestVerification}
          </button>
        )}
        {o.verification_requested && !o.university_verified && <Badge tone="warning">{t.verificationPending}</Badge>}
      </div>
      {o.status === "in_progress" && <p className="text-sm text-muted-fg">{t.waitingDelivery}</p>}
      <ErrorBox error={status.error || verify.error} />
      <ReviewDialog o={o} direction="company_to_student" open={review} onClose={() => setReview(false)} />
    </div>
  );
}

function StudentPanel({ o }: { o: Opportunity }) {
  const t = useTexts(T);
  const f = useFormat();
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
            <h2 className="text-lg font-bold">{t.yourCollaboration}</h2>
            <Pipeline status={o.status} />
            {o.status === "in_progress" && (
              <button className="btn-primary w-full" onClick={() => deliver.mutate()} disabled={deliver.isPending}>
                <Send className="size-4" aria-hidden /> {t.markDelivered}
              </button>
            )}
            {(o.status === "paid" || o.status === "completed") && !reviewed && (
              <button className="btn-accent w-full" onClick={() => setReview(true)}>
                <Star className="size-4" aria-hidden /> {t.review(o.company.name)}
              </button>
            )}
          </>
        ) : app ? (
          <>
            <h2 className="text-lg font-bold">{app.kind === "match" ? t.itsAMatch : app.kind === "invitation" ? t.youWereInvited : t.youApplied}</h2>
            <p className="text-sm text-muted-fg">
              {app.kind === "match" ? (
                t.matchText
              ) : (
                <>
                  {t.status} <span className="font-semibold text-fg">{f.appStatus[app.status] ?? app.status}</span>
                </>
              )}{" "}
              · {shortDate(app.created_at)}
            </p>
            {app.kind === "invitation" && app.status === "pending" && (
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={() => respond.mutate("accept")}>
                  {t.acceptInvitation}
                </button>
                <button className="btn-outline flex-1" onClick={() => respond.mutate("decline")}>
                  {t.decline}
                </button>
              </div>
            )}
            {app.status === "pending" && app.kind === "application" && (
              <button className="btn-ghost w-full" onClick={() => respond.mutate("withdraw")}>
                {t.withdraw}
              </button>
            )}
          </>
        ) : o.status === "open" ? (
          <>
            <h2 className="text-lg font-bold">{t.interested}</h2>
            <p className="text-muted-fg">{t.applyAnyway}</p>
            <button className="btn-accent w-full" onClick={() => setApplyOpen(true)}>
              <Send className="size-4" aria-hidden /> {t.applyTo[o.type]}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-fg">{t.closedForApps}</p>
        )}
        {!o.my_mentorship ? (
          <button className="btn-outline w-full" onClick={() => setMentorOpen(true)}>
            <HandHelping className="size-4" aria-hidden /> {t.askProfessor}
          </button>
        ) : (
          <p className="text-sm text-muted-fg">
            {t.mentorship} <span className="font-semibold text-fg">{t.mentorStatus[o.my_mentorship.status] ?? o.my_mentorship.status}</span>
            {o.my_mentorship.mentor ? t.withMentor(o.my_mentorship.mentor.name) : ""}
          </p>
        )}
        <ErrorBox error={apply.error || respond.error || mentor.error || deliver.error} />
      </div>

      {o.match && (
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="size-5 text-primary-strong" aria-hidden /> {t.howWellYouFit}
          </h2>
          <MatchBreakdown match={o.match} skillName={skillName} />
        </div>
      )}

      {(app || selected) && (
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold">{t.messagesWith(o.company.name)}</h2>
          <Chat opportunityId={o.id} withUser={o.company.id} withName={o.company.name} />
        </div>
      )}

      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title={t.applyTitle(o.title)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply.mutate();
          }}
        >
          {o.match && (
            <div className="flex items-center gap-2 text-sm">
              <MatchPill match={o.match} /> <span className="text-muted-fg">{t.scoreShared}</span>
            </div>
          )}
          <div>
            <label className="label" htmlFor="apply-msg">
              {t.shortMessage(o.company.name)}
            </label>
            <textarea id="apply-msg" className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.applyPlaceholder} />
          </div>
          <ErrorBox error={apply.error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setApplyOpen(false)}>
              {t.cancel}
            </button>
            <button className="btn-primary" disabled={apply.isPending}>
              {t.sendApplication}
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={mentorOpen} onClose={() => setMentorOpen(false)} title={t.requestMentorship}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mentor.mutate();
          }}
        >
          <p className="text-muted-fg">{t.mentorIntro}</p>
          <div>
            <label className="label" htmlFor="mentor-note">
              {t.helpWith}
            </label>
            <textarea id="mentor-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setMentorOpen(false)}>
              {t.cancel}
            </button>
            <button className="btn-primary" disabled={mentor.isPending}>
              {t.sendRequest}
            </button>
          </div>
        </form>
      </Modal>
      <ReviewDialog o={o} direction="student_to_company" open={review} onClose={() => setReview(false)} />
    </div>
  );
}

function UniversityPanel({ o }: { o: Opportunity }) {
  const t = useTexts(T);
  const qc = useQueryClient();
  const verify = useMutation({
    mutationFn: (approve: boolean) => post(`/university/opportunities/${o.id}/verify`, { approve }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <div className="card space-y-3 p-5">
      <h2 className="text-lg font-bold">{t.universityValidation}</h2>
      {o.university_verified ? (
        <Notice tone="success">{t.verifiedBy(o.verified_by?.name ?? null)}</Notice>
      ) : (
        <>
          <p className="text-sm text-muted-fg">{o.verification_requested ? t.companyAsked : t.youCanVerify}</p>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={() => verify.mutate(true)}>
              <BadgeCheck className="size-4" aria-hidden /> {t.verify}
            </button>
            {o.verification_requested && (
              <button className="btn-outline flex-1" onClick={() => verify.mutate(false)}>
                {t.reject}
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
  const t = useTexts(T);
  const f = useFormat();
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
        <ArrowLeft className="size-4" aria-hidden /> {t.backTo[o.type]}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <article className="card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={o.type} />
              <StatusBadge status={o.status} />
              {o.university_verified && (
                <Badge tone="primary" icon={<BadgeCheck className="size-3" aria-hidden />}>
                  {t.universityVerified}
                </Badge>
              )}
              {o.mentoring_offered && (
                <Badge tone="success" icon={<Users className="size-3" aria-hidden />}>
                  {t.mentoringOffered}
                </Badge>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{o.title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-muted-fg">
              <Building2 className="size-4" aria-hidden />
              {o.company.name} · {f.domain(o.company.industry)} · {o.company.city}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-muted/60 p-4 sm:grid-cols-3">
              <Fact icon={<Wallet className="size-4" />} label={t.compensation} value={money(o)} />
              <Fact icon={<Clock className="size-4" />} label={t.effort} value={`${f.hoursWeek(o.hours_per_week)} · ${o.type === "job" ? t.ongoing : f.weeks(o.duration_weeks)}`} />
              <Fact icon={<MapPin className="size-4" />} label={t.workMode} value={`${f.modes[o.work_mode]}${o.work_mode !== "remote" ? ` · ${o.city}` : ""}`} />
              <Fact icon={<CalendarClock className="size-4" />} label={o.deadline ? t.startDeadline : t.start} value={o.deadline ? `${shortDate(o.start_date)} → ${shortDate(o.deadline)}` : shortDate(o.start_date)} />
              <Fact icon={<Target className="size-4" />} label={t.difficultyDomain} value={`${f.difficulty[o.difficulty]} · ${f.domain(o.domain) || "-"}`} />
              <Fact icon={<GraduationCap className="size-4" />} label={t.academicUse} value={o.academic_options.length ? o.academic_options.map((a) => f.academic[a]).join(", ") : "-"} />
            </div>

            <h2 className="mt-6 text-lg font-bold">{t.needs}</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line leading-relaxed">{o.description}</p>

            {o.tasks.length > 0 && (
              <>
                <h2 className="mt-6 text-lg font-bold">{t.tasks}</h2>
                <ol className="mt-2 space-y-2">
                  {o.tasks.map((task, i) => (
                    <li key={task} className="flex gap-3 text-[15px]">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-strong">{i + 1}</span>
                      {task}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {o.expected_outcome && (
              <>
                <h2 className="mt-6 text-lg font-bold">{t.expected}</h2>
                <p className="mt-2 text-[15px]">{o.expected_outcome}</p>
              </>
            )}

            <h2 className="mt-6 text-lg font-bold">{t.skills}</h2>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {[
                { title: t.required, list: required },
                { title: t.nice, list: optional },
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
                          <span className="text-muted-fg">{f.levels[s.min_level]}+</span>
                          {s.learnable && <Badge tone="success">{t.learnable}</Badge>}
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
                {t.extractedBy(String((o.ai_extraction as { provider?: string }).provider ?? "AI"))}
              </p>
            )}
          </article>

          {o.is_owner && <CandidatesPanel o={o} />}

          {o.reviews && o.reviews.length > 0 && (
            <section className="card p-6" aria-labelledby="reviews-title">
              <h2 id="reviews-title" className="mb-3 text-lg font-bold">
                {t.reviews}
              </h2>
              <ul className="space-y-4">
                {o.reviews.map((r) => (
                  <li key={r.id} className="flex gap-3">
                    <Avatar name={r.reviewer.name} size="sm" tone={r.direction === "company_to_student" ? "accent" : "primary"} />
                    <div>
                      <p className="text-sm font-semibold">
                        {r.reviewer.name} <Stars value={r.overall} /> <span className="text-muted-fg">{r.overall.toFixed(1)}</span>
                      </p>
                      <p className="text-xs text-muted-fg">{Object.entries(r.ratings).map(([k, v]) => `${t.dimShort[k] ?? k} ${v}/5`).join(" · ")}</p>
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
              <Link className="link" to="/login?as=student">
                {t.logInStudent}
              </Link>
              {t.toSeeMatch}
            </Notice>
          )}
          {user?.role === "company" && !o.is_owner && <Notice tone="neutral">{t.otherCompany}</Notice>}
        </aside>
      </div>
    </div>
  );
}
