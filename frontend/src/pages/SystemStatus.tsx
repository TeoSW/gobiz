import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Brain, Database, Network, RefreshCw, RotateCcw, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, ErrorBox, Notice, Spinner } from "../components/ui";
import { api, post } from "../lib/api";
import { useSession } from "../lib/session";
import type { SystemStatus as S } from "../lib/types";

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
  const qc = useQueryClient();
  const { switchTo } = useSession();
  const q = useQuery({ queryKey: ["system"], queryFn: () => api<S>("/system/status"), refetchInterval: 10000 });
  const sync = useMutation({ mutationFn: () => post("/graph/sync"), onSuccess: () => qc.invalidateQueries({ queryKey: ["system"] }) });
  const reset = useMutation({
    mutationFn: () => post("/system/reset-demo"),
    onSuccess: () => {
      switchTo(null);
      qc.invalidateQueries();
    },
  });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const s = q.data!;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-extrabold">System & AI status</h1>
      <p className="text-muted-fg">Everything runs locally with open-source components. Each AI part has a deterministic fallback, so the demo always works.</p>

      <Row icon={<Bot className="size-5" />} title="Requirement extraction (LLM)" status={s.llm.provider === "ollama" ? ok(s.llm.reachable && s.llm.model_pulled, "Ollama ready", s.llm.reachable ? "Model not pulled" : "Ollama offline · using fallback") : <Badge>Heuristic only</Badge>}>
        <p>
          Provider: <strong>{s.llm.provider}</strong>
          {s.llm.model ? ` · model ${s.llm.model}` : ""} · fallback: rule-based extractor
        </p>
        {s.llm.provider === "ollama" && !s.llm.reachable && <p>Start Ollama (docker compose up, or the native app) to use the local LLM.</p>}
        {s.llm.reachable && !s.llm.model_pulled && (
          <p>
            Run <code className="rounded bg-muted px-1">ollama pull {s.llm.model}</code>.
          </p>
        )}
        {s.llm.models && s.llm.models.length > 0 && <p>Installed models: {s.llm.models.join(", ")}</p>}
      </Row>

      <Row icon={<Brain className="size-5" />} title="Semantic similarity (embeddings)" status={ok(s.embeddings.state === "ready", "Model loaded", s.embeddings.state === "loading" ? "Loading model…" : "Hashing fallback")}>
        <p>Active backend: {s.embeddings.backend}</p>
        <p>Model: {s.embeddings.model} (384-d, multilingual incl. Romanian)</p>
        {s.embeddings.error && <p>Error: {s.embeddings.error}</p>}
      </Row>

      <Row icon={<Network className="size-5" />} title="Skill knowledge graph (Neo4j, optional)" status={ok(s.graph.reachable, "Connected", s.graph.enabled ? "Unreachable" : "Disabled")}>
        {s.graph.reachable ? (
          <p>
            {s.graph.nodes} nodes · {s.graph.relationships} relationships
          </p>
        ) : (
          <p>{s.graph.detail}</p>
        )}
        {s.graph.reachable && (
          <button className="btn-outline mt-2 min-h-9 px-3" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className="size-4" aria-hidden /> Re-sync graph
          </button>
        )}
      </Row>

      <Row icon={<Database className="size-5" />} title="Database" status={<Badge tone="success">{s.database.driver}</Badge>}>
        <p>
          {s.database.users} users · {s.database.interaction_events} interaction events logged (training data for a future learned ranker)
        </p>
      </Row>

      <Row icon={<Scale className="size-5" />} title="Matching weights" status={<Badge>configurable via env</Badge>}>
        <p>
          Skills {s.weights.skills * 100}% · Experience {s.weights.experience * 100}% · Interests {s.weights.interests * 100}% · Semantic {s.weights.semantic * 100}%
        </p>
      </Row>

      <div className="card space-y-3 p-5">
        <h2 className="font-bold">Demo data</h2>
        <Notice tone="warning">Resetting deletes everything created during the demo and restores the seed data.</Notice>
        <button className="btn-danger" onClick={() => window.confirm("Reset all demo data?") && reset.mutate()} disabled={reset.isPending}>
          <RotateCcw className="size-4" aria-hidden /> {reset.isPending ? "Resetting..." : "Reset demo data"}
        </button>
        <ErrorBox error={reset.error} />
      </div>
    </div>
  );
}
