"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { localeCookieName, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const languages: Array<{ locale: Locale; label: string }> = [
  { locale: "tr", label: "TR" },
  { locale: "en", label: "EN" }
];

export function LanguageToggle({
  locale,
  label = "Dil",
  variant = "compact",
  className
}: {
  locale: Locale;
  label?: string;
  variant?: "compact" | "prominent";
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const changeLockedRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    changeLockedRef.current = false;
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  }, [locale]);

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
  }, []);

  function setLocale(nextLocale: Locale) {
    if (changeLockedRef.current || isPending || nextLocale === locale) return;

    changeLockedRef.current = true;
    unlockTimerRef.current = setTimeout(() => {
      changeLockedRef.current = false;
      unlockTimerRef.current = null;
    }, 2000);
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border bg-card p-1 shadow-sm",
        variant === "prominent" ? "h-12 gap-2 px-2" : "h-10",
        className
      )}
      aria-label={label}
    >
      {variant === "prominent" ? <span className="px-2 text-sm font-medium text-muted-foreground">{label}</span> : null}
      <div className="inline-flex items-center gap-1">
        {languages.map((language) => (
          <button
            key={language.locale}
            type="button"
            onClick={() => setLocale(language.locale)}
            className={cn(
              "rounded font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              variant === "prominent" ? "h-9 min-w-12 px-3 text-sm" : "h-8 min-w-9 px-2 text-xs",
              locale === language.locale ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            disabled={isPending || locale === language.locale}
            aria-pressed={locale === language.locale}
          >
            {language.label}
          </button>
        ))}
      </div>
    </div>
  );
}
