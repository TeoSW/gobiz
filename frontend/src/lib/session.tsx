import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getStoredUserId, post, setApiUser, storeUserId } from "./api";
import type { Meta, UserBrief } from "./types";

interface Session {
  user: UserBrief | null;
  meta: Meta | undefined;
  login: (username: string, password: string) => Promise<UserBrief>;
  logout: () => void;
  ready: boolean;
}

const Ctx = createContext<Session | null>(null);

/** Mockup login: the server checks username + password, then the user id is sent as X-User-Id. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<number | null>(getStoredUserId());
  const me = useQuery({ queryKey: ["me", userId], queryFn: () => api<UserBrief>("/me"), enabled: userId != null, retry: false });
  const meta = useQuery({ queryKey: ["meta"], queryFn: () => api<Meta>("/meta"), staleTime: Infinity });

  const setUser = useCallback(
    (id: number | null) => {
      setApiUser(id);
      storeUserId(id);
      setUserId(id);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "meta" });
    },
    [qc],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const u = await post<UserBrief>("/auth/login", { username, password });
      setUser(u.id);
      qc.setQueryData(["me", u.id], u);
      return u;
    },
    [qc, setUser],
  );
  const logout = useCallback(() => setUser(null), [setUser]);

  // stored account no longer exists (e.g. demo data was reset) -> log out
  useEffect(() => {
    if (me.isError) setUser(null);
  }, [me.isError, setUser]);

  const user = userId != null ? (me.data ?? null) : null;
  return (
    <Ctx.Provider value={{ user, meta: meta.data, login, logout, ready: userId == null || !me.isLoading }}>{children}</Ctx.Provider>
  );
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside provider");
  return s;
}

export function useSkillName() {
  const { meta } = useSession();
  return useCallback((id: string) => meta?.skills.find((s) => s.id === id)?.name ?? id, [meta]);
}

export const homeFor = (role: UserBrief["role"]) => (role === "student" ? "/student" : role === "company" ? "/company" : "/university");
