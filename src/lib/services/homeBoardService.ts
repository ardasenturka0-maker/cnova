import { randomUUID } from "node:crypto";
import { Role, TaskPriority, TaskStatus } from "@prisma/client";
import { clinicDateKey, clinicDayRange, clinicStartOfDay, parseClinicDateKey, parseClinicDateTime } from "@/lib/clinic-time";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/rbac";

const MANUAL_TODO_PREFIX = "manual-todo:";
const CALENDAR_NOTE_PREFIX = "organizer-note:";
const MAX_CALENDAR_NOTES = 750;

export type ManualTodo = { id: string; title: string; done: boolean; icon: string; detail: string };
export type CalendarNote = { id: string; dateKey: string; text: string; doctor: string | null };

export const MANUAL_TODO_ICONS = ["📌", "📅", "☎", "₺", "🦷", "💊", "🧾", "🧼", "📦", "🔔", "✅", "⚙️"];
function safeIcon(value: string | null | undefined) {
  return MANUAL_TODO_ICONS.includes(String(value)) ? String(value) : "📌";
}
function packMeta(icon: string, detail: string) {
  return JSON.stringify({ icon: safeIcon(icon), detail: detail.slice(0, 200) });
}
function unpackMeta(description: string | null): { icon: string; detail: string } {
  if (!description) return { icon: "📌", detail: "" };
  try {
    const parsed = JSON.parse(description);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { icon: safeIcon(parsed.icon), detail: typeof parsed.detail === "string" ? parsed.detail : "" };
    }
  } catch {
    /* Legacy rows stored the detail as plain text. */
  }
  return { icon: "📌", detail: String(description) };
}

/**
 * Manual to-dos and the agenda calendar reuse the existing Task table via a
 * sourceKey prefix so no schema migration is required. Manual to-dos are scoped
 * to a clinic day; calendar notes carry the target day in their dueDate.
 */
function scopeWhere(branchId?: string | null) {
  return branchId ? { branchId } : {};
}

function noonOf(dateKey: string) {
  return parseClinicDateTime(`${dateKey}T12:00`) ?? clinicStartOfDay(dateKey);
}

export async function getManualTodos(organizationId: string, branchId?: string | null, now = new Date()): Promise<ManualTodo[]> {
  const { from, to } = clinicDayRange(now);
  const rows = await prisma.task.findMany({
    where: {
      organizationId,
      ...scopeWhere(branchId),
      sourceKey: { startsWith: MANUAL_TODO_PREFIX },
      dueDate: { gte: from, lt: to }
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  return rows.map((row) => {
    const meta = unpackMeta(row.description);
    return { id: row.id, title: row.title, done: row.status === TaskStatus.DONE, icon: meta.icon, detail: meta.detail };
  });
}

export async function createManualTodo(organizationId: string, branchId: string | null, title: string, role: Role, icon = "📌", detail = "") {
  if (!canAccess(role, "reports") && !canAccess(role, "appointments")) throw new Error("Yetkisiz işlem.");
  const clean = title.trim().slice(0, 200);
  if (clean.length < 2) throw new Error("Yapılacak madde en az 2 karakter olmalıdır.");
  await prisma.task.create({
    data: {
      organizationId,
      branchId: branchId ?? null,
      sourceKey: `${MANUAL_TODO_PREFIX}${randomUUID()}`,
      title: clean,
      description: packMeta(icon, detail.trim()),
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: noonOf(clinicDateKey(new Date()))
    }
  });
}

export async function setManualTodoStatus(organizationId: string, taskId: string, done: boolean) {
  await prisma.task.updateMany({
    where: { id: taskId, organizationId, sourceKey: { startsWith: MANUAL_TODO_PREFIX } },
    data: { status: done ? TaskStatus.DONE : TaskStatus.TODO }
  });
}

export async function deleteManualTodo(organizationId: string, taskId: string) {
  await prisma.task.deleteMany({
    where: { id: taskId, organizationId, sourceKey: { startsWith: MANUAL_TODO_PREFIX } }
  });
}

export async function getCalendarNotes(organizationId: string, branchId?: string | null): Promise<CalendarNote[]> {
  const rows = await prisma.task.findMany({
    where: {
      organizationId,
      ...scopeWhere(branchId),
      sourceKey: { startsWith: CALENDAR_NOTE_PREFIX }
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: MAX_CALENDAR_NOTES
  });
  return rows
    .filter((row) => row.dueDate)
    .map((row) => ({
      id: row.id,
      dateKey: clinicDateKey(row.dueDate as Date),
      text: row.title,
      doctor: row.description ?? null
    }));
}

export async function createCalendarNote(organizationId: string, branchId: string | null, dateKey: string, text: string, doctor: string | null, role: Role) {
  if (!canAccess(role, "reports") && !canAccess(role, "appointments")) throw new Error("Yetkisiz işlem.");
  const key = parseClinicDateKey(dateKey);
  if (!key) throw new Error("Geçerli bir tarih seçin.");
  const clean = text.trim().slice(0, 500);
  if (clean.length < 2) throw new Error("Not en az 2 karakter olmalıdır.");
  await prisma.task.create({
    data: {
      organizationId,
      branchId: branchId ?? null,
      sourceKey: `${CALENDAR_NOTE_PREFIX}${randomUUID()}`,
      title: clean,
      description: doctor ? doctor.trim().slice(0, 160) : null,
      priority: TaskPriority.LOW,
      status: TaskStatus.TODO,
      dueDate: noonOf(key)
    }
  });
}

export async function deleteCalendarNote(organizationId: string, taskId: string) {
  await prisma.task.deleteMany({
    where: { id: taskId, organizationId, sourceKey: { startsWith: CALENDAR_NOTE_PREFIX } }
  });
}
