"use client";

import { useRouter } from "next/navigation";
import { localeCookieName, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const languages: Array<{ locale: Locale; label: string }> = [
  { locale: "tr", label: "TR" },
  { locale: "en", label: "EN" }
];

export function LanguageToggle({ locale, label = "Dil" }: { locale: Locale; label?: string }) {
  const router = useRouter();

  function setLocale(nextLocale: Locale) {
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="inline-flex h-10 items-center rounded-md border bg-card p-1" aria-label={label}>
      {languages.map((language) => (
        <button
          key={language.locale}
          type="button"
          onClick={() => setLocale(language.locale)}
          className={cn(
            "h-8 min-w-9 rounded px-2 text-xs font-semibold transition",
            locale === language.locale ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-pressed={locale === language.locale}
        >
          {language.label}
        </button>
      ))}
    </div>
  );
}
