"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import Markdown from "@/components/Markdown";

export default function Chat({ userId, userName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  async function send() {
    const q = input.trim();
    if (!q || streaming) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "", sources: [] }]);
    setInput("");
    setStreaming(true);
    const patchLast = (fn) =>
      setMessages((prev) => {
        const c = [...prev];
        c[c.length - 1] = fn(c[c.length - 1]);
        return c;
      });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, messages: history, userId }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "chat failed" }));
        patchLast((m) => ({ ...m, content: err.error || "chat failed", error: true }));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();
        for (const p of parts) {
          const ev = /event: (.*)/.exec(p)?.[1];
          const dm = /data: ([\s\S]*)/.exec(p)?.[1];
          if (!dm) continue;
          let data;
          try {
            data = JSON.parse(dm);
          } catch {
            continue;
          }
          if (ev === "sources") patchLast((m) => ({ ...m, sources: data }));
          else if (ev === "delta") patchLast((m) => ({ ...m, content: m.content + data.text }));
          else if (ev === "error") patchLast((m) => ({ ...m, content: m.content + "\n[error generating answer]", error: true }));
        }
      }
    } catch (e) {
      patchLast((m) => ({ ...m, content: e.message, error: true }));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-hairline bg-canvas">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3 text-[15px] text-ink">
        <span className="inline-block size-2 rounded-full bg-coral" />
        Ask the agent about {userName}
      </div>
      <ScrollArea className="h-72 px-4 py-3">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-sm leading-relaxed text-muted-foreground">
              e.g. “What did {userName} do today?”, “Any shopping sessions?”, “Which sites did they visit most?”
            </div>
          )}
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            const waiting = m.role === "assistant" && streaming && i === messages.length - 1 && !m.content;
            return (
              <div
                key={i}
                className={cn(
                  "max-w-[88%] rounded-lg px-3.5 py-2.5 text-sm",
                  isUser
                    ? "self-end bg-ink text-white"
                    : cn("self-start border border-hairline bg-surface-soft text-body", m.error && "border-coral text-coral")
                )}
              >
                {isUser ? (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                ) : waiting ? (
                  <div className="flex gap-1 py-0.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
                  </div>
                ) : (
                  <Markdown text={m.content} />
                )}
                {m.role === "assistant" && m.sources?.length > 0 && (
                  <div className="mt-2 border-t border-hairline pt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    sources: {m.sources.map((s) => s.title).filter(Boolean).join(" · ") || "—"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <form
        className="flex gap-2 border-t border-hairline p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${userName}…`}
          disabled={streaming}
        />
        <Button type="submit" size="sm" className="h-11 px-5" disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
