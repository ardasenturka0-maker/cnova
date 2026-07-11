import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { MarketingNav } from "@/components/landing/marketing-nav";
import { PricingCards } from "@/components/landing/pricing-cards";
import { ProductHero } from "@/components/landing/product-hero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { integrations, reasons } from "@/lib/marketing";

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main id="main-content">
        <ProductHero />
        <section className="container py-16">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-normal">Klinik operasyonunun tamamı</h2>
            <p className="mt-3 text-muted-foreground">ClinicNova; hasta takibinden raporlamaya kadar modern diş kliniklerinin günlük işlerini tek akışta toplar.</p>
          </div>
          <FeatureGrid />
        </section>
        <section className="border-y bg-card py-16">
          <div className="container grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-normal">Neden ClinicNova?</h2>
              <p className="mt-3 text-muted-foreground">Klinik operasyonu, hasta deneyimi ve gelir takibini güvenli, ölçülebilir bir sistemde birleştirir.</p>
            </div>
            <div className="grid gap-3">
              {reasons.map((reason) => (
                <div key={reason} className="flex items-center gap-3 rounded-lg border bg-background p-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="container py-16">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-normal">Entegrasyonlara hazır</h2>
              <p className="mt-3 text-muted-foreground">Sağlayıcıdan bağımsız entegrasyon katmanı; mesajlaşma, ödeme, e-belge ve otomasyon servislerine bağlanmaya hazırdır.</p>
            </div>
            <Link href="/integrations" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
              Tümünü Gör
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {integrations.map((integration) => (
              <div key={integration} className="rounded-lg border bg-card p-4 text-sm font-medium">
                {integration}
              </div>
            ))}
          </div>
        </section>
        <section className="border-t bg-card py-16">
          <div className="container">
            <div className="mb-8 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-normal">Klinik ölçeğine göre paketler</h2>
              <p className="mt-3 text-muted-foreground">Başlangıçtan çoklu şube yapısına kadar modüler limitler.</p>
            </div>
            <PricingCards />
          </div>
        </section>
      </main>
    </>
  );
}
