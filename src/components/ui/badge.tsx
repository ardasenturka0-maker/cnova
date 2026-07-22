import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "muted";

const variants: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/14 text-amber-800 dark:text-amber-300",
  danger: "bg-red-500/12 text-red-700 dark:text-red-300",
  muted: "bg-muted text-muted-foreground"
};

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium", variants[variant], className)} {...props} />;
}
