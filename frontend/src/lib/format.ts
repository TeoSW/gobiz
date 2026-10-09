import { getLang, texts, useTexts } from "./i18n";
import { useSession } from "./session";
import type { Opportunity, OppStatus, OppType } from "./types";

const LABELS = texts(
  {
    levels: ["None", "Beginner", "Intermediate", "Advanced"],
    types: { project: "Project", internship: "Internship", job: "Job" } as Record<OppType, string>,
    typesPlural: { project: "Projects", internship: "Internships", job: "Jobs" } as Record<OppType, string>,
    status: {
      draft: "Draft",
      open: "Open",
      in_progress: "In progress",
      delivered: "Delivered",
      paid: "Paid",
      completed: "Completed",
      closed: "Closed",
    } as Record<OppStatus, string>,
    goals: {
      paid_project: "Paid micro-projects",
      course_credit: "Project credit for a course",
      mandatory_practice: "Mandatory practice (stagiu)",
      thesis: "Thesis / dissertation topic",
      internship: "Internship experience",
      part_time_job: "Part-time job",
      full_time_job: "Full-time job",
    } as Record<string, string>,
    academic: { course_credit: "Course credit", mandatory_practice: "Mandatory practice", thesis: "Thesis topic" } as Record<string, string>,
    modes: { remote: "Remote", onsite: "On-site", hybrid: "Hybrid", any: "Any" } as Record<string, string>,
    difficulty: ["", "Easy", "Medium", "Hard"],
    appStatus: {
      pending: "pending",
      accepted: "accepted",
      declined: "declined",
      selected: "selected",
      rejected: "not selected",
      withdrawn: "withdrawn",
      match: "match",
    } as Record<string, string>,
    unpaid: "Unpaid",
    perMonth: " / month",
    perHour: " / hour",
    justNow: "just now",
    minAgo: (n: number) => `${n} min ago`,
    hoursAgo: (n: number) => `${n} h ago`,
    daysAgo: (n: number) => `${n} d ago`,
    weeks: (n: number) => `${n} week${n === 1 ? "" : "s"}`,
    hoursWeek: (n: number) => `${n} h / week`,
  },
  {
    levels: ["Deloc", "Începător", "Intermediar", "Avansat"],
    types: { project: "Proiect", internship: "Stagiu", job: "Job" },
    typesPlural: { project: "Proiecte", internship: "Stagii", job: "Joburi" },
    status: {
      draft: "Ciornă",
      open: "Deschis",
      in_progress: "În lucru",
      delivered: "Predat",
      paid: "Plătit",
      completed: "Finalizat",
      closed: "Închis",
    },
    goals: {
      paid_project: "Micro-proiecte plătite",
      course_credit: "Proiect pentru o materie",
      mandatory_practice: "Practica obligatorie (stagiu)",
      thesis: "Temă de licență / disertație",
      internship: "Experiență de stagiu",
      part_time_job: "Job part-time",
      full_time_job: "Job full-time",
    },
    academic: { course_credit: "Notă la o materie", mandatory_practice: "Practică obligatorie", thesis: "Temă de licență" },
    modes: { remote: "Remote", onsite: "La birou", hybrid: "Hibrid", any: "Oricum" },
    difficulty: ["", "Ușor", "Mediu", "Greu"],
    appStatus: {
      pending: "în așteptare",
      accepted: "acceptat",
      declined: "refuzat",
      selected: "selectat",
      rejected: "neselectat",
      withdrawn: "retras",
      match: "match",
    },
    unpaid: "Neplătit",
    perMonth: " / lună",
    perHour: " / oră",
    justNow: "acum",
    minAgo: (n) => `acum ${n} min`,
    hoursAgo: (n) => `acum ${n} h`,
    daysAgo: (n) => `acum ${n} ${n === 1 ? "zi" : "zile"}`,
    weeks: (n) => (n === 1 ? "1 săptămână" : n < 20 ? `${n} săptămâni` : `${n} de săptămâni`),
    hoursWeek: (n) => `${n} h / săptămână`,
  },
);

const locale = () => (getLang() === "ro" ? "ro-RO" : "en-GB");

export function money(o: Pick<Opportunity, "compensation_type" | "compensation_amount" | "currency">) {
  const t = LABELS[getLang()];
  if (o.compensation_type === "unpaid" || !o.compensation_amount) return t.unpaid;
  const n = new Intl.NumberFormat(locale()).format(o.compensation_amount);
  const unit = o.compensation_type === "monthly" ? t.perMonth : o.compensation_type === "hourly" ? t.perHour : "";
  return `${n} ${o.currency === "RON" ? "lei" : o.currency}${unit}`;
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(iso: string) {
  const t = LABELS[getLang()];
  const s = (Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 1000;
  if (s < 60) return t.justNow;
  if (s < 3600) return t.minAgo(Math.floor(s / 60));
  if (s < 86400) return t.hoursAgo(Math.floor(s / 3600));
  return t.daysAgo(Math.floor(s / 86400));
}

export const number = (n: number) => new Intl.NumberFormat(locale()).format(n);

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).replace(/[-_]/g, " ") : s);

export function initials(name: string) {
  return name
    .replace(/^(Prof\.|Dr\.)\s*/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Labels in the current language, plus the domain names sent by the API. */
export function useFormat() {
  const t = useTexts(LABELS);
  const { meta } = useSession();
  return { ...t, domain: (d: string) => (d ? cap(meta?.domain_names?.[d] ?? d) : d) };
}
