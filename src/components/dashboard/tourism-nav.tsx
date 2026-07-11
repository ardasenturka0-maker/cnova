import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { tourismRoutes } from "@/lib/tourism";

export async function TourismNav() {
  const locale = await getLocale();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tourismRoutes(locale).map((item) => (
        <Link key={item.href} href={item.href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </div>
  );
}
