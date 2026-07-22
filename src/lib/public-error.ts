import { ZodError } from "zod";

function isInfrastructureError(error: Error) {
  return error.name.startsWith("PrismaClient")
    || /\bP\d{4}\b/.test(error.message)
    || error.message.includes("Invalid `prisma.")
    || error.message.includes("database error")
    || error.message.includes("ECONN");
}

/** Keep validation/domain feedback useful without exposing database or network internals. */
export function publicErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return error.issues[0]?.message || fallback;
  if (!(error instanceof Error) || isInfrastructureError(error)) return fallback;
  const message = error.message.trim();
  return message && message.length <= 500 ? message : fallback;
}
