import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Brain, Database, Network, RefreshCw, RotateCcw, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, ErrorBox, Notice, Spinner } from "../components/ui";
import { api, post } from "../lib/api";
import { texts, useTexts } from "../lib/i18n";
import { useSession } from "../lib/session";
import type { SystemStatus as S } from "../lib/types";

const T = texts(
  {
    title: "System & AI status",
    intro: "Everything runs locally with open-source components. Each AI part has a deterministic fallback, so the demo always works.",
    llmTitle: "Requirement extraction (LLM)",
    ollamaReady: "Ollama ready",
    notPulled: "Model not pulled",
    offline: "Ollama offline · using fallback",
    heuristicOnly: "Heuristic only",
    provider: "Provider:",
    model: (m: string) => ` · model ${m}`,
    fallback: " · fallback: rule-based extractor",
    startOllama: "Start Ollama (docker compose up, or the native app) to use the local LLM.",
    run: "Run",
    installed: (list: string) => `Installed models: ${list}`,
    embTitle: "Semantic similarity (embeddings)",
    loaded: "Model loaded",
    loading: "Loading model…",
    hashing: "Hashing fallback",
    backend: (b: string) => `Active backend: ${b}`,
    embModel: (m: string) => `Model: ${m} (384-d, multilingual incl. Romanian)`,
    error: (e: string) => `Error: ${e}`,
    graphTitle: "Skill knowledge graph (Neo4j, optional)",
    connected: "Connected",
    unreachable: "Unreachable",
    disabled: "Disabled",
    nodes: (n: number, r: number) => `${n} nodes · ${r} relationships`,
    resync: "Re-sync graph",
    database: "Database",
    dbLine: (users: number, events: number) => `${users} users · ${events} interaction events logged (training data for a future learned ranker)`,
    weights: "Matching weights",
    configurable: "configurable via env",
    weightsLine: (s: number, e: number, i: number, sem: number) => `Skills ${s}% · Experience ${e}% · Interests ${i}% · Semantic ${sem}%`,
    demo: "Demo data",
    resetWarning: "Resetting deletes everything created during the demo and restores the seed data.",
    confirm: "Reset all demo data?",
    resetting: "Resetting...",
    reset: "Reset demo data",
  },
  {
    title: "Starea sistemului și a AI",
    intro: "Totul rulează local, cu componente open source. Fiecare parte de AI are o variantă de rezervă, așa că demo-ul merge mereu.",
    llmTitle: "Extragerea cerințelor (LLM)",
    ollamaReady: "Ollama pregătit",
    notPulled: "Modelul nu e descărcat",
    offline: "Ollama oprit · se folosesc regulile",
    heuristicOnly: "Doar reguli",
    provider: "Furnizor:",
    model: (m) => ` · model ${m}`,
    fallback: " · rezervă: extractor pe bază de reguli",
    startOllama: "Pornește Ollama (docker compose up sau aplicația nativă) ca să folosești modelul local.",
    run: "Rulează",
    installed: (list) => `Modele instalate: ${list}`,
    embTitle: "Similaritate semantică (embeddings)",
    loaded: "Model încărcat",
    loading: "Se încarcă modelul…",
    hashing: "Rezervă prin hashing",
    backend: (b) => `Backend activ: ${b}`,
    embModel: (m) => `Model: ${m} (384 de dimensiuni, multilingv, inclusiv română)`,
    error: (e) => `Eroare: ${e}`,
    graphTitle: "Graful de abilități (Neo4j, opțional)",
    connected: "Conectat",
    unreachable: "Nu răspunde",
    disabled: "Dezactivat",
    nodes: (n, r) => `${n} noduri · ${r} relații`,
    resync: "Resincronizează graful",
    database: "Baza de date",
    dbLine: (users, events) => `${users} utilizatori · ${events} interacțiuni înregistrate (date de antrenare pentru un viitor model de ordonare)`,
    weights: "Ponderile potrivirii",
    configurable: "se pot schimba din variabile de mediu",
    weightsLine: (s, e, i, sem) => `Abilități ${s}% · Experiență ${e}% · Interese ${i}% · Semantic ${sem}%`,
    demo: "Date demo",
    resetWarning: "Resetarea șterge tot ce s-a creat în demo și readuce datele inițiale.",
    confirm: "Resetezi toate datele demo?",
    resetting: "Se resetează...",
    reset: "Resetează datele demo",
  },
);

function Row({ icon, title, status, children }: { icon: ReactNode; title: string; status: ReactNode; children: ReactNode }) {
  return (
    <div className="card flex flex-wrap items-start gap-4 p-5">
      <div className="rounded-xl bg-primary-soft p-2.5 text-primary-strong">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold">{title}</h2>
          {status}
        </div>
        <div className="mt-1 space-y-1 text-sm text-muted-fg">{children}</div>
      </div>
    </div>
  );
}

const ok = (b: boolean | undefined, yes: string, no: string) => <Badge tone={b ? "success" : "warning"}>{b ? yes : no}</Badge>;

export default function SystemStatus() {
  const t = useTexts(T);
  const qc = useQueryClient();
  const { logout } = useSession();
  const q = useQuery({ queryKey: ["system"], queryFn: () => api<S>("/system/status"), refetchInterval: 10000 });
  const sync = useMutation({ mutationFn: () => post("/graph/sync"), onSuccess: () => qc.invalidateQueries({ queryKey: ["system"] }) });
  const reset = useMutation({
    mutationFn: () => post("/system/reset-demo"),
    onSuccess: () => {
      logout();
      qc.invalidateQueries();
    },
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const s = q.data!;
  const pct = (w: number) => Math.round(w * 100);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-extrabold">{t.title}</h1>
      <p className="text-muted-fg">{t.intro}</p>

      <Row
        icon={<Bot className="size-5" />}
        title={t.llmTitle}
        status={s.llm.provider === "ollama" ? ok(s.llm.reachable && s.llm.model_pulled, t.ollamaReady, s.llm.reachable ? t.notPulled : t.offline) : <Badge>{t.heuristicOnly}</Badge>}
      >
        <p>
          {t.provider} <strong>{s.llm.provider}</strong>
          {s.llm.model ? t.model(s.llm.model) : ""}
          {t.fallback}
        </p>
        {s.llm.provider === "ollama" && !s.llm.reachable && <p>{t.startOllama}</p>}
        {s.llm.reachable && !s.llm.model_pulled && (
          <p>
            {t.run} <code className="rounded bg-muted px-1">ollama pull {s.llm.model}</code>.
          </p>
        )}
        {s.llm.models && s.llm.models.length > 0 && <p>{t.installed(s.llm.models.join(", "))}</p>}
      </Row>

      <Row icon={<Brain className="size-5" />} title={t.embTitle} status={ok(s.embeddings.state === "ready", t.loaded, s.embeddings.state === "loading" ? t.loading : t.hashing)}>
        <p>{t.backend(s.embeddings.backend)}</p>
        <p>{t.embModel(s.embeddings.model)}</p>
        {s.embeddings.error && <p>{t.error(s.embeddings.error)}</p>}
      </Row>

      <Row icon={<Network className="size-5" />} title={t.graphTitle} status={ok(s.graph.reachable, t.connected, s.graph.enabled ? t.unreachable : t.disabled)}>
        {s.graph.reachable ? <p>{t.nodes(s.graph.nodes ?? 0, s.graph.relationships ?? 0)}</p> : <p>{s.graph.detail}</p>}
        {s.graph.reachable && (
          <button className="btn-outline mt-2 min-h-9 px-3" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className="size-4" aria-hidden /> {t.resync}
          </button>
        )}
      </Row>

      <Row icon={<Database className="size-5" />} title={t.database} status={<Badge tone="success">{s.database.driver}</Badge>}>
        <p>{t.dbLine(s.database.users, s.database.interaction_events)}</p>
      </Row>

      <Row icon={<Scale className="size-5" />} title={t.weights} status={<Badge>{t.configurable}</Badge>}>
        <p>{t.weightsLine(pct(s.weights.skills), pct(s.weights.experience), pct(s.weights.interests), pct(s.weights.semantic))}</p>
      </Row>

      <div className="card space-y-3 p-5">
        <h2 className="font-bold">{t.demo}</h2>
        <Notice tone="warning">{t.resetWarning}</Notice>
        <button className="btn-danger" onClick={() => window.confirm(t.confirm) && reset.mutate()} disabled={reset.isPending}>
          <RotateCcw className="size-4" aria-hidden /> {reset.isPending ? t.resetting : t.reset}
        </button>
        <ErrorBox error={reset.error} />
      </div>
    </div>
  );
}
