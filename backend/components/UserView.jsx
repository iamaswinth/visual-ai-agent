"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SignatureCard } from "@/components/ui/signature-card";
import { Skeleton } from "@/components/ui/skeleton";
import Chat from "@/components/Chat";
import { fmtDate, fmtTime, fmtRelative, locationLabel, initials, avatarTone } from "@/components/format";

export default function UserView({ userId }) {
  const [user, setUser] = useState(null);
  const [indexing, setIndexing] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(() => {
    fetch(`/api/users/${userId}`)
      .then((r) => r.json())
      .then((d) => d.ok && setUser(d.user))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function indexNow() {
    setIndexing(true);
    setNote("Processing — describing screens, analyzing sessions, indexing…");
    try {
      const r = await fetch(`/api/users/${userId}/process`, { method: "POST" }).then((r) => r.json());
      if (!r.ok) {
        setNote(r.error || "processing failed");
      } else {
        setNote(
          `Done — analyzed ${r.analyzed} session(s), indexed ${r.indexed} items` +
            (r.summary ? ", updated profile." : ".")
        );
      }
      load();
    } catch (e) {
      setNote(e.message);
    } finally {
      setIndexing(false);
    }
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded-sm" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> All users
      </Link>

      <div className="flex flex-wrap items-center gap-5">
        <Avatar className="h-14 w-14">
          <AvatarFallback className={avatarTone(user.id || user.email)}>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-[28px] font-normal leading-tight tracking-tight text-ink">{user.name || user.email}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.email} · {user.sessions.length} sessions · last active {fmtRelative(user.lastSeen)}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <Button
            onClick={indexNow}
            disabled={indexing}
            title="Describe screenshots, summarize sessions, and refresh this user's AI profile so the agent can answer questions about them."
          >
            <Sparkles className="size-4" />
            {indexing ? "Analyzing…" : "Analyze activity"}
          </Button>
          <span className="max-w-[260px] text-right text-xs leading-snug text-muted-foreground">
            {note || "Describe screens, summarize sessions & refresh the AI profile. Runs automatically when a session ends."}
          </span>
        </div>
      </div>

      {/* AI profile — a dark-navy signature surface (the voltage moment) */}
      <SignatureCard tone="navy">
        <div className="text-xs font-medium uppercase tracking-[0.16em] text-white/60">AI profile</div>
        <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-white/90">
          {user.summary || (
            <span className="text-white/50">
              No profile yet — it’s generated automatically when this user’s sessions end (or press “Analyze activity”).
            </span>
          )}
        </p>
      </SignatureCard>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Sessions</h2>
          {user.sessions.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
          {user.sessions.map((s) => (
            <Link key={s.sessionId} href={`/users/${userId}/sessions/${s.sessionId}`} className="group block">
              <Card className="transition-colors group-hover:border-ink/25">
                <CardContent className="p-5">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] text-ink">{s.aiTitle || locationLabel(s)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {s.aiCategory && <Badge variant="navy">{s.aiCategory}</Badge>}
                      <span>{locationLabel(s)}</span>
                      <span>·</span>
                      <span>{fmtDate(s.startedAt)} {fmtTime(s.startedAt)}</span>
                      <span>·</span>
                      <span>{s.eventCount} events</span>
                      <span>·</span>
                      <span>{s.screenshotCount} shots</span>
                    </div>
                    {s.domains?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {s.domains.slice(0, 5).map((d) => (
                          <Badge key={d} variant="outline" className="text-[10px]">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Chat userId={userId} userName={user.name || user.email} />
        </div>
      </div>
    </div>
  );
}
