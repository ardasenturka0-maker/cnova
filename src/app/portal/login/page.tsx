import { Activity } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoMode } from "@/lib/demo-mode";
import {
  createPatientSessionToken,
  findPatientByPhone,
  patientCookieName
} from "@/lib/patient-auth";
import { portalLoginSchema } from "@/lib/validations/portal";

async function patientLoginAction(formData: FormData) {
  "use server";
  const parsed = portalLoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/portal/login?error=1");
  }

  const patient = await findPatientByPhone(parsed.data.phone);
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

  cookies().set(patientCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  redirect("/portal");
}

export default function PortalLoginPage({ searchParams }: { searchParams: { error?: string } }) {
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
                <Label htmlFor="phone">Telefon numaranız</Label>
                <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="+90 5xx xxx xx xx" autoComplete="tel" required />
              </div>
              {searchParams.error ? (
                <p className="text-sm text-destructive">Bu telefon numarasıyla kayıtlı hasta bulunamadı.</p>
              ) : null}
              <Button className="w-full" type="submit">Giriş Yap</Button>
            </form>
            {isDemoMode() ? (
              <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Demo giriş: <span className="font-medium">+90 532 555 1000</span> (Ayşe Yılmaz)
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
