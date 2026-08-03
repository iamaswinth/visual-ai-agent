"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtTime, fmtDate, fmtDuration, locationLabel, eventDetail } from "@/components/format";

export default function SessionView({ userId, sessionId }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/sessions/${sessionId}`)
        .then((r) => r.json())
        .then((d) => d.ok && setSession(d.session))
        .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [sessionId]);

  if (!session) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href={`/users/${userId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to user
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{session.aiTitle || `📍 ${locationLabel(session)}`}</h1>
        <p className="text-sm text-muted-foreground">
          📍 {locationLabel(session)}
          {session.ip ? ` · ${session.ip}` : ""} · {fmtDate(session.startedAt)} {fmtTime(session.startedAt)} ·{" "}
          {session.events.length} events · {fmtDuration(session.startedAt, session.endedAt)}
        </p>
      </div>

      {session.aiSummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Badge>AI</Badge>
              {session.aiCategory && <Badge variant="muted">{session.aiCategory}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <p>{session.aiSummary}</p>
            {session.aiInsights?.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {session.aiInsights.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Activity timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {session.events.map((e) => (
            <div key={e.id}>
              <div className="grid grid-cols-[64px_1fr] gap-3 py-1.5">
                <span className="text-xs tabular-nums text-muted-foreground/70">{fmtTime(e.ts)}</span>
                <div className="min-w-0 text-sm">
                  <Badge variant="outline" className="mr-2 text-[10px] uppercase">
                    {e.type.replace(/_/g, " ")}
                  </Badge>
                  {e.title && <span className="font-medium">{e.title}</span>}
                  {e.url && <div className="break-all text-muted-foreground">{e.url}</div>}
                  {eventDetail(e) && <div className="text-xs text-muted-foreground/70">{eventDetail(e)}</div>}
                </div>
              </div>
              {e.screenshotId && (
                <div className="ml-[76px] mb-3 max-w-lg overflow-hidden rounded-lg border bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/screenshots/${e.screenshotId}`} alt={e.caption || "screenshot"} loading="lazy" className="block w-full" />
                  <div className="p-3 text-sm">
                    {e.caption ? (
                      <span>
                        <span className="mr-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-400">AI</span>
                        {e.caption}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground/70">Not yet described.</span>
                    )}
                    {e.trigger && <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/60">trigger: {e.trigger}</div>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
