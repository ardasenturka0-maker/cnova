"use client";

import { ArrowUpRight, Check, ClipboardCheck, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DailyTask = {
  id: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  href: string;
};

type ManualTodo = { id: string; title: string; done: boolean; icon: string; detail: string };

const MANUAL_TODO_ICONS = ["📌", "📅", "☎", "₺", "🦷", "💊", "🧾", "🧼", "📦", "🔔", "✅", "⚙️"];

const priorityMeta: Record<DailyTask["priority"], { label: string; variant: "muted" | "warning" | "danger" }> = {
  LOW: { label: "Düşük", variant: "muted" },
  MEDIUM: { label: "Normal", variant: "muted" },
  HIGH: { label: "Önemli", variant: "warning" },
  URGENT: { label: "Acil", variant: "danger" }
};

export function ClinicTodoBoard({
  tasks,
  manualTodos,
  completeAction,
  addManualAction,
  toggleManualAction,
  deleteManualAction
}: {
  tasks: DailyTask[];
  manualTodos: ManualTodo[];
  completeAction: (taskId: string) => Promise<void>;
  addManualAction: (title: string, icon: string, detail: string) => Promise<void>;
  toggleManualAction: (taskId: string, done: boolean) => Promise<void>;
  deleteManualAction: (taskId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [detail, setDetail] = useState("");
  const [icon, setIcon] = useState(MANUAL_TODO_ICONS[0]);
  const inputRef = useRef<HTMLInputElement>(null);
  const openCount = tasks.length + manualTodos.filter((todo) => !todo.done).length;

  function submitManual() {
    const value = draft.trim();
    if (value.length < 2 || pending) return;
    startTransition(async () => {
      await addManualAction(value, icon, detail.trim());
      setDraft("");
      setDetail("");
      setIcon(MANUAL_TODO_ICONS[0]);
      inputRef.current?.focus();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Bugünün klinik yapılacakları
          <Badge variant={openCount ? "warning" : "success"}>{openCount ? `${openCount} açık` : "Tamamlandı"}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Otomatik klinik kontrolleri her gün oluşturulur; sağdaki alandan kendi maddelerinizi de ekleyebilirsiniz.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 rounded-lg border border-dashed bg-muted/40 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitManual();
                }
              }}
              maxLength={200}
              placeholder="Yapılacak madde başlığı"
              aria-label="Yeni yapılacak maddesi"
            />
            <Button type="button" size="sm" className="gap-1 sm:w-auto" onClick={submitManual} disabled={pending || draft.trim().length < 2}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ekle
            </Button>
          </div>
          <Input
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            maxLength={200}
            placeholder="Detay (opsiyonel) — kısa açıklama"
            aria-label="Yapılacak maddesi detayı"
          />
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="İkon seç">
            {MANUAL_TODO_ICONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={icon === option}
                aria-label={`İkon ${option}`}
                onClick={() => setIcon(option)}
                className={`grid h-9 w-9 place-items-center rounded-md border text-lg transition ${icon === option ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "bg-background hover:bg-muted"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {manualTodos.map((todo) => (
          <div key={todo.id} className={`flex items-center gap-3 rounded-lg border p-3 ${todo.done ? "border-emerald-500/30 bg-emerald-500/5" : "bg-background"}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg ${todo.done ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10"}`}>{todo.icon}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${todo.done ? "text-muted-foreground line-through" : ""}`}>{todo.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{todo.detail || "Elle eklenen görev"}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={todo.done ? "default" : "outline"}
              aria-pressed={todo.done}
              aria-label={`${todo.title}: ${todo.done ? "yapılmadı olarak işaretle" : "yapıldı olarak işaretle"}`}
              onClick={() => startTransition(() => toggleManualAction(todo.id, !todo.done))}
              disabled={pending}
              className={todo.done ? "gap-1 bg-emerald-600 hover:bg-emerald-600/90" : "gap-1 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"}
            >
              <Check className="h-4 w-4" />
              Yapıldı
            </Button>
            <button
              type="button"
              aria-label={`${todo.title} maddesini kaldır`}
              onClick={() => startTransition(() => deleteManualAction(todo.id))}
              disabled={pending}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border text-muted-foreground transition hover:border-red-500 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

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

        {!tasks.length && !manualTodos.length ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
            <Check className="mx-auto h-6 w-6 text-emerald-600" />
            <p className="mt-2 font-medium text-emerald-800 dark:text-emerald-200">Bugünün klinik kontrol listesi tamamlandı.</p>
            <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">Yukarıdaki alandan yeni bir yapılacak maddesi ekleyebilirsiniz.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
