"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtRelative, locationLabel, initials, avatarTone } from "@/components/format";

export default function UsersList() {
  const [users, setUsers] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/users")
        .then((r) => r.json())
        .then((d) => alive && d.ok && setUsers(d.users))
        .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-[40px] font-normal leading-[1.2] tracking-tight text-ink">Users</h1>
        <p className="text-[15px] leading-relaxed text-body">
          People running the Visual AI Agent extension. Select one to review their activity, sessions, and ask the agent.
        </p>
      </div>

      {users === null && (
        <div className="grid gap-6 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-md" />
          ))}
        </div>
      )}

      {users?.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-[15px] text-muted-foreground">
            No users yet. Install the extension, sign in with a name + email, and browse — you’ll show up here.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {users?.map((u) => (
          <Link key={u.id} href={`/users/${u.id}`} className="group">
            <Card className="h-full transition-colors group-hover:border-ink/25">
              <CardContent className="flex items-center gap-4 p-6">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className={avatarTone(u.id || u.email)}>{initials(u.name, u.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] leading-tight text-ink">{u.name || u.email}</div>
                  <div className="truncate text-sm text-muted-foreground">{u.email}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="default">{locationLabel(u)}</Badge>
                    <span>{u.sessionCount} sessions</span>
                    <span>·</span>
                    <span>{u.indexed} indexed</span>
                    <span>·</span>
                    <span>active {fmtRelative(u.lastActive)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
