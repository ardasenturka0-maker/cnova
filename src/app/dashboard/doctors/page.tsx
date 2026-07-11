import { Stethoscope } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getDashboardMetrics } from "@/lib/services/reportService";
import { formatCurrency } from "@/lib/utils";

export default async function DoctorsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const [profiles, metrics] = await Promise.all([
    prisma.doctorProfile.findMany({
      where: { staff: { organizationId: session.organizationId } },
      include: { staff: { include: { branch: true } } },
      orderBy: { createdAt: "asc" }
    }),
    getDashboardMetrics(session.organizationId)
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Stethoscope} title="Hekim Yönetimi" description="Randevu sayısı, tamamlanan tedavi, üretilen gelir, memnuniyet ve haftalık takvim." />
      <div className="grid gap-4 lg:grid-cols-2">
        {profiles.map((profile) => {
          const performance = metrics.doctorPerformance.find((item) => item.name === profile.staff.fullName);
          return (
            <Card key={profile.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{profile.staff.fullName}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{profile.specialty} · {profile.staff.branch.name}</p>
                  </div>
                  <Badge variant="success">{Number(profile.satisfactionScore).toFixed(1)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Randevu</p><p className="text-xl font-semibold">{performance?.appointments ?? 0}</p></div>
                <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Tedavi</p><p className="text-xl font-semibold">{performance?.treatments ?? 0}</p></div>
                <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Gelir</p><p className="text-xl font-semibold">{formatCurrency(performance?.revenue ?? 0, locale)}</p></div>
                <div className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">Oda</p><p className="text-xl font-semibold">{profile.room ?? "-"}</p></div>
                <div className="rounded-md border bg-background p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Haftalık takvim</p><pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(profile.weeklySchedule, null, 2)}</pre></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
