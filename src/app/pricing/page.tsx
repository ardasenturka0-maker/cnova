import { MarketingNav } from "@/components/landing/marketing-nav";
import { PricingCards } from "@/components/landing/pricing-cards";

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="container py-14">
        <div className="mb-10 max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-normal">Fiyatlandırma</h1>
          <p className="mt-4 text-lg text-muted-foreground">Kullanıcı, doktor, şube ve entegrasyon limitlerine göre ölçeklenebilen paketler.</p>
        </div>
        <PricingCards />
      </main>
    </>
  );
}
