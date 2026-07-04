import { Bell, LogOut, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { roleLabel } from "@/lib/rbac";
import type { AuthSession } from "@/lib/auth";
import { shellText, type Locale } from "@/lib/i18n";

async function logoutAction() {
  "use server";
  const { cookies } = await import("next/headers");
  const { authCookieName } = await import("@/lib/auth");
  cookies().set(authCookieName, "", { path: "/", maxAge: 0 });
  redirect("/login");
}

export function Topbar({ session, organizationName, locale = "tr" }: { session: AuthSession; organizationName: string; locale?: Locale }) {
  const text = shellText[locale];

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b bg-background/92 px-4 backdrop-blur md:px-6">
      <MobileSidebar locale={locale} />
      <GlobalSearch locale={locale} />
      <div className="ml-auto flex items-center gap-2">
        <LanguageToggle locale={locale} label={text.language} />
        <Button variant="outline" size="icon" aria-label={text.notifications}>
          <Bell className="h-4 w-4" />
        </Button>
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
