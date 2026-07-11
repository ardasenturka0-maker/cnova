"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import { cn, formatDate } from "@/lib/utils";

export type BellNotification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
};

export function NotificationsBell({
  notifications,
  locale,
  label,
  markAllReadAction
}: {
  notifications: BellNotification[];
  locale: Locale;
  label: string;
  markAllReadAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="outline" size="icon" aria-label={label} aria-expanded={open} aria-controls="dashboard-notifications" aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div id="dashboard-notifications" role="dialog" aria-label={label} className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-80 rounded-md border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Bildirimler</span>
            {unreadCount > 0 ? (
              <form
                action={async () => {
                  await markAllReadAction();
                }}
              >
                <button className="text-xs text-muted-foreground underline-offset-2 hover:underline" type="submit">
                  Tümünü okundu işaretle
                </button>
              </form>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Yeni bildirim yok.</p>
            ) : (
              notifications.map((notification) => {
                const body = (
                  <div className={cn("space-y-1 px-3 py-2.5", !notification.read && "bg-primary/5")}>
                    <div className="flex items-center gap-2">
                      {!notification.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                      <p className="truncate text-sm font-medium">{notification.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(notification.createdAt, locale)}</p>
                  </div>
                );

                return notification.actionUrl ? (
                  <Link
                    key={notification.id}
                    className="block border-b transition hover:bg-muted/60 last:border-0"
                    href={notification.actionUrl}
                    onClick={() => setOpen(false)}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={notification.id} className="border-b last:border-0">
                    {body}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
