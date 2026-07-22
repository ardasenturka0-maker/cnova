import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";
import { MarketingNav } from "@/components/landing/marketing-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo-mode";
import { cn } from "@/lib/utils";

export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  const nextPath = searchParams.next === "/mobile-connect" || searchParams.next?.startsWith("/dashboard") ? searchParams.next : "/dashboard";
  const demoMode = isDemoMode();
  return (
    <>
      <MarketingNav />
      <main className="container grid min-h-[calc(100svh-4rem)] place-items-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>ClinicNova giriş</CardTitle>
            {demoMode ? <p className="text-sm text-muted-foreground">Canlı veritabanı gerekmeden örnek verilerle inceleyin.</p> : <p className="text-sm text-muted-foreground">Klinik hesabınızla güvenli giriş yapın.</p>}
          </CardHeader>
          <CardContent>
            <LoginForm nextPath={nextPath} />
            {demoMode ? (
              <div className="mt-4 border-t pt-4">
                <Link className={cn(buttonVariants({ variant: "accent" }), "w-full")} href="/demo-open">
                  Demo olarak incele
                </Link>
                <p className="mt-2 text-center text-xs text-muted-foreground">Otomatik oturum açar ve örnek bellek veritabanını kullanır.</p>
              </div>
            ) : null}
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Hesabınız yok mu?{" "}
              <Link className="font-medium text-primary" href="/register">
                Klinik oluştur
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Hasta mısınız?{" "}
              <Link className="font-medium text-primary" href="/portal/login">
                Hasta portalı girişi
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
