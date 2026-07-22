"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CalendarNote = { id: string; dateKey: string; text: string; doctor: string | null };

const pad = (value: number) => String(value).padStart(2, "0");
const keyOf = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const monthLabel = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", month: "long", year: "numeric" });
const dayLabel = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1, 12));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(year, month, 1 - mondayOffset + index, 12)));
}

export function CalendarOrganizer({
  notes,
  doctors,
  todayKey,
  addAction,
  deleteAction
}: {
  notes: CalendarNote[];
  doctors: string[];
  todayKey: string;
  addAction: (dateKey: string, text: string, doctor: string) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}) {
  const [year, month, day] = todayKey.split("-").map(Number);
  const [view, setView] = useState({ year, month: month - 1 });
  const [selected, setSelected] = useState(todayKey);
  const [text, setText] = useState("");
  const [doctor, setDoctor] = useState("");
  const [pending, startTransition] = useTransition();

  const notesByDay = useMemo(() => {
    const map = new Map<string, CalendarNote[]>();
    for (const note of notes) {
      const list = map.get(note.dateKey) ?? [];
      list.push(note);
      map.set(note.dateKey, list);
    }
    return map;
  }, [notes]);

  const grid = monthGrid(view.year, view.month);
  const monthFirst = new Date(Date.UTC(view.year, view.month, 1, 12));
  const selectedNotes = notesByDay.get(selected) ?? [];
  const selectedDate = new Date(Date.UTC(Number(selected.split("-")[0]), Number(selected.split("-")[1]) - 1, Number(selected.split("-")[2]), 12));

  function shiftMonth(step: number) {
    setView((current) => {
      const next = new Date(Date.UTC(current.year, current.month + step, 1, 12));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  function submitNote() {
    const value = text.trim();
    if (value.length < 2 || pending) return;
    startTransition(async () => {
      await addAction(selected, value, doctor);
      setText("");
      setDoctor("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-accent" />
          Klinik takvimi & ajanda
        </CardTitle>
        <p className="text-sm text-muted-foreground">Her güne hekim çalışma yeri, saatler ve klinik notları ekleyin; günlük gibi kullanın.</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => shiftMonth(-1)} className="grid h-8 w-8 place-items-center rounded-md border hover:bg-muted" aria-label="Önceki ay">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <strong className="text-sm capitalize">{monthLabel.format(monthFirst)}</strong>
              <button type="button" onClick={() => shiftMonth(1)} className="grid h-8 w-8 place-items-center rounded-md border hover:bg-muted" aria-label="Sonraki ay">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {grid.map((date) => {
                const key = keyOf(date);
                const outside = date.getUTCMonth() !== view.month;
                const count = notesByDay.get(key)?.length ?? 0;
                const isSelected = key === selected;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    aria-label={`${dayLabel.format(date)}${count ? `, ${count} not` : ""}`}
                    className={`relative grid h-10 place-items-center rounded-md border text-sm transition ${
                      isSelected ? "border-primary bg-primary text-primary-foreground" : isToday ? "border-primary/50" : "border-transparent hover:bg-muted"
                    } ${outside ? "text-muted-foreground/40" : ""}`}
                  >
                    <span>{date.getUTCDate()}</span>
                    {count ? <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-accent"}`} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-baseline justify-between gap-3">
              <strong className="text-sm capitalize">{dayLabel.format(selectedDate)}</strong>
              <span className="text-xs text-muted-foreground">{selectedNotes.length ? `${selectedNotes.length} not` : "Not yok"}</span>
            </div>

            <div className="mt-3 space-y-2">
              {selectedNotes.map((note) => (
                <div key={note.id} className="flex items-start gap-3 rounded-lg border border-l-4 border-l-accent bg-muted/40 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed">{note.text}</p>
                    {note.doctor ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{note.doctor}</p> : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Notu kaldır"
                    onClick={() => startTransition(() => deleteAction(note.id))}
                    disabled={pending}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md border text-muted-foreground transition hover:border-red-500 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!selectedNotes.length ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Bu güne henüz not eklenmedi. Aşağıdan ekleyin.</p>
              ) : null}
            </div>

            <div className="mt-3 space-y-2 rounded-lg border border-dashed bg-background p-3">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Örn. Dr. Lara Er bugün İzmir şubesinde 10:00-16:00 arası çalışıyor"
                aria-label="Takvim notu"
                className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                {doctors.length ? (
                  <select
                    value={doctor}
                    onChange={(event) => setDoctor(event.target.value)}
                    aria-label="İlgili hekim"
                    className="h-9 flex-1 rounded-md border bg-transparent px-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Genel not</option>
                    {doctors.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : null}
                <Button type="button" size="sm" className="gap-1" onClick={submitNote} disabled={pending || text.trim().length < 2}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Notu kaydet
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
