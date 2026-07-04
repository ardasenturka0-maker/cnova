import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { WebviewHeartbeat } from "@/components/providers/webview-heartbeat";
import { LocaleTextLayer } from "@/components/providers/locale-text-layer";
import { getLocale } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "ClinicNova | Diş Kliniği Yönetim Platformu",
  description: "Diş klinikleri için hasta, randevu, tedavi, finans, stok ve raporlama yönetimi."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <WebviewHeartbeat />
          <LocaleTextLayer locale={locale} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
