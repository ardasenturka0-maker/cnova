import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { MarketingNav } from "@/components/landing/marketing-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <><MarketingNav /><main className="container grid min-h-[calc(100svh-4rem)] place-items-center py-12"><Card className="w-full max-w-md"><CardHeader><CardTitle>Yeni şifre oluştur</CardTitle><p className="text-sm text-muted-foreground">Bağlantı tek kullanımlıktır ve 30 dakika sonra geçersiz olur.</p></CardHeader><CardContent>{token ? <ResetPasswordForm token={token} /> : <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Şifre yenileme bağlantısı eksik.</p>}<p className="mt-5 text-center text-sm"><Link className="font-medium text-primary" href="/forgot-password">Yeni bağlantı iste</Link></p></CardContent></Card></main></>;
}
