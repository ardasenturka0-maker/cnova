import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { MarketingNav } from "@/components/landing/marketing-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return <><MarketingNav /><main className="container grid min-h-[calc(100svh-4rem)] place-items-center py-12"><Card className="w-full max-w-md"><CardHeader><CardTitle>Şifremi unuttum</CardTitle><p className="text-sm text-muted-foreground">Kayıtlı e-posta adresinize 30 dakika geçerli güvenli bir bağlantı gönderilir.</p></CardHeader><CardContent><ForgotPasswordForm /><p className="mt-5 text-center text-sm"><Link className="font-medium text-primary" href="/login">Girişe dön</Link></p></CardContent></Card></main></>;
}
