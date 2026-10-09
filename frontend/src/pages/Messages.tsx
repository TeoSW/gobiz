import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { MessageSquare } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Chat } from "../components/Chat";
import { Avatar, Empty, ErrorBox, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";
import type { Thread } from "../lib/types";

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const threads = useQuery({ queryKey: ["threads"], queryFn: () => api<Thread[]>("/messages/threads"), refetchInterval: 10000 });
  const list = threads.data ?? [];
  const o = Number(params.get("o")) || list[0]?.opportunity.id;
  const u = Number(params.get("u")) || list[0]?.with.id;
  const active = list.find((t) => t.opportunity.id === o && t.with.id === u);

  if (threads.isLoading) return <Spinner />;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold">Messages</h1>
      <ErrorBox error={threads.error} />
      {list.length === 0 ? (
        <Empty icon={<MessageSquare className="size-8" />} title="No conversations yet">
          Conversations start when you match, apply, invite or get selected for an opportunity.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <ul className="card max-h-[70vh] divide-y divide-border overflow-y-auto" aria-label="Conversations">
            {list.map((t) => {
              const selected = t.opportunity.id === o && t.with.id === u;
              return (
                <li key={`${t.opportunity.id}-${t.with.id}`}>
                  <button
                    onClick={() => setParams({ o: String(t.opportunity.id), u: String(t.with.id) })}
                    aria-current={selected}
                    className={clsx("flex w-full cursor-pointer items-start gap-3 p-4 text-left transition-colors", selected ? "bg-primary-soft" : "hover:bg-muted/60")}
                  >
                    <Avatar name={t.with.name} size="sm" tone={t.with.role === "company" ? "accent" : "primary"} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                        <span className="truncate">{t.with.name}</span>
                        {t.unread > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-fg">{t.unread}</span>}
                        {t.new_match && <span className="rounded-full bg-success-soft px-2 text-[11px] font-bold text-success">New match</span>}
                      </p>
                      <p className="truncate text-xs text-muted-fg">{t.opportunity.title}</p>
                      <p className="truncate text-sm text-muted-fg">{t.last}</p>
                      <p className="text-[11px] text-muted-fg">{timeAgo(t.last_at)}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {active && (
            <div className="card p-5">
              <div className="mb-3">
                <p className="font-bold">{active.with.name}</p>
                <Link to={`/opportunities/${active.opportunity.id}`} className="link text-sm">
                  {active.opportunity.title}
                </Link>
              </div>
              <Chat key={`${o}-${u}`} opportunityId={active.opportunity.id} withUser={active.with.id} withName={active.with.name} height="h-[50vh]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
