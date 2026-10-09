export type Role = "student" | "company" | "university";
export type OppType = "project" | "internship" | "job";
export type OppStatus = "draft" | "open" | "in_progress" | "delivered" | "paid" | "completed" | "closed";
export type MatchStatus = "evaluated" | "to_clarify" | "incompatible";
/** application = the student applied, invitation = the company invited, match = both swiped right */
export type AppKind = "application" | "invitation" | "match";

export interface UserBrief {
  id: number;
  name: string;
  role: Role;
  headline: string;
}

export interface SkillMeta {
  id: string;
  name: string;
  category: string;
  esco_hint: string;
}

export interface Meta {
  skills: SkillMeta[];
  domains: string[];
  domain_names?: Record<string, string>;
  goals: string[];
  types: OppType[];
}

export interface Requirement {
  skill_id: string;
  name: string;
  category?: string;
  min_level: number;
  mandatory: boolean;
  learnable: boolean;
  source: "explicit" | "suggested" | "manual";
  note?: string;
}

export interface SkillRow {
  skill_id: string;
  name: string;
  required_level: number;
  mandatory: boolean;
  learnable: boolean;
  student_level: number | null;
  wants_to_learn: boolean;
  status: "met" | "learnable" | "below" | "related" | "missing" | "unknown";
  via?: string;
}

export interface Match {
  student_id: number;
  opportunity_id: number;
  status: MatchStatus;
  score: number;
  label: string;
  components: { skills: number; experience: number; interests: number; semantic: number | null };
  weights: { skills: number; experience: number; interests: number; semantic: number };
  skills: SkillRow[];
  checks: { code: "type" | "availability" | "period" | "mode" | "experience"; label: string; ok: boolean | null; detail?: string }[];
  blockers: string[];
  to_clarify: string[];
  highlights: string[];
  summary: string;
}

export interface Opportunity {
  id: number;
  type: OppType;
  title: string;
  description: string;
  tasks: string[];
  expected_outcome: string;
  domain: string;
  difficulty: number;
  hours_per_week: number;
  duration_weeks: number;
  start_date: string | null;
  deadline: string | null;
  work_mode: "remote" | "onsite" | "hybrid";
  city: string;
  compensation_type: "fixed" | "monthly" | "hourly" | "unpaid";
  compensation_amount: number;
  currency: string;
  academic_options: string[];
  mentoring_offered: boolean;
  status: OppStatus;
  university_verified: boolean;
  verification_requested: boolean;
  selected_student: UserBrief | null;
  created_at: string;
  company: { id: number; name: string; industry: string; city: string; size: string };
  skills: Requirement[];
  applications_count: number;
  invitations_count: number;
  match: Match | null;
  // detail only
  ai_extraction?: Extraction | null;
  verified_by?: UserBrief | null;
  is_owner?: boolean;
  my_application?: { id: number; kind: AppKind; status: string; created_at: string } | null;
  my_mentorship?: { status: string; mentor: UserBrief | null } | null;
  reviews?: ReviewOut[];
}

export interface ReviewOut {
  id: number;
  direction: "company_to_student" | "student_to_company";
  reviewer: UserBrief;
  ratings: Record<string, number>;
  overall: number;
  comment: string;
  created_at: string;
}

export interface Ratings {
  count: number;
  average: number | null;
  dimensions: Record<string, number>;
}

export interface Portfolio {
  completed: number;
  by_skill: { skill_id: string; name: string; count: number }[];
  average_rating: number | null;
  items: {
    opportunity_id: number;
    title: string;
    type: OppType;
    company: string;
    domain: string;
    skills: string[];
    completed_at: string | null;
    university_verified: boolean;
    rating: number | null;
    review: string;
  }[];
}

export interface StudentSkill {
  skill_id: string;
  name: string;
  category: string;
  level: number;
  wants_to_learn: boolean;
}

export interface PastProject {
  id?: number;
  title: string;
  description: string;
  skills: string[];
  domain: string;
  url: string;
}

export interface Student {
  id: number;
  name: string;
  headline: string;
  email: string | null;
  university: string;
  faculty: string;
  study_program: string;
  study_level: "bachelor" | "master" | "phd";
  year: number;
  city: string;
  bio: string;
  accepted_types: OppType[];
  goals: string[];
  domains: string[];
  courses: string[];
  hours_per_week: number;
  available_from: string | null;
  available_to: string | null;
  work_mode: "remote" | "onsite" | "hybrid" | "any";
  portfolio_url: string;
  github_url: string;
  cv_filename: string;
  skills: StudentSkill[];
  past_projects: PastProject[];
  portfolio: Portfolio;
  ratings: Ratings;
}

export interface StudentCard {
  id: number;
  name: string;
  headline: string;
  university: string;
  study_program: string;
  year: number;
  city: string;
  accepted_types: OppType[];
  top_skills: { skill_id: string; name: string; level: number }[];
  completed_projects: number;
  rating: number | null;
  match: Match | null;
}

export interface CandidateCard {
  student: { id: number; name: string; headline: string; university: string; year: number; city: string };
  match: Match;
  application: { id: number; kind: AppKind; status: string; message: string; created_at: string } | null;
}

export interface Candidates {
  ai_matches: CandidateCard[];
  applicants: CandidateCard[];
  invited: CandidateCard[];
  matches: CandidateCard[];
  all_count: number;
}

export interface MyApplication {
  id: number;
  kind: AppKind;
  status: string;
  message: string;
  match_score: number | null;
  created_at: string;
  opportunity: Opportunity;
}

export interface Extraction {
  summary: string;
  type_guess: OppType;
  domain: string;
  difficulty: number;
  tasks: string[];
  skills: Requirement[];
  unrecognized_skills: string[];
  missing_info: string[];
  provider: "ollama" | "heuristic";
  model: string | null;
  fallback_reason: string | null;
  elapsed_ms: number;
}

export interface Thread {
  opportunity: { id: number; title: string; status: OppStatus };
  with: UserBrief;
  last: string;
  last_at: string;
  unread: number;
  new_match?: boolean;
}

export interface ChatMessage {
  id: number;
  mine: boolean;
  body: string;
  created_at: string;
}

export interface Company {
  id: number;
  name: string;
  headline: string;
  industry: string;
  size: string;
  city: string;
  website: string;
  description: string;
  opportunities: number;
  ratings: Ratings;
}

export interface UniversityDashboard {
  kpis: {
    opportunities: number;
    open: number;
    completed: number;
    in_progress: number;
    students: number;
    companies: number;
    university_verified: number;
    avg_student_rating: number | null;
  };
  by_type: { type: OppType; count: number }[];
  compensation: { key: string; type: OppType; unit: string; average: number; count: number }[];
  top_skills: { skill_id: string; name: string; opportunities: number; mandatory: number }[];
  skill_gap: { skill_id: string; name: string; demand_pct: number; supply_pct: number; gap: number; students_want_to_learn: number }[];
  domains: { domain: string; count: number }[];
  academic: { option: string; count: number }[];
  co_demand: { source: "neo4j" | "sql"; pairs: { a: string; b: string; n: number }[] };
}

export interface MentorshipRow {
  id: number;
  status: string;
  note: string;
  created_at: string;
  student: UserBrief;
  mentor: UserBrief | null;
  opportunity: { id: number; title: string; type: OppType; company: string };
}

export interface SystemStatus {
  database: { driver: string; users: number; interaction_events: number };
  llm: { provider: string; fallback: string; reachable?: boolean; model?: string; model_pulled?: boolean; models?: string[]; error?: string };
  embeddings: { backend: string; state: string; model: string; error: string | null };
  graph: { enabled: boolean; reachable: boolean; detail?: string; nodes?: number; relationships?: number };
  weights: { skills: number; experience: number; interests: number; semantic: number };
}

export interface SkillGraph {
  source: "neo4j" | "sql";
  skill_id: string;
  name: string;
  related: { id: string; name: string }[];
  co_demanded: { id: string; name: string; n: number }[];
  students: number;
  opportunities: number;
}

// ---------------------------------------------------------------- swipe matching
export type StudentDeckCard = Opportunity & { match: Match; invited: boolean };

export interface CompanyDeckCard {
  opportunity: { id: number; title: string; type: OppType };
  student: {
    id: number;
    name: string;
    headline: string;
    university: string;
    study_program: string;
    year: number;
    city: string;
    bio: string;
    hours_per_week: number;
    work_mode: string;
    top_skills: { skill_id: string; name: string; level: number }[];
    learning: string[];
    completed_projects: number;
    rating: number | null;
  };
  match: Match;
  applied: boolean;
  application_message: string;
}

export interface MatchItem {
  application_id: number;
  status: string;
  created_at: string;
  match_score: number | null;
  opportunity: { id: number; title: string; type: OppType; status: OppStatus };
  student: UserBrief;
  company: UserBrief;
}

export type SwipeResult = { matched: false } | { matched: true; match: MatchItem };
