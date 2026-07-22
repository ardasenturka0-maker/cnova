import type { Metadata } from "next";
import "./globals.css";
import { MobileUpdateBanner } from "@/components/mobile-update-banner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { WebviewHeartbeat } from "@/components/providers/webview-heartbeat";
import { LocaleTextLayer } from "@/components/providers/locale-text-layer";
import { getLocale } from "@/lib/i18n-server";
import { MarketingFooter } from "@/components/landing/marketing-footer";

const metadataBase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "ClinicNova | Dental Growth OS",
    template: "%s | ClinicNova"
  },
  description: "Diş klinikleri için hasta, randevu, tedavi, tahsilat, stok ve ekip operasyonlarını tek akışta yöneten platform.",
  applicationName: "ClinicNova",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ClinicNova"
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "ClinicNova",
    title: "ClinicNova | Dental Growth OS",
    description: "Diş kliniğinizin hasta yolculuğunu ve gelir operasyonunu tek panelden yönetin."
  },
  other: {
    google: "notranslate"
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className="notranslate" translate="no" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">Ana içeriğe geç</a>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <WebviewHeartbeat />
          <LocaleTextLayer locale={locale} />
          <MobileUpdateBanner />
          {children}
          <MarketingFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
