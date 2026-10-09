import { Link } from "react-router-dom";
import { ARROWS, BARS, LOGO_VIEWBOX, MARK_VIEWBOX, SKILL, SYNC } from "./logoPaths";

export const SLOGAN = "Match făcut. Proiect început.";

/** The two sync arrows with the growth bars. Colors follow the theme (see --logo-* tokens). */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} aria-hidden>
      <path d={ARROWS} fill="var(--logo-blue)" />
      <path d={BARS} fill="var(--logo-light)" />
    </svg>
  );
}

export function LogoFull({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} className={className} role="img" aria-label="SkillSync">
      <path d={ARROWS} fill="var(--logo-blue)" />
      <path d={BARS} fill="var(--logo-light)" />
      <path d={SKILL} fill="var(--logo-ink)" />
      <path d={SYNC} fill="var(--logo-blue)" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center rounded-lg" aria-label="SkillSync home">
      <LogoFull className="h-6 w-auto sm:h-8" />
    </Link>
  );
}
