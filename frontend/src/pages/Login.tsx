import { useQuery } from "@tanstack/react-query";
import { Building2, GraduationCap, LogIn, School } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Logo, useSlogan } from "../components/Logo";
import { ErrorBox, Field } from "../components/ui";
import { api } from "../lib/api";
import { texts, useTexts } from "../lib/i18n";
import { homeFor, useSession } from "../lib/session";
import type { Role } from "../lib/types";

interface DemoAccount {
  name: string;
  role: Role;
  username: string;
  password: string;
}

const ICON = { student: GraduationCap, company: Building2, university: School } as const;

const T = texts(
  {
    roles: { student: "Student", company: "Company", university: "Professor" } as Record<Role, string>,
    title: "Log in",
    useTest: "Use one of the test accounts on the right.",
    username: "Username",
    password: "Password",
    loggingIn: "Logging in...",
    login: "Log in",
    mock: "This is a demo login for the prototype, not a secure one.",
    testAccounts: "Test accounts",
    clickOne: "Click an account to log in with it.",
    loginAs: (name: string, role: string) => `Log in as ${name} (${role})`,
    user: "user",
    pass: "password",
  },
  {
    roles: { student: "Student", company: "Companie", university: "Profesor" },
    title: "Intră în cont",
    useTest: "Folosește unul dintre conturile de test din dreapta.",
    username: "Utilizator",
    password: "Parolă",
    loggingIn: "Se intră în cont...",
    login: "Intră în cont",
    mock: "Este un login demonstrativ pentru prototip, nu unul securizat.",
    testAccounts: "Conturi de test",
    clickOne: "Apasă pe un cont ca să intri cu el.",
    loginAs: (name, role) => `Intră ca ${name} (${role})`,
    user: "utilizator",
    pass: "parolă",
  },
);

export default function Login() {
  const t = useTexts(T);
  const slogan = useSlogan();
  const { user, login } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const accounts = useQuery({ queryKey: ["demo-accounts"], queryFn: () => api<DemoAccount[]>("/auth/demo-accounts") });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  // "Try as a student" buttons link here with ?as=student
  useEffect(() => {
    const a = accounts.data?.find((x) => x.role === params.get("as"));
    if (a) {
      setUsername(a.username);
      setPassword(a.password);
    }
  }, [accounts.data, params]);

  if (user) return <Navigate to={params.get("next") || homeFor(user.role)} replace />;

  const submit = async (u = username, p = password) => {
    setBusy(true);
    setError(null);
    try {
      const me = await login(u, p);
      navigate(params.get("next") || homeFor(me.role), { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 py-6 md:grid-cols-2">
      <form
        className="card space-y-5 p-8"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <Logo />
          <p className="mt-2 text-sm font-semibold text-muted-fg">{slogan}</p>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">{t.title}</h1>
          <p className="mt-1 text-muted-fg">{t.useTest}</p>
        </div>
        <Field label={t.username} htmlFor="username">
          <input id="username" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Field label={t.password} htmlFor="password">
          <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          <LogIn className="size-4" aria-hidden /> {busy ? t.loggingIn : t.login}
        </button>
        <p className="text-sm text-muted-fg">{t.mock}</p>
      </form>

      <section className="card space-y-4 p-8" aria-labelledby="demo-title">
        <h2 id="demo-title" className="text-lg font-bold">
          {t.testAccounts}
        </h2>
        <p className="text-muted-fg">{t.clickOne}</p>
        <ul className="space-y-3">
          {accounts.data?.map((a) => {
            const Icon = ICON[a.role];
            return (
              <li key={a.username}>
                <button
                  type="button"
                  onClick={() => submit(a.username, a.password)}
                  aria-label={t.loginAs(a.name, t.roles[a.role])}
                  className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
                >
                  <span className="rounded-xl bg-primary-soft p-2.5 text-primary-strong">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{a.name}</span>
                    <span className="block text-sm text-muted-fg">
                      {t.roles[a.role]} · {t.user} <code className="font-semibold text-fg">{a.username}</code> · {t.pass}{" "}
                      <code className="font-semibold text-fg">{a.password}</code>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
