"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtRelative, locationLabel, initials } from "@/components/format";

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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">People running the Visual AI Agent extension. Select one to see their activity.</p>
      </div>

      {users === null && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {users?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No users yet. Install the extension, sign in with a name + email, and browse — you’ll show up here.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {users?.map((u) => (
          <Link key={u.id} href={`/users/${u.id}`}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="flex items-center gap-4 py-4">
                <Avatar>
                  <AvatarFallback>{initials(u.name, u.email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.name || u.email}</div>
                  <div className="truncate text-sm text-muted-foreground">{u.email}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="muted">📍 {locationLabel(u)}</Badge>
                    <span>{u.sessionCount} sessions</span>
                    <span>{u.indexed} indexed</span>
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
