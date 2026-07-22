import { PrismaClient } from "@prisma/client";
import { isDemoMode } from "@/lib/demo-mode";
import { mockPrisma } from "@/lib/mock-prisma";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = isDemoMode()
  ? (mockPrisma as unknown as PrismaClient)
  : (globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
    }));

if (process.env.NODE_ENV !== "production" && !isDemoMode()) {
  globalForPrisma.prisma = prisma;
}
