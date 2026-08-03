"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import Chat from "@/components/Chat";
import { fmtDate, fmtTime, fmtRelative, locationLabel, initials } from "@/components/format";

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
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All users
      </Link>

      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.name || user.email}</h1>
          <p className="text-sm text-muted-foreground">
            {user.email} · {user.sessions.length} sessions · last active {fmtRelative(user.lastSeen)}
          </p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <Button onClick={indexNow} disabled={indexing}>
            <Sparkles className="size-4" />
            {indexing ? "Indexing…" : "Index now"}
          </Button>
          {note && <span className="text-xs text-muted-foreground">{note}</span>}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Badge>AI profile</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed">
          {user.summary || (
            <span className="text-muted-foreground">
              No profile yet — it’s generated automatically when this user’s sessions end (or press “Index now”).
            </span>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Sessions</h2>
          {user.sessions.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
          {user.sessions.map((s) => (
            <Link key={s.sessionId} href={`/users/${userId}/sessions/${s.sessionId}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.aiTitle || `📍 ${locationLabel(s)}`}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {s.aiCategory && <Badge variant="muted">{s.aiCategory}</Badge>}
                        <span>📍 {locationLabel(s)}</span>
                        <span>{fmtDate(s.startedAt)} {fmtTime(s.startedAt)}</span>
                        <span>{s.eventCount} events</span>
                        <span>{s.screenshotCount} shots</span>
                      </div>
                      {s.domains?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.domains.slice(0, 5).map((d) => (
                            <Badge key={d} variant="outline" className="text-[10px]">
                              {d}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Chat userId={userId} userName={user.name || user.email} />
        </div>
      </div>
    </div>
  );
}
