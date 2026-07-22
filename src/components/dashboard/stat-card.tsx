import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "primary"
}: {
  title: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "warning";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-500/12 text-amber-700 dark:text-amber-300"
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-md", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 break-words text-2xl font-semibold">{value}</p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
