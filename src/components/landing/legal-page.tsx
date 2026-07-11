import type { ReactNode } from "react";
import { MarketingNav } from "@/components/landing/marketing-nav";

export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="container max-w-4xl py-12 md:py-16">
        <p className="text-sm font-medium text-primary">ClinicNova</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Son güncelleme: {updatedAt}</p>
        <article className="legal-content mt-10 space-y-8 text-sm leading-7 text-muted-foreground">{children}</article>
      </main>
    </>
  );
}
