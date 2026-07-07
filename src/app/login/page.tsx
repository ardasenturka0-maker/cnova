import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";
import { MarketingNav } from "@/components/landing/marketing-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const nextPath = searchParams.next?.startsWith("/dashboard") ? searchParams.next : "/dashboard";
  return (
    <>
      <MarketingNav />
      <main className="container grid min-h-[calc(100svh-4rem)] place-items-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>ClinicNova giriş</CardTitle>
            <p className="text-sm text-muted-foreground">Demo: owner@clinicnova.test / password123</p>
          </CardHeader>
          <CardContent>
            <LoginForm nextPath={nextPath} />
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
