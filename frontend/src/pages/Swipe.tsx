import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Briefcase, CalendarDays, Check, Clock, GraduationCap, Heart, MapPin, MessageSquare, Send, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogoMark, useSlogan } from "../components/Logo";
import { fitLabel, MatchRing } from "../components/Match";
import { TypeBadge } from "../components/OpportunityCard";
import { SwipeDeck, type Direction } from "../components/SwipeDeck";
import { Avatar, Badge, Empty, ErrorBox, Skeleton, Stars } from "../components/ui";
import { api, post } from "../lib/api";
import { money, useFormat } from "../lib/format";
import { roPlural, texts, useTexts } from "../lib/i18n";
import { useSession } from "../lib/session";
import type { CompanyDeckCard, MatchItem, Opportunity, Role, StudentDeckCard, SwipeResult } from "../lib/types";

const T = texts(
  {
    skillsNeeded: "Skills needed",
    youHaveIt: "you have it",
    canLearn: " (can learn)",
    at: (title: string, company: string) => `${title} at ${company}`,
    forOpp: (name: string, title: string) => `${name} for ${title}`,
    invitedYou: "They invited you",
    ongoing: "Ongoing",
    seeDetails: "See all details",
    for: "For",
    year: (n: number) => `year ${n}`,
    applied: "Applied",
    freeHours: (n: number) => `${n} h / week free`,
    finished: (n: number) => `${n} finished project${n === 1 ? "" : "s"}`,
    noReviews: "No reviews yet",
    topSkills: "Top skills",
    seeProfile: "See full profile",
    helloStudent: (title: string) => `Hi! I'd love to work on "${title}". When can we talk?`,
    helloCompany: (name: string, title: string) => `Hi ${name}! We'd love to have you on "${title}". When can we talk?`,
    itsAMatch: "It's a match!",
    bothSaidYes: (other: string, title: string): ReactNode => (
      <>
        You and <strong>{other}</strong> both said yes to <strong>"{title}"</strong>.
      </>
    ),
    sayHello: (name: string) => `Say hello to ${name}`,
    send: "Send message",
    keepSwiping: "Keep swiping",
    yourMatches: "Your matches",
    noMatches: "No matches yet. When both sides swipe right, they show up here.",
    messageTo: (name: string) => `Message ${name}`,
    howTitle: "How it works",
    howStudent: ["Swipe right on work you want to do.", "Swipe left to skip it.", "Companies only see your yes if they said yes too.", "An invitation from a company already counts as their yes."],
    howCompany: ["Swipe right on students you want to work with.", "Swipe left to skip.", "Students only see your yes if they said yes too.", "A student who applied already said yes."],
    saidMatch: (name: string) => `It's a match with ${name}!`,
    saidBack: (name: string) => `${name} is back.`,
    saidYes: (name: string) => `You said yes to ${name}.`,
    saidPass: (name: string) => `You passed on ${name}.`,
    likeStudent: "I'm interested",
    likeCompany: "Interested in this student",
    seenAll: "You have seen everything for now",
    seeAllOpps: "See all opportunities",
    seenAllText: "New projects, internships and jobs that fit you will show up here.",
    studentsFor: "Students for",
    allOpen: "All my open opportunities",
    noMoreStudents: "No more students for now",
    searchStudents: "Search all students",
    noMoreStudentsText: "Students who fit your open opportunities show up here.",
    title: "Match",
    subStudent: "Swipe right on work you want. If the company says yes too, it's a match.",
    subCompany: "Swipe right on students you want. If they say yes too, it's a match.",
  },
  {
    skillsNeeded: "Abilități cerute",
    youHaveIt: "o ai",
    canLearn: " (poți învăța)",
    at: (title, company) => `${title} la ${company}`,
    forOpp: (name, title) => `${name} pentru ${title}`,
    invitedYou: "Te-au invitat",
    ongoing: "Pe termen lung",
    seeDetails: "Vezi toate detaliile",
    for: "Pentru",
    year: (n) => `anul ${n}`,
    applied: "A aplicat",
    freeHours: (n) => `${n} h libere / săptămână`,
    finished: (n) => roPlural(n, "proiect terminat", "proiecte terminate"),
    noReviews: "Încă fără recenzii",
    topSkills: "Abilități principale",
    seeProfile: "Vezi tot profilul",
    helloStudent: (title) => `Bună! Mi-ar plăcea să lucrez la „${title}”. Când putem vorbi?`,
    helloCompany: (name, title) => `Bună, ${name}! Ne-ar plăcea să lucrezi cu noi la „${title}”. Când putem vorbi?`,
    itsAMatch: "E match!",
    bothSaidYes: (other, title) => (
      <>
        Tu și <strong>{other}</strong> ați spus amândoi da pentru <strong>„{title}”</strong>.
      </>
    ),
    sayHello: (name) => `Salută-l pe ${name}`,
    send: "Trimite mesajul",
    keepSwiping: "Continuă swipe-ul",
    yourMatches: "Match-urile tale",
    noMatches: "Încă niciun match. Când ambele părți dau swipe la dreapta, apar aici.",
    messageTo: (name) => `Scrie-i lui ${name}`,
    howTitle: "Cum funcționează",
    howStudent: ["Swipe la dreapta pe ce vrei să faci.", "Swipe la stânga ca să treci peste.", "Firmele îți văd „da”-ul doar dacă au spus și ele da.", "O invitație de la o firmă contează deja ca „da” din partea ei."],
    howCompany: ["Swipe la dreapta pe studenții cu care vrei să lucrezi.", "Swipe la stânga ca să treci peste.", "Studenții îți văd „da”-ul doar dacă au spus și ei da.", "Un student care a aplicat a spus deja da."],
    saidMatch: (name) => `E match cu ${name}!`,
    saidBack: (name) => `${name} a revenit.`,
    saidYes: (name) => `Ai spus da pentru ${name}.`,
    saidPass: (name) => `Ai trecut peste ${name}.`,
    likeStudent: "Mă interesează",
    likeCompany: "Ne interesează studentul",
    seenAll: "Deocamdată ai văzut tot",
    seeAllOpps: "Vezi toate oportunitățile",
    seenAllText: "Proiectele, stagiile și joburile noi care ți se potrivesc vor apărea aici.",
    studentsFor: "Studenți pentru",
    allOpen: "Toate oportunitățile mele deschise",
    noMoreStudents: "Deocamdată nu mai sunt studenți",
    searchStudents: "Caută printre toți studenții",
    noMoreStudentsText: "Aici apar studenții care se potrivesc cu oportunitățile tale deschise.",
    title: "Match",
    subStudent: "Swipe la dreapta pe ce vrei să faci. Dacă și firma spune da, e match.",
    subCompany: "Swipe la dreapta pe studenții pe care îi vrei. Dacă și ei spun da, e match.",
  },
);

// ---------------------------------------------------------------- cards
function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-fg">{icon}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function FitBlock({ match }: { match: StudentDeckCard["match"] }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-muted/60 p-3">
      <MatchRing match={match} size={56} />
      <div className="min-w-0">
        <p className="text-lg font-bold">{fitLabel(match)}</p>
        <p className="text-sm text-muted-fg">{match.summary}</p>
      </div>
    </div>
  );
}

function SkillChips({ match }: { match: StudentDeckCard["match"] }) {
  const t = useTexts(T);
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={t.skillsNeeded}>
      {match.skills.slice(0, 5).map((r) => {
        const ok = r.status === "met" || r.status === "learnable";
        return (
          <span key={r.skill_id} className={clsx("chip", ok && "border-transparent bg-success-soft text-success")}>
            {ok && <Check className="size-3.5" aria-label={t.youHaveIt} />}
            {r.name}
            {r.status === "learnable" && t.canLearn}
          </span>
        );
      })}
    </div>
  );
}

function OpportunitySwipeCard({ o }: { o: StudentDeckCard }) {
  const t = useTexts(T);
  const f = useFormat();
  return (
    <article className="card flex h-full flex-col overflow-hidden select-none" aria-label={t.at(o.title, o.company.name)}>
      <header className="flex items-center gap-3 border-b border-border bg-primary-soft/60 px-5 py-3">
        <Avatar name={o.company.name} tone="accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{o.company.name}</p>
          <p className="truncate text-sm text-muted-fg">
            {f.domain(o.company.industry)} · {o.company.city}
          </p>
        </div>
        <TypeBadge type={o.type} />
      </header>
      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <div>
          {o.invited && <Badge tone="accent" className="mb-1.5">{t.invitedYou}</Badge>}
          <h2 className="text-2xl leading-tight font-extrabold">{o.title}</h2>
        </div>
        <FitBlock match={o.match} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <Fact icon={<Wallet className="size-4" aria-hidden />}>{money(o)}</Fact>
          <Fact icon={<Clock className="size-4" aria-hidden />}>{f.hoursWeek(o.hours_per_week)}</Fact>
          <Fact icon={<CalendarDays className="size-4" aria-hidden />}>
            {o.type === "job" ? t.ongoing : f.weeks(o.duration_weeks)}
          </Fact>
          <Fact icon={<MapPin className="size-4" aria-hidden />}>
            {f.modes[o.work_mode]}
            {o.work_mode !== "remote" && o.city ? ` · ${o.city}` : ""}
          </Fact>
        </div>
        <SkillChips match={o.match} />
        <p className="line-clamp-2 text-muted-fg">{o.description}</p>
        <Link to={`/opportunities/${o.id}`} className="link mt-auto self-start text-sm">
          {t.seeDetails}
        </Link>
      </div>
    </article>
  );
}

function StudentSwipeCard({ c }: { c: CompanyDeckCard }) {
  const t = useTexts(T);
  const f = useFormat();
  const s = c.student;
  return (
    <article className="card flex h-full flex-col overflow-hidden select-none" aria-label={t.forOpp(s.name, c.opportunity.title)}>
      <header className="flex items-center gap-2 border-b border-border bg-primary-soft/60 px-5 py-3 text-sm">
        <Briefcase className="size-4 shrink-0 text-primary-strong" aria-hidden />
        <span className="text-muted-fg">{t.for}</span>
        <span className="truncate font-semibold">{c.opportunity.title}</span>
      </header>
      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={s.name} size="lg" />
          <div className="min-w-0">
            <h2 className="text-2xl leading-tight font-extrabold">{s.name}</h2>
            <p className="text-muted-fg">{s.headline}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted-fg">
              <GraduationCap className="size-4 shrink-0" aria-hidden />
              <span className="truncate">
                {s.university} · {t.year(s.year)}
              </span>
            </p>
          </div>
        </div>
        {c.applied && (
          <p className="flex items-center gap-2 rounded-xl bg-accent-soft/60 px-3 py-2 text-sm">
            <Badge tone="accent">{t.applied}</Badge>
            {c.application_message && <span className="min-w-0 truncate italic">"{c.application_message}"</span>}
          </p>
        )}
        <FitBlock match={c.match} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Fact icon={<Clock className="size-4" aria-hidden />}>{t.freeHours(s.hours_per_week)}</Fact>
          <Fact icon={<MapPin className="size-4" aria-hidden />}>{f.modes[s.work_mode] ?? s.work_mode} · {s.city}</Fact>
          <Fact icon={<Briefcase className="size-4" aria-hidden />}>
            {t.finished(s.completed_projects)}
          </Fact>
          <div className="flex items-center gap-2 text-sm">{s.rating ? <Stars value={s.rating} /> : <span className="text-muted-fg">{t.noReviews}</span>}</div>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label={t.topSkills}>
          {s.top_skills.slice(0, 4).map((k) => (
            <span key={k.skill_id} className="chip">
              {k.name} · {f.levels[k.level]}
            </span>
          ))}
        </div>
        <p className="line-clamp-2 text-muted-fg">{s.bio}</p>
        <Link to={`/students/${s.id}`} className="link mt-auto self-start text-sm">
          {t.seeProfile}
        </Link>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- "It's a match!"
const BURST = ["var(--logo-light)", "var(--accent)", "var(--success)", "var(--logo-blue)"];

function MatchDialog({ match, role, onClose }: { match: MatchItem; role: Role; onClose: () => void }) {
  const t = useTexts(T);
  const slogan = useSlogan();
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const other = role === "student" ? match.company : match.student;
  const [text, setText] = useState(
    role === "student"
      ? t.helloStudent(match.opportunity.title)
      : t.helloCompany(match.student.name.split(" ")[0], match.opportunity.title),
  );
  const chat = `/messages?o=${match.opportunity.id}&u=${other.id}`;
  const send = useMutation({
    mutationFn: () => post("/messages", { opportunity_id: match.opportunity.id, recipient_id: other.id, body: text.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate(chat);
    },
  });
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="match-title"
      className="m-auto w-[min(480px,calc(100vw-32px))] overflow-visible rounded-3xl border border-border bg-card p-0 text-fg shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
    >
      <div className="animate-pop relative px-6 pt-8 pb-6 text-center">
        <div className="relative mx-auto size-24">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="animate-burst absolute top-1/2 left-1/2 -mt-1.5 -ml-1.5 size-3 rounded-full"
              style={{ ["--a" as string]: `${(360 / 14) * i}deg`, background: BURST[i % BURST.length], animationDelay: `${120 + (i % 3) * 60}ms` }}
            />
          ))}
          <LogoMark className="animate-sync relative size-24" />
        </div>
        <h2 id="match-title" className="mt-4 text-4xl font-black tracking-tight text-primary-strong">
          {t.itsAMatch}
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted-fg">{slogan}</p>
        <div className="mt-5 flex items-center justify-center">
          <span className="rounded-full ring-4 ring-card">
            <Avatar name={match.student.name} size="lg" />
          </span>
          <span className="z-10 -mx-3 inline-flex size-10 items-center justify-center rounded-full bg-success text-success-fg ring-4 ring-card">
            <Heart className="size-5 fill-current" aria-hidden />
          </span>
          <span className="rounded-full ring-4 ring-card">
            <Avatar name={match.company.name} size="lg" tone="accent" />
          </span>
        </div>
        <p className="mt-4">{t.bothSaidYes(other.name, match.opportunity.title)}</p>
        <form
          className="mt-5 space-y-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send.mutate();
          }}
        >
          <label htmlFor="match-msg" className="label">
            {t.sayHello(other.name)}
          </label>
          <textarea id="match-msg" className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
          <ErrorBox error={send.error} />
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button className="btn-primary flex-1" disabled={!text.trim() || send.isPending}>
              <Send className="size-4" aria-hidden /> {t.send}
            </button>
            <button type="button" className="btn-outline flex-1" onClick={() => ref.current?.close()}>
              {t.keepSwiping}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------- page
function MatchesPanel({ role }: { role: Role }) {
  const t = useTexts(T);
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => api<MatchItem[]>("/swipe/matches") });
  const list = matches.data ?? [];
  return (
    <section className="card p-5" aria-labelledby="matches-title">
      <h2 id="matches-title" className="flex items-center gap-2 text-lg font-bold">
        <Heart className="size-5 text-success" aria-hidden /> {t.yourMatches}
        {list.length > 0 && <span className="rounded-full bg-success-soft px-2 text-sm text-success">{list.length}</span>}
      </h2>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-muted-fg">{t.noMatches}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {list.map((m) => {
            const other = role === "student" ? m.company : m.student;
            return (
              <li key={m.application_id} className="flex items-center gap-3 py-2.5">
                <Avatar name={other.name} size="sm" tone={role === "student" ? "accent" : "primary"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{other.name}</p>
                  <p className="truncate text-xs text-muted-fg">{m.opportunity.title}</p>
                </div>
                <Link to={`/messages?o=${m.opportunity.id}&u=${other.id}`} className="btn-ghost min-h-9 px-2.5" aria-label={t.messageTo(other.name)}>
                  <MessageSquare className="size-4" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function HowItWorks({ role }: { role: Role }) {
  const t = useTexts(T);
  const items = role === "student" ? t.howStudent : t.howCompany;
  return (
    <section className="card p-5" aria-labelledby="how-swipe">
      <h2 id="how-swipe" className="text-lg font-bold">
        {t.howTitle}
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface DeckProps<C> {
  role: Role;
  queryKey: unknown[];
  path: string;
  cardKey: (c: C) => string;
  body: (c: C, liked: boolean) => { opportunity_id: number; student_id?: number; liked: boolean };
  name: (c: C) => string;
  render: (c: C) => ReactNode;
  empty: ReactNode;
}

function Deck<C>({ role, queryKey, path, cardKey, body, name, render, empty }: DeckProps<C>) {
  const t = useTexts(T);
  const qc = useQueryClient();
  const deck = useQuery({ queryKey, queryFn: () => api<C[]>(path), refetchOnWindowFocus: false });
  const [history, setHistory] = useState<C[]>([]);
  const [match, setMatch] = useState<MatchItem | null>(null);
  const [said, setSaid] = useState("");
  const cards = deck.data ?? [];
  // the cached deck is the source of truth, so a swiped card stays gone after leaving the page and coming back
  const setCards = (update: (cards: C[]) => C[]) => qc.setQueryData<C[]>(queryKey, (old) => update(old ?? []));
  const without = (card: C) => (cs: C[]) => cs.filter((c) => cardKey(c) !== cardKey(card));

  const swipe = useMutation({
    mutationFn: ({ card, liked }: { card: C; liked: boolean }) => post<SwipeResult>("/swipe", body(card, liked)),
    onSuccess: (res, { card }) => {
      if (res.matched) {
        setHistory((h) => h.filter((c) => c !== card)); // a match cannot be undone
        setMatch(res.match);
        setSaid(t.saidMatch(name(card)));
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["threads"] });
      }
    },
    onError: (_e, { card }) => {
      setCards((cs) => [card, ...without(card)(cs)]);
      setHistory((h) => h.filter((c) => c !== card));
    },
  });
  const undo = useMutation({
    mutationFn: (card: C) => post("/swipe/undo", body(card, false)),
    onSuccess: (_r, card) => {
      setCards((cs) => [card, ...without(card)(cs)]);
      setHistory((h) => h.slice(0, -1));
      setSaid(t.saidBack(name(card)));
    },
  });

  const onSwipe = (card: C, dir: Direction) => {
    qc.cancelQueries({ queryKey }); // a refetch still in flight must not bring the card back
    setCards(without(card));
    setHistory((h) => [...h, card]);
    setSaid(dir === "right" ? t.saidYes(name(card)) : t.saidPass(name(card)));
    swipe.mutate({ card, liked: dir === "right" });
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <ErrorBox error={deck.error || swipe.error || undo.error} />
        {deck.isLoading ? (
          <Skeleton className="mx-auto h-[560px] max-w-md" />
        ) : cards.length === 0 ? (
          <div className="mx-auto max-w-md">{empty}</div>
        ) : (
          <SwipeDeck
            cards={cards}
            cardKey={cardKey}
            render={render}
            onSwipe={onSwipe}
            onUndo={() => history.length && undo.mutate(history[history.length - 1])}
            canUndo={history.length > 0 && !undo.isPending}
            likeLabel={role === "student" ? t.likeStudent : t.likeCompany}
          />
        )}
        <p className="sr-only" aria-live="polite">
          {said}
        </p>
      </div>
      <aside className="space-y-4">
        <MatchesPanel role={role} />
        <HowItWorks role={role} />
      </aside>
      {match && <MatchDialog match={match} role={role} onClose={() => setMatch(null)} />}
    </div>
  );
}

function StudentSwipe() {
  const t = useTexts(T);
  return (
    <Deck<StudentDeckCard>
      role="student"
      queryKey={["deck", "student"]}
      path="/swipe/student/deck"
      cardKey={(o) => String(o.id)}
      body={(o, liked) => ({ opportunity_id: o.id, liked })}
      name={(o) => `${o.title} (${o.company.name})`}
      render={(o) => <OpportunitySwipeCard o={o} />}
      empty={
        <Empty
          icon={<LogoMark className="size-12" />}
          title={t.seenAll}
          action={
            <Link to="/explore" className="btn-outline">
              {t.seeAllOpps}
            </Link>
          }
        >
          {t.seenAllText}
        </Empty>
      }
    />
  );
}

function OpportunityPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTexts(T);
  const mine = useQuery({ queryKey: ["my-opps"], queryFn: () => api<Opportunity[]>("/opportunities/mine") });
  const open = mine.data?.filter((o) => o.status === "open") ?? [];
  return (
    <div className="flex w-full max-w-md items-center gap-2">
      <label htmlFor="deck-opp" className="shrink-0 text-sm font-semibold">
        {t.studentsFor}
      </label>
      <select id="deck-opp" className="input min-h-10" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t.allOpen}</option>
        {open.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </select>
    </div>
  );
}

function CompanySwipe({ opp }: { opp: string }) {
  const t = useTexts(T);
  return (
    <Deck<CompanyDeckCard>
      key={opp}
      role="company"
      queryKey={["deck", "company", opp]}
      path={`/swipe/company/deck${opp ? `?opportunity_id=${opp}` : ""}`}
      cardKey={(c) => `${c.opportunity.id}-${c.student.id}`}
      body={(c, liked) => ({ opportunity_id: c.opportunity.id, student_id: c.student.id, liked })}
      name={(c) => c.student.name}
      render={(c) => <StudentSwipeCard c={c} />}
      empty={
        <Empty
          icon={<LogoMark className="size-12" />}
          title={t.noMoreStudents}
          action={
            <Link to="/talent" className="btn-outline">
              {t.searchStudents}
            </Link>
          }
        >
          {t.noMoreStudentsText}
        </Empty>
      }
    />
  );
}

export default function SwipePage() {
  const t = useTexts(T);
  const { user } = useSession();
  const [opp, setOpp] = useState("");
  if (!user) return null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t.title}</h1>
          <p className="mt-1 text-muted-fg">
            {user.role === "student" ? t.subStudent : t.subCompany}
          </p>
        </div>
        {user.role === "company" && <OpportunityPicker value={opp} onChange={setOpp} />}
      </div>
      {user.role === "student" ? <StudentSwipe /> : <CompanySwipe opp={opp} />}
    </div>
  );
}
