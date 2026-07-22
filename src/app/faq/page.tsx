import { MarketingNav } from "@/components/landing/marketing-nav";
import { Card, CardContent } from "@/components/ui/card";
import { faqs } from "@/lib/marketing";

export default function FaqPage() {
  return (
    <>
      <MarketingNav />
      <main className="container py-14">
        <div className="mb-10 max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-normal">Sık Sorulan Sorular</h1>
          <p className="mt-4 text-lg text-muted-foreground">Kurulum, güvenlik, veri aktarımı, mobil kullanım ve destek süreci hakkında kısa cevaplar.</p>
        </div>
        <div className="grid gap-4">
          {faqs.map(([question, answer]) => (
            <Card key={question}>
              <CardContent className="p-5">
                <h2 className="font-semibold">{question}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
