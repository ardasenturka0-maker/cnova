export const clinicTimeZone = "Europe/Istanbul";

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function clinicDateTimeParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: clinicTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second")
  };
}

export function parseClinicDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() !== Number(month) - 1
    || parsed.getUTCDate() !== Number(day)
  ) return null;
  return value;
}

/**
 * Browser `datetime-local` values do not contain an offset. ClinicNova's mobile
 * clients and operational screens use Europe/Istanbul, so parsing such a value
 * with the server's local timezone would move appointments when production runs
 * in a UTC container. Explicit-offset ISO values remain supported for API clients.
 */
export function parseClinicDateTime(value: string) {
  const normalized = value.trim();
  const local = localDateTimePattern.exec(normalized);
  if (!local) {
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)) return null;
    const explicit = new Date(normalized);
    return Number.isNaN(explicit.getTime()) ? null : explicit;
  }

  const [, year, month, day, hour, minute, second = "00"] = local;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+03:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const roundTrip = clinicDateTimeParts(parsed);
  if (
    roundTrip.year !== year
    || roundTrip.month !== month
    || roundTrip.day !== day
    || roundTrip.hour !== hour
    || roundTrip.minute !== minute
    || roundTrip.second !== second
  ) return null;

  return parsed;
}

export function clinicDateKey(value: Date) {
  if (Number.isNaN(value.getTime())) throw new Error("Geçersiz klinik tarihi.");
  const parts = clinicDateTimeParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addClinicDateKey(value: string, days: number) {
  const key = parseClinicDateKey(value);
  if (!key || !Number.isInteger(days)) throw new Error("Geçersiz klinik tarihi.");
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function shiftClinicMonth(value: string, months: number) {
  const key = parseClinicDateKey(value);
  if (!key || !Number.isInteger(months)) throw new Error("Geçersiz klinik tarihi.");
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Add calendar months while preserving the requested day when possible. */
export function addClinicMonths(value: string, months: number) {
  const key = parseClinicDateKey(value);
  if (!key || !Number.isInteger(months)) throw new Error("Geçersiz klinik tarihi.");
  const [year, month, day] = key.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function clinicStartOfDay(value: Date | string) {
  const key = typeof value === "string" ? parseClinicDateKey(value) : clinicDateKey(value);
  if (!key) throw new Error("Geçersiz klinik tarihi.");
  const start = parseClinicDateTime(`${key}T00:00`);
  if (!start) throw new Error("Geçersiz klinik tarihi.");
  return start;
}

export function clinicDayRange(value: Date | string) {
  const key = typeof value === "string" ? parseClinicDateKey(value) : clinicDateKey(value);
  if (!key) throw new Error("Geçersiz klinik tarihi.");
  return {
    from: clinicStartOfDay(key),
    to: clinicStartOfDay(addClinicDateKey(key, 1))
  };
}

/** Calendar-day comparison for due dates; a payment due today is not overdue. */
export function isClinicDateOverdue(dueDate: Date, now = new Date()) {
  return clinicDateKey(dueDate) < clinicDateKey(now);
}

export function isReasonableBirthDate(value: string, now = new Date()) {
  const key = parseClinicDateKey(value);
  return Boolean(key && key >= "1900-01-01" && key <= clinicDateKey(now));
}
