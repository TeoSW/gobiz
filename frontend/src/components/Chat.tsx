import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, post } from "../lib/api";
import { timeAgo } from "../lib/format";
import type { ChatMessage } from "../lib/types";
import { ErrorBox, Spinner } from "./ui";

export function Chat({ opportunityId, withUser, withName, height = "h-80" }: { opportunityId: number; withUser: number; withName: string; height?: string }) {
  const qc = useQueryClient();
  const key = ["chat", opportunityId, withUser];
  const msgs = useQuery({
    queryKey: key,
    queryFn: () => api<ChatMessage[]>(`/messages?opportunity_id=${opportunityId}&with_user=${withUser}`),
    refetchInterval: 8000,
  });
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: (body: string) => post<ChatMessage>("/messages", { opportunity_id: opportunityId, recipient_id: withUser, body }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll the conversation box only, never the page
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [msgs.data?.length]);
  useEffect(() => {
    if (msgs.isSuccess) qc.invalidateQueries({ queryKey: ["threads"] });
  }, [msgs.isSuccess, qc]);

  return (
    <div className="flex flex-col">
      <div ref={box} className={clsx("space-y-2 overflow-y-auto rounded-xl bg-muted/60 p-3", height)} aria-live="polite" aria-label={`Conversation with ${withName}`}>
        {msgs.isLoading && <Spinner label="Loading messages" />}
        {msgs.data?.length === 0 && <p className="py-8 text-center text-sm text-muted-fg">No messages yet. Say hello to {withName}.</p>}
        {msgs.data?.map((m) => (
          <div key={m.id} className={clsx("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={clsx("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", m.mine ? "rounded-br-sm bg-primary text-primary-fg" : "rounded-bl-sm border border-border bg-card")}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={clsx("mt-0.5 text-[11px]", m.mine ? "text-white/75" : "text-muted-fg")}>{timeAgo(m.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate(text.trim());
        }}
      >
        <label htmlFor={`msg-${opportunityId}-${withUser}`} className="sr-only">
          Message
        </label>
        <input id={`msg-${opportunityId}-${withUser}`} className="input" placeholder={`Message ${withName}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
        <button className="btn-primary px-3" disabled={!text.trim() || send.isPending} aria-label="Send message">
          <Send className="size-4" aria-hidden />
        </button>
      </form>
      <div className="mt-2">
        <ErrorBox error={send.error} />
      </div>
    </div>
  );
}
