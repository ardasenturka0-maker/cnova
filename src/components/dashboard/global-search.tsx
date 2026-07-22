"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { shellText, type Locale } from "@/lib/i18n";

export function GlobalSearch({ locale = "tr" }: { locale?: Locale }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      className="relative min-w-0 flex-1 md:max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (trimmed) {
          router.push(`/dashboard/patients?q=${encodeURIComponent(trimmed)}`);
        }
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={shellText[locale].searchPlaceholder} />
    </form>
  );
}
