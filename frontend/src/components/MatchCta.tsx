import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { LogoMark } from "./Logo";

/** Dashboard banner that leads to the swipe deck (shares the deck query with the Match page). */
export function MatchCta({ role }: { role: "student" | "company" }) {
  const deck = useQuery({
    queryKey: role === "student" ? ["deck", "student"] : ["deck", "company", ""],
    queryFn: () => api<unknown[]>(role === "student" ? "/swipe/student/deck" : "/swipe/company/deck"),
    refetchOnWindowFocus: false,
  });
  const n = deck.data?.length;
  const what = role === "student" ? (n === 1 ? "opportunity fits" : "opportunities fit") : n === 1 ? "student fits" : "students fit";
  return (
    <Link to="/match" className="card group flex items-center gap-4 p-5 transition-colors hover:border-primary">
      <LogoMark className="size-12 shrink-0 transition-transform duration-700 group-hover:rotate-180" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">{role === "student" ? "Find your next project" : "Find your next student"}</p>
        <p className="text-muted-fg">
          {n == null ? "Looking for good fits..." : n === 0 ? "No new cards right now. Check back soon." : `${n} ${what} you. Swipe right to say yes.`}
        </p>
      </div>
      <span className="btn-primary hidden sm:inline-flex">
        Start swiping <ArrowRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
