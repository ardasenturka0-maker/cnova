/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { BeforeAfterStatus } from "@prisma/client";
import { MarketingNav } from "@/components/landing/marketing-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function PublicShowcasePage(props: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await props.params;
  const organization = await prisma.organization.findFirst({ where: { slug: organizationSlug } });
  if (!organization) notFound();

  const cases = await prisma.beforeAfterCase.findMany({
    where: { organizationId: organization.id, status: BeforeAfterStatus.PUBLISHED_WEBSITE, consentGiven: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <>
      <MarketingNav />
      <main className="container py-12">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-medium text-primary">{organization.name}</p>
          <h1 className="mt-2 text-4xl font-semibold">Önce / Sonra Vakaları</h1>
          <p className="mt-3 text-muted-foreground">Yayın onamı doğrulanmış klinik vaka örnekleri. Sonuçlar kişiden kişiye değişebilir.</p>
        </div>
        {cases.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cases.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.treatmentType} · {item.country ?? "-"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <figure><img className="aspect-[4/3] w-full rounded-md border object-cover" src={item.beforeImageUrl} alt={`${item.title} tedavi öncesi`} /><figcaption className="mt-1 text-xs text-muted-foreground">Öncesi</figcaption></figure>
                    <figure><img className="aspect-[4/3] w-full rounded-md border object-cover" src={item.afterImageUrl} alt={`${item.title} tedavi sonrası`} /><figcaption className="mt-1 text-xs text-muted-foreground">Sonrası</figcaption></figure>
                  </div>
                  {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                  <div className="flex flex-wrap gap-2"><Badge>{item.treatmentType}</Badge>{item.ageRange ? <Badge variant="muted">Yaş {item.ageRange}</Badge> : null}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : <p className="rounded-md border bg-card p-6 text-muted-foreground">Henüz yayınlanmış vaka bulunmuyor.</p>}
      </main>
    </>
  );
}
