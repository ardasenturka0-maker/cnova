import { Activity } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HealthQuestions } from "@/components/portal/health-questions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shouldUseSecureCookies } from "@/lib/auth-config";
import { createPatientSessionToken, patientCookieName } from "@/lib/patient-auth";
import { registerPortalPatient } from "@/lib/services/portalService";
import { allowServerAction } from "@/lib/server-action-rate-limit";
import { isDemoMode } from "@/lib/demo-mode";
import { portalRegisterSchema } from "@/lib/validations/portal";

async function patientRegisterAction(formData: FormData) {
  "use server";
  const parsed = portalRegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/portal/register?error=form");
  }
  if (!await allowServerAction("portal-register", 3, 60 * 60 * 1000)) redirect("/portal/register?error=rate");

  let result;
  try {
    result = await registerPortalPatient(parsed.data);
  } catch {
    redirect("/portal/register?error=clinic");
  }
  if (result.conflict) {
    redirect("/portal/register?error=exists");
  }

  const token = await createPatientSessionToken({
    kind: "patient",
    patientId: result.patient.id,
    name: `${result.patient.firstName} ${result.patient.lastName}`,
    organizationId: result.patient.organizationId,
    branchId: result.patient.branchId
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

const errors: Record<string, string> = {
  form: "Lütfen zorunlu alanları kontrol edin.",
  exists: "Bu telefon numarasıyla zaten bir kayıt var. Giriş yapabilirsiniz.",
  clinic: "Klinik kodu bulunamadı.",
  rate: "Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin."
};

export default async function PortalRegisterPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const error = searchParams.error ? errors[searchParams.error] : null;

  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-4 py-8">
      <div className="w-full max-w-md space-y-4">
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
            <CardTitle>Hasta Kaydı</CardTitle>
            <p className="text-sm text-muted-foreground">Bilgileriniz ve sağlık geçmişiniz, kliniğin size güvenli hizmet verebilmesi için kaydedilir.</p>
          </CardHeader>
          <CardContent>
            <form action={patientRegisterAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organizationSlug">Klinik kodu</Label>
                <Input id="organizationSlug" name="organizationSlug" placeholder="ornek-klinik" defaultValue={isDemoMode() ? "nova-dental-demo" : ""} autoComplete="organization" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Ad</Label>
                  <Input id="firstName" name="firstName" autoComplete="given-name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Soyad</Label>
                  <Input id="lastName" name="lastName" autoComplete="family-name" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon numaranız</Label>
                <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="+90 5xx xxx xx xx" autoComplete="tel" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta (opsiyonel)</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Doğum tarihi</Label>
                  <Input id="birthDate" name="birthDate" type="date" required />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-semibold">Sağlık bilgileriniz</p>
                <HealthQuestions />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button className="w-full" type="submit">Kayıt Ol</Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Zaten kayıtlı mısınız? <Link className="text-primary underline-offset-2 hover:underline" href="/portal/login">Giriş yapın</Link>
        </p>
      </div>
    </div>
  );
}
