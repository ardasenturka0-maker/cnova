import { FeatureGrid } from "@/components/landing/feature-grid";
import { MarketingNav } from "@/components/landing/marketing-nav";

export default function FeaturesPage() {
  return (
    <>
      <MarketingNav />
      <main className="container py-14">
        <div className="mb-10 max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-normal">Özellikler</h1>
          <p className="mt-4 text-lg text-muted-foreground">Hasta deneyimini, klinik operasyonunu ve finansal görünürlüğü tek yönetim panelinde birleştiren modüller.</p>
        </div>
        <FeatureGrid />
      </main>
    </>
  );
}
