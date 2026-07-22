import type { TreatmentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { statusLabel, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const statusMeta: Record<TreatmentStatus, { className: string }> = {
  PROPOSED: {
    className: "border border-sky-500/25 bg-sky-500/12 text-sky-700 dark:text-sky-300"
  },
  ACCEPTED: {
    className: "border border-indigo-500/25 bg-indigo-500/12 text-indigo-700 dark:text-indigo-300"
  },
  STARTED: {
    className: "border border-amber-500/30 bg-amber-500/14 text-amber-800 dark:text-amber-300"
  },
  COMPLETED: {
    className: "border border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
  },
  CANCELLED: {
    className: "border border-red-500/30 bg-red-500/12 text-red-700 dark:text-red-300"
  }
};

export function TreatmentStatusBadge({ status, className, locale = "tr" }: { status: TreatmentStatus | string; className?: string; locale?: Locale }) {
  const meta = statusMeta[status as TreatmentStatus] ?? {
    className: "border bg-muted text-muted-foreground"
  };

  return (
    <Badge variant="muted" className={cn("font-semibold", meta.className, className)}>
      {statusLabel(status, locale)}
    </Badge>
  );
}
