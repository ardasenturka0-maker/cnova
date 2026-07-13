import { Activity } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shouldUseSecureCookies } from "@/lib/auth-config";
import { isDemoMode } from "@/lib/demo-mode";
import {
  createPatientSessionToken,
  findPatientForPortal,
  patientCookieName
} from "@/lib/patient-auth";
import { allowServerAction } from "@/lib/server-action-rate-limit";
import { portalLoginSchema } from "@/lib/validations/portal";

async function patientLoginAction(formData: FormData) {
  "use server";
  const parsed = portalLoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/portal/login?error=1");
  }
  if (!await allowServerAction("portal-login", 5, 15 * 60 * 1000)) redirect("/portal/login?error=rate");

  const patient = await findPatientForPortal(parsed.data.organizationSlug, parsed.data.phone, parsed.data.birthDate);
  if (!patient) {
    redirect("/portal/login?error=1");
  }

  const token = await createPatientSessionToken({
    kind: "patient",
    patientId: patient.id,
    name: `${patient.firstName} ${patient.lastName}`,
    organizationId: patient.organizationId,
    branchId: patient.branchId
  });

  const cookieStore = await cookies();
  cookieStore.set(patientCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    priority: "high",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  redirect("/portal");
}

export default async function PortalLoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-tight">ClinicNova</p>
            <p className="text-xs text-muted-foreground">Hasta Portalı</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Hasta Girişi</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={patientLoginAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organizationSlug">Klinik kodu</Label>
                <Input id="organizationSlug" name="organizationSlug" placeholder="ornek-klinik" defaultValue={isDemoMode() ? "nova-dental-demo" : ""} autoComplete="organization" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon numaranız</Label>
                <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="+90 5xx xxx xx xx" autoComplete="tel" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Doğum tarihiniz</Label>
                <Input id="birthDate" name="birthDate" type="date" required />
              </div>
              {searchParams.error ? (
                <p className="text-sm text-destructive">{searchParams.error === "rate" ? "Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin." : searchParams.error === "inactive" ? "Hasta hesabı aktif değil." : "Klinik kodu, telefon veya doğum tarihi eşleşmedi."}</p>
              ) : null}
              <Button className="w-full" type="submit">Giriş Yap</Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              İlk kez mi geliyorsunuz?{" "}
              <Link className="font-medium text-primary" href="/portal/register">
                Kayıt Ol
              </Link>
            </p>
            {isDemoMode() ? (
              <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Demo giriş: <span className="font-medium">nova-dental-demo · +90 532 555 1000 · 10.01.1985</span> (Ayşe Yılmaz)
              </p>
            ) : null}
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Klinik çalışanı mısınız? <Link className="text-primary underline-offset-2 hover:underline" href="/login">Klinik girişi</Link>
        </p>
      </div>
    </div>
  );
}
