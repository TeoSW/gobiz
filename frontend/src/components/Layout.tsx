import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Menu, MessageSquare, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";
import type { Role, Thread } from "../lib/types";

const NAV: Record<Role | "guest", { to: string; label: string }[]> = {
  guest: [{ to: "/explore", label: "Explore" }],
  student: [
    { to: "/explore", label: "Explore" },
    { to: "/student", label: "Dashboard" },
    { to: "/student/profile", label: "My profile" },
  ],
  company: [
    { to: "/explore", label: "Explore" },
    { to: "/company", label: "Dashboard" },
    { to: "/company/new", label: "Post opportunity" },
    { to: "/talent", label: "Talent" },
  ],
  university: [
    { to: "/explore", label: "Explore" },
    { to: "/university", label: "Insights" },
  ],
};

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-lg font-extrabold tracking-tight" aria-label="GoBiz home">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#2563EB" />
        <path d="M21.5 11.5a7 7 0 1 0 1.2 7H16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="23" cy="9" r="2.5" fill="#EA580C" />
      </svg>
      <span className="text-lg">
        Go<span className="text-primary-strong">Biz</span>
      </span>
    </Link>
  );
}

function PersonaSwitcher() {
  const { user, personas, switchTo } = useSession();
  const navigate = useNavigate();
  const groups: { role: Role; label: string }[] = [
    { role: "student", label: "Students" },
    { role: "company", label: "Companies" },
    { role: "university", label: "University" },
  ];
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Demo persona</span>
      <select
        className="input min-h-10 w-[15rem] cursor-pointer py-0 pr-8 font-medium"
        value={user?.id ?? ""}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : null;
          switchTo(id);
          const role = personas.find((p) => p.id === id)?.role;
          navigate(role === "student" ? "/student" : role === "company" ? "/company" : role === "university" ? "/university" : "/");
        }}
      >
        <option value="">Choose demo persona...</option>
        {groups.map((g) => (
          <optgroup key={g.role} label={g.label}>
            {personas
              .filter((p) => p.role === g.role)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function MessagesLink() {
  const { user } = useSession();
  const threads = useQuery({ queryKey: ["threads"], queryFn: () => api<Thread[]>("/messages/threads"), enabled: !!user && user.role !== "university", refetchInterval: 15000 });
  if (!user || user.role === "university") return null;
  const unread = threads.data?.reduce((n, t) => n + t.unread, 0) ?? 0;
  return (
    <NavLink to="/messages" className={({ isActive }) => clsx("btn-ghost relative min-h-10 px-2.5", isActive && "bg-muted text-fg")} aria-label={`Messages${unread ? `, ${unread} unread` : ""}`}>
      <MessageSquare className="size-5" aria-hidden />
      {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-accent px-1 text-center text-[11px] leading-5 font-bold text-accent-fg">{unread}</span>}
    </NavLink>
  );
}

export function Layout() {
  const { user } = useSession();
  const [theme, toggleTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const links = NAV[user?.role ?? "guest"];

  const navLink = ({ isActive }: { isActive: boolean }) =>
    clsx("rounded-lg px-3 py-2 text-sm font-semibold transition-colors", isActive ? "bg-primary-soft text-primary-strong" : "text-muted-fg hover:bg-muted hover:text-fg");

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={navLink}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden sm:block">
              <PersonaSwitcher />
            </div>
            <MessagesLink />
            <button onClick={toggleTheme} className="btn-ghost min-h-10 px-2.5" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
              {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
            </button>
            <button className="btn-ghost min-h-10 px-2.5 md:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu">
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
        {open && (
          <div id="mobile-nav" className="border-t border-border px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end className={navLink}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 sm:hidden">
              <PersonaSwitcher />
            </div>
          </div>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-fg sm:px-6">
          <p>GoBiz prototype · connecting student skills with real company problems.</p>
          <nav className="flex gap-4" aria-label="Footer">
            <Link className="link" to="/system">
              System & AI status
            </Link>
            <Link className="link" to="/about">
              How matching works
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
