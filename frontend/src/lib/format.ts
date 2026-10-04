import type { Opportunity, OppStatus, OppType } from "./types";

export const LEVELS = ["None", "Beginner", "Intermediate", "Advanced"];

export const TYPE_LABEL: Record<OppType, string> = { project: "Project", internship: "Internship", job: "Job" };
export const TYPE_PLURAL: Record<OppType, string> = { project: "Projects", internship: "Internships", job: "Jobs" };

export const STATUS_LABEL: Record<OppStatus, string> = {
  draft: "Draft",
  open: "Open",
  in_progress: "In progress",
  delivered: "Delivered",
  paid: "Paid",
  completed: "Completed",
  closed: "Closed",
};

export const GOAL_LABEL: Record<string, string> = {
  paid_project: "Paid micro-projects",
  course_credit: "Project credit for a course",
  mandatory_practice: "Mandatory practice (stagiu)",
  thesis: "Thesis / dissertation topic",
  internship: "Internship experience",
  part_time_job: "Part-time job",
  full_time_job: "Full-time job",
};

export const ACADEMIC_LABEL: Record<string, string> = {
  course_credit: "Course credit",
  mandatory_practice: "Mandatory practice",
  thesis: "Thesis topic",
};

export const MODE_LABEL: Record<string, string> = { remote: "Remote", onsite: "On-site", hybrid: "Hybrid", any: "Any" };

export const DIFFICULTY = ["", "Easy", "Medium", "Hard"];

export function money(o: Pick<Opportunity, "compensation_type" | "compensation_amount" | "currency">) {
  if (o.compensation_type === "unpaid" || !o.compensation_amount) return "Unpaid";
  const n = new Intl.NumberFormat("en-US").format(o.compensation_amount);
  const unit = o.compensation_type === "monthly" ? " / month" : o.compensation_type === "hourly" ? " / hour" : "";
  return `${n} ${o.currency === "RON" ? "lei" : o.currency}${unit}`;
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

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
