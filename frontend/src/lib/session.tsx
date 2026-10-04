import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getStoredUserId, setApiUser, storeUserId } from "./api";
import type { Meta, UserBrief } from "./types";

interface Session {
  user: UserBrief | null;
  personas: UserBrief[];
  meta: Meta | undefined;
  switchTo: (id: number | null) => void;
  ready: boolean;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<number | null>(getStoredUserId());
  const personas = useQuery({ queryKey: ["personas"], queryFn: () => api<UserBrief[]>("/personas") });
  const meta = useQuery({ queryKey: ["meta"], queryFn: () => api<Meta>("/meta"), staleTime: Infinity });

  const switchTo = useCallback(
    (id: number | null) => {
      setApiUser(id);
      storeUserId(id);
      setUserId(id);
      qc.removeQueries({ predicate: (q) => !["personas", "meta"].includes(String(q.queryKey[0])) });
    },
    [qc],
  );

  const user = useMemo(() => personas.data?.find((p) => p.id === userId) ?? null, [personas.data, userId]);

  // stored persona disappeared (e.g. demo data reset) -> forget it
  useEffect(() => {
    if (personas.data && userId != null && !user) switchTo(null);
  }, [personas.data, userId, user, switchTo]);

  return (
    <Ctx.Provider value={{ user, personas: personas.data ?? [], meta: meta.data, switchTo, ready: !personas.isLoading }}>
      {children}
    </Ctx.Provider>
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
