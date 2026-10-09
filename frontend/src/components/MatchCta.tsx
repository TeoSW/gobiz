import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { roPlural, texts, useTexts } from "../lib/i18n";
import { LogoMark } from "./Logo";

const T = texts(
  {
    student: "Find your next project",
    company: "Find your next student",
    loading: "Looking for good fits...",
    none: "No new cards right now. Check back soon.",
    count: (n: number, role: "student" | "company") =>
      `${n} ${role === "student" ? (n === 1 ? "opportunity fits" : "opportunities fit") : n === 1 ? "student fits" : "students fit"} you. Swipe right to say yes.`,
    start: "Start swiping",
  },
  {
    student: "Găsește-ți următorul proiect",
    company: "Găsește-ți următorul student",
    loading: "Căutăm potriviri bune...",
    none: "Niciun card nou acum. Revino curând.",
    count: (n, role) =>
      `${role === "student" ? roPlural(n, "oportunitate ți se potrivește", "oportunități ți se potrivesc") : roPlural(n, "student ți se potrivește", "studenți ți se potrivesc")}. Dă swipe la dreapta ca să spui da.`,
    start: "Începe swipe-ul",
  },
);

/** Dashboard banner that leads to the swipe deck (shares the deck query with the Match page). */
export function MatchCta({ role }: { role: "student" | "company" }) {
  const t = useTexts(T);
  const deck = useQuery({
    queryKey: role === "student" ? ["deck", "student"] : ["deck", "company", ""],
    queryFn: () => api<unknown[]>(role === "student" ? "/swipe/student/deck" : "/swipe/company/deck"),
    refetchOnWindowFocus: false,
  });
  const n = deck.data?.length;
  return (
    <Link to="/match" className="card group flex items-center gap-4 p-5 transition-colors hover:border-primary">
      <LogoMark className="size-12 shrink-0 transition-transform duration-700 group-hover:rotate-180" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">{t[role]}</p>
        <p className="text-muted-fg">{n == null ? t.loading : n === 0 ? t.none : t.count(n, role)}</p>
      </div>
      <span className="btn-primary hidden sm:inline-flex">
        {t.start} <ArrowRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
