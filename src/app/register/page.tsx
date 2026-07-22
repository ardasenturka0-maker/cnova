import Link from "next/link";
import { RegisterForm } from "@/components/forms/register-form";
import { MarketingNav } from "@/components/landing/marketing-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <>
      <MarketingNav />
      <main className="container grid min-h-[calc(100svh-4rem)] place-items-center py-12">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Klinik hesabı oluştur</CardTitle>
            <p className="text-sm text-muted-foreground">Başlangıç paketiyle yeni bir organization ve merkez şube açılır.</p>
          </CardHeader>
          <CardContent>
            <RegisterForm />
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Zaten hesabınız var mı?{" "}
              <Link className="font-medium text-primary" href="/login">
                Giriş yap
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
