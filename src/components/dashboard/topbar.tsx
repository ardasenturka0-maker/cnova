import { LogOut, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { NotificationsBell, type BellNotification } from "@/components/dashboard/notifications-bell";
import { roleLabel } from "@/lib/rbac";
import type { AuthSession } from "@/lib/auth";
import { shellText, type Locale } from "@/lib/i18n";

async function logoutAction() {
  "use server";
  const { authCookieName } = await import("@/lib/auth");
  const cookieStore = await cookies();
  cookieStore.set(authCookieName, "", { path: "/", maxAge: 0 });
  redirect("/login");
}

async function markAllNotificationsReadAction() {
  "use server";
  const { requireSession } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { organizationId: session.organizationId, read: false, OR: [{ userId: null }, { userId: session.userId }] },
    data: { read: true }
  });
  revalidatePath("/dashboard", "layout");
}

export function Topbar({
  session,
  organizationName,
  notifications = [],
  locale = "tr"
}: {
  session: AuthSession;
  organizationName: string;
  notifications?: BellNotification[];
  locale?: Locale;
}) {
  const text = shellText[locale];

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b bg-background/92 px-4 backdrop-blur md:px-6">
      <MobileSidebar locale={locale} role={session.role} />
      <LanguageToggle className="hidden shrink-0 md:inline-flex" locale={locale} label={text.language} variant="prominent" />
      <GlobalSearch locale={locale} />
      <div className="ml-auto flex items-center gap-2">
        <LanguageToggle className="md:hidden" locale={locale} label={text.language} />
        <NotificationsBell notifications={notifications} locale={locale} label={text.notifications} markAllReadAction={markAllNotificationsReadAction} />
        <ThemeToggle />
        <div className="hidden min-w-44 rounded-md border bg-card px-3 py-2 md:block">
          <div className="truncate text-sm font-medium">{session.name}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            {roleLabel(session.role, locale)} · {organizationName}
          </div>
        </div>
        <form action={logoutAction}>
          <Button variant="outline" size="icon" aria-label={text.logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
