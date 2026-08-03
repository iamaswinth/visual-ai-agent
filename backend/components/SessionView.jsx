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
      <div className="space-y-6">
        <Skeleton className="h-8 w-56 rounded-sm" />
        <Skeleton className="h-28 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link
        href={`/users/${userId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to user
      </Link>

      <div className="max-w-3xl">
        <h1 className="text-2xl font-normal leading-snug tracking-tight text-ink">
          {session.aiTitle || locationLabel(session)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {locationLabel(session)}
          {session.ip ? ` · ${session.ip}` : ""} · {fmtDate(session.startedAt)} {fmtTime(session.startedAt)} ·{" "}
          {session.events.length} events · {fmtDuration(session.startedAt, session.endedAt)}
        </p>
      </div>

      {/* AI summary — cream callout (a softer signature surface) */}
      {session.aiSummary && (
        <div className="rounded-md bg-cream p-6 text-ink">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-ink/70">AI summary</span>
            {session.aiCategory && <Badge variant="navy">{session.aiCategory}</Badge>}
          </div>
          <p className="mt-3 text-[15px] leading-relaxed">{session.aiSummary}</p>
          {session.aiInsights?.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/70">
              {session.aiInsights.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Activity timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="divide-y divide-hairline">
            {session.events.map((e) => (
              <div key={e.id} className="py-3">
                <div className="grid grid-cols-[64px_1fr] gap-3">
                  <span className="text-xs tabular-nums text-muted-foreground">{fmtTime(e.ts)}</span>
                  <div className="min-w-0 text-sm">
                    <Badge variant="outline" className="mr-2 align-middle text-[10px] uppercase tracking-wide">
                      {e.type.replace(/_/g, " ")}
                    </Badge>
                    {e.title && <span className="text-ink">{e.title}</span>}
                    {e.url && <div className="break-all text-muted-foreground">{e.url}</div>}
                    {eventDetail(e) && <div className="text-xs text-muted-foreground">{eventDetail(e)}</div>}
                  </div>
                </div>
                {e.screenshotId && (
                  <div className="ml-[76px] mt-3 max-w-lg overflow-hidden rounded-md border border-hairline bg-surface-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/screenshots/${e.screenshotId}`}
                      alt={e.caption || "screenshot"}
                      loading="lazy"
                      className="block w-full"
                    />
                    <div className="p-3 text-sm text-body">
                      {e.caption ? (
                        <span>
                          <span className="mr-1.5 text-[10px] font-medium uppercase tracking-wide text-coral">AI</span>
                          {e.caption}
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground">Not yet described.</span>
                      )}
                      {e.trigger && (
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          trigger: {e.trigger}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
