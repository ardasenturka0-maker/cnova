import { ArrowUpRight, Check, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DailyTask = {
  id: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  href: string;
};

const priorityMeta: Record<DailyTask["priority"], { label: string; variant: "muted" | "warning" | "danger" }> = {
  LOW: { label: "Düşük", variant: "muted" },
  MEDIUM: { label: "Normal", variant: "muted" },
  HIGH: { label: "Önemli", variant: "warning" },
  URGENT: { label: "Acil", variant: "danger" }
};

export function DailyClinicTodo({ tasks, completeAction }: { tasks: DailyTask[]; completeAction: (taskId: string) => Promise<void> }) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Bugünün klinik yapılacakları
          <Badge variant={tasks.length ? "warning" : "success"}>{tasks.length ? `${tasks.length} açık` : "Tamamlandı"}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Randevu, vadesi gelen ödeme, kritik stok ve açık tedaviler her gün otomatik kontrol edilir.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task) => {
          const priority = priorityMeta[task.priority];
          return (
            <div key={task.id} className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{task.title}</p>
                  <Badge variant={priority.variant}>{priority.label}</Badge>
                </div>
                {task.description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.description}</p> : null}
                <Link href={task.href} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">İlgili bölümü aç <ArrowUpRight className="h-3 w-3" /></Link>
              </div>
              <form action={completeAction.bind(null, task.id)}>
                <Button type="submit" size="sm" variant="outline" className="w-full border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300 sm:w-auto">
                  <Check className="h-4 w-4" />Yapıldı
                </Button>
              </form>
            </div>
          );
        })}
        {!tasks.length ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <Check className="mx-auto h-6 w-6 text-emerald-600" />
            <p className="mt-2 font-medium text-emerald-800 dark:text-emerald-200">Bugünün otomatik kontrol listesi tamamlandı.</p>
            <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">Yeni bir klinik durumu oluşursa liste otomatik güncellenir.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
