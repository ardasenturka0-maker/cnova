import { Activity, LogOut } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PortalNav } from "@/components/portal/portal-nav";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { getLocale } from "@/lib/i18n-server";
import { requirePatientSession } from "@/lib/patient-auth";

async function patientLogoutAction() {
  "use server";
  const { patientCookieName } = await import("@/lib/patient-auth");
  cookies().set(patientCookieName, "", { path: "/", maxAge: 0 });
  redirect("/portal/login");
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePatientSession();
  const locale = getLocale();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">ClinicNova</p>
            <p className="truncate text-xs text-muted-foreground">Hasta Portalı · {session.name}</p>
          </div>
          <LanguageToggle locale={locale} />
          <form action={patientLogoutAction}>
            <Button variant="outline" size="icon" aria-label="Çıkış" type="submit">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">{children}</main>
      <PortalNav />
    </div>
  );
}
