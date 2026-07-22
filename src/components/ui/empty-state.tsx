import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, className }: { icon: LucideIcon; title: string; description: string; className?: string }) {
  return (
    <div className={cn("flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center", className)}>
      <Icon className="mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
