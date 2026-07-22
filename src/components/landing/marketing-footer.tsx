"use client";

import { Activity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const hiddenPrefixes = ["/dashboard", "/portal", "/care-check", "/consent", "/survey", "/package"];

export function MarketingFooter() {
  const pathname = usePathname();
  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <footer className="border-t bg-card">
      <div className="container grid gap-8 py-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Link href="/" className="inline-flex rounded-md items-center gap-2 font-semibold" aria-label="ClinicNova ana sayfa">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </span>
            ClinicNova
          </Link>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            Diş klinikleri için hasta yolculuğu, klinik operasyon ve büyüme yönetimi. Tıbbi karar desteği sunmaz; klinik kararlar yetkili sağlık profesyonellerine aittir.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">© {new Date().getFullYear()} ClinicNova. Tüm hakları saklıdır.</p>
        </div>
        <nav aria-label="Yasal bağlantılar" className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
          <Link className="text-link" href="/privacy">Gizlilik</Link>
          <Link className="text-link" href="/terms">Kullanım koşulları</Link>
          <Link className="text-link" href="/security">Güvenlik</Link>
          <Link className="text-link" href="/contact">İletişim</Link>
        </nav>
      </div>
    </footer>
  );
}
