import { useQuery } from "@tanstack/react-query";
import { Building2, GraduationCap, LogIn, School } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Logo, SLOGAN } from "../components/Logo";
import { ErrorBox, Field } from "../components/ui";
import { api } from "../lib/api";
import { homeFor, useSession } from "../lib/session";
import type { Role } from "../lib/types";

interface DemoAccount {
  name: string;
  role: Role;
  username: string;
  password: string;
}

const ROLE = {
  student: { icon: GraduationCap, label: "Student" },
  company: { icon: Building2, label: "Company" },
  university: { icon: School, label: "Professor" },
} as const;

export default function Login() {
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
          <p className="mt-2 text-sm font-semibold text-muted-fg">{SLOGAN}</p>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">Log in</h1>
          <p className="mt-1 text-muted-fg">Use one of the test accounts on the right.</p>
        </div>
        <Field label="Username" htmlFor="username">
          <input id="username" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="password">
          <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          <LogIn className="size-4" aria-hidden /> {busy ? "Logging in..." : "Log in"}
        </button>
        <p className="text-sm text-muted-fg">This is a demo login for the prototype, not a secure one.</p>
      </form>

      <section className="card space-y-4 p-8" aria-labelledby="demo-title">
        <h2 id="demo-title" className="text-lg font-bold">
          Test accounts
        </h2>
        <p className="text-muted-fg">Click an account to log in with it.</p>
        <ul className="space-y-3">
          {accounts.data?.map((a) => {
            const Icon = ROLE[a.role].icon;
            return (
              <li key={a.username}>
                <button
                  type="button"
                  onClick={() => submit(a.username, a.password)}
                  aria-label={`Log in as ${a.name} (${ROLE[a.role].label})`}
                  className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
                >
                  <span className="rounded-xl bg-primary-soft p-2.5 text-primary-strong">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{a.name}</span>
                    <span className="block text-sm text-muted-fg">
                      {ROLE[a.role].label} · user <code className="font-semibold text-fg">{a.username}</code> · password{" "}
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
