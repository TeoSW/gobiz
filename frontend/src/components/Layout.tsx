import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { LogIn, LogOut, Menu, MessageSquare, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { LANGS, texts, useLang, useTexts } from "../lib/i18n";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";
import type { Role, Thread } from "../lib/types";
import { Logo, useSlogan } from "./Logo";
import { Avatar } from "./ui";

type NavKey = "explore" | "match" | "dashboard" | "profile" | "post" | "talent" | "insights";

const NAV: Record<Role | "guest", { to: string; key: NavKey }[]> = {
  guest: [{ to: "/explore", key: "explore" }],
  student: [
    { to: "/explore", key: "explore" },
    { to: "/match", key: "match" },
    { to: "/student", key: "dashboard" },
    { to: "/student/profile", key: "profile" },
  ],
  company: [
    { to: "/explore", key: "explore" },
    { to: "/match", key: "match" },
    { to: "/company", key: "dashboard" },
    { to: "/company/new", key: "post" },
    { to: "/talent", key: "talent" },
  ],
  university: [
    { to: "/explore", key: "explore" },
    { to: "/university", key: "insights" },
  ],
};

const T = texts(
  {
    nav: { explore: "Explore", match: "Match", dashboard: "Dashboard", profile: "My profile", post: "Post opportunity", talent: "Talent", insights: "Insights" } as Record<NavKey, string>,
    roles: { student: "Student", company: "Company", university: "Professor" } as Record<Role, string>,
    login: "Log in",
    logout: "Log out",
    messages: (unread: number) => `Messages${unread ? `, ${unread} unread` : ""}`,
    toLight: "Switch to light theme",
    toDark: "Switch to dark theme",
    menu: "Menu",
    skip: "Skip to content",
    mainNav: "Main",
    mobileNav: "Mobile",
    footerNav: "Footer",
    footer: "SkillSync prototype · student skills for real company problems.",
    system: "System & AI status",
    howMatching: "How matching works",
    language: "Language",
    langNames: { ro: "Română", en: "English" },
  },
  {
    nav: { explore: "Explorează", match: "Match", dashboard: "Panou", profile: "Profilul meu", post: "Publică", talent: "Talente", insights: "Statistici" },
    roles: { student: "Student", company: "Companie", university: "Profesor" },
    login: "Intră în cont",
    logout: "Ieși din cont",
    messages: (unread) => `Mesaje${unread ? `, ${unread} necitite` : ""}`,
    toLight: "Treci la tema luminoasă",
    toDark: "Treci la tema întunecată",
    menu: "Meniu",
    skip: "Sari la conținut",
    mainNav: "Principal",
    mobileNav: "Mobil",
    footerNav: "Subsol",
    footer: "Prototip SkillSync · abilitățile studenților pentru probleme reale ale firmelor.",
    system: "Starea sistemului și a AI",
    howMatching: "Cum funcționează potrivirea",
    language: "Limba",
    langNames: { ro: "Română", en: "English" },
  },
);

/** RO | EN switch. `className` sets the display (e.g. "hidden sm:inline-flex"), so the base has none. */
function LanguageSwitch({ className = "inline-flex" }: { className?: string }) {
  const t = useTexts(T);
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label={t.language} className={clsx("rounded-lg border border-border bg-card p-0.5", className)}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          title={t.langNames[l]}
          lang={l}
          className={clsx(
            "min-h-8 cursor-pointer rounded-md px-2 text-xs font-bold uppercase transition-colors",
            lang === l ? "bg-primary text-primary-fg" : "text-muted-fg hover:text-fg",
          )}
        >
          <span aria-hidden>{l}</span>
          <span className="sr-only">{t.langNames[l]}</span>
        </button>
      ))}
    </div>
  );
}

function AccountMenu() {
  const t = useTexts(T);
  const { user, logout } = useSession();
  const navigate = useNavigate();
  if (!user)
    return (
      <Link to="/login" className="btn-primary min-h-10">
        <LogIn className="size-4" aria-hidden /> {t.login}
      </Link>
    );
  return (
    <div className="flex items-center gap-2">
      <Avatar name={user.name} size="sm" />
      <div className="hidden leading-tight xl:block">
        <p className="text-sm font-semibold">{user.name}</p>
        <p className="text-xs text-muted-fg">{t.roles[user.role]}</p>
      </div>
      <button
        className="btn-ghost min-h-10 px-2.5"
        onClick={() => {
          logout();
          navigate("/login");
        }}
        aria-label={t.logout}
        title={t.logout}
      >
        <LogOut className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function MessagesLink() {
  const t = useTexts(T);
  const { user } = useSession();
  const threads = useQuery({ queryKey: ["threads"], queryFn: () => api<Thread[]>("/messages/threads"), enabled: !!user && user.role !== "university", refetchInterval: 15000 });
  if (!user || user.role === "university") return null;
  const unread = threads.data?.reduce((n, th) => n + th.unread, 0) ?? 0;
  return (
    <NavLink to="/messages" className={({ isActive }) => clsx("btn-ghost relative min-h-10 px-2.5", isActive && "bg-muted text-fg")} aria-label={t.messages(unread)}>
      <MessageSquare className="size-5" aria-hidden />
      {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-accent px-1 text-center text-[11px] leading-5 font-bold text-accent-fg">{unread}</span>}
    </NavLink>
  );
}

export function Layout() {
  const t = useTexts(T);
  const slogan = useSlogan();
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
    clsx("rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors", isActive ? "bg-primary-soft text-primary-strong" : "text-muted-fg hover:bg-muted hover:text-fg");

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
        {t.skip}
      </a>
      <header className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label={t.mainNav}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={navLink}>
                {t.nav[l.key]}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <LanguageSwitch className="hidden sm:inline-flex" />
            <MessagesLink />
            <button onClick={toggleTheme} className="btn-ghost min-h-10 px-2.5" aria-label={theme === "dark" ? t.toLight : t.toDark}>
              {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
            </button>
            <AccountMenu />
            <button className="btn-ghost min-h-10 px-2.5 lg:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-nav" aria-label={t.menu}>
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
        {open && (
          <div id="mobile-nav" className="border-t border-border px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1" aria-label={t.mobileNav}>
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end className={navLink}>
                  {t.nav[l.key]}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 sm:hidden">
              <span className="text-sm text-muted-fg">{t.language}</span>
              <LanguageSwitch />
            </div>
          </div>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-fg sm:px-6">
          <p>
            <span className="font-semibold text-fg">{slogan}</span> {t.footer}
          </p>
          <nav className="flex flex-wrap items-center gap-4" aria-label={t.footerNav}>
            <Link className="link" to="/system">
              {t.system}
            </Link>
            <Link className="link" to="/about">
              {t.howMatching}
            </Link>
            <LanguageSwitch />
          </nav>
        </div>
      </footer>
    </div>
  );
}
