"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { markNotificationRead, markAllNotificationsRead } from "@/server/actions/notifications";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  requestId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationCenter({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 hover:bg-[var(--color-muted)]"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-[var(--color-destructive)]" />
        )}
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-40 w-80 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] shadow-lg">
            <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
              <span className="text-sm font-medium">Notifications</span>
              {unread > 0 && (
                <form action={markAllNotificationsRead}>
                  <button type="submit" className="text-xs text-[var(--color-muted-foreground)] hover:underline">
                    Mark all read
                  </button>
                </form>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-sm text-[var(--color-muted-foreground)] text-center py-6">
                  Nothing new.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {items.map((n) => (
                    <li key={n.id} className={cn("p-3 text-sm", !n.readAt && "bg-[var(--color-muted)]/40")}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {n.requestId ? (
                            <Link
                              href={`/requests/${n.requestId}`}
                              onClick={() => setOpen(false)}
                              className="font-medium hover:underline"
                            >
                              {n.title}
                            </Link>
                          ) : (
                            <div className="font-medium">{n.title}</div>
                          )}
                          {n.body && <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{n.body}</div>}
                          <div className="text-xs text-[var(--color-muted-foreground)] mt-1">{relativeTime(n.createdAt)}</div>
                        </div>
                        {!n.readAt && (
                          <form action={markNotificationRead}>
                            <input type="hidden" name="id" value={n.id} />
                            <button type="submit" className="text-xs text-[var(--color-muted-foreground)] hover:underline">
                              Mark read
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
