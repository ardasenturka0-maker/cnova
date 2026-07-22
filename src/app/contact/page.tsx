import { DemoRequestForm } from "@/components/forms/demo-request-form";
import { MarketingNav } from "@/components/landing/marketing-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <>
      <MarketingNav />
      <main className="container grid gap-8 py-14 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h1 className="text-4xl font-semibold tracking-normal">İletişim</h1>
          <p className="mt-4 text-lg text-muted-foreground">Klinik yapınızı, şube sayınızı ve öncelikli ihtiyaçlarınızı paylaşın; demo talebiniz kayıt altına alınsın.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Demo ve iletişim formu</CardTitle>
          </CardHeader>
          <CardContent>
            <DemoRequestForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
