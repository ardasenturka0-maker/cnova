import { createHash, randomBytes } from "node:crypto";
import { emailProvider } from "@/lib/integrations/emailProvider";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.active) return { accepted: true };

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] }
  });

  const token = randomBytes(32).toString("base64url");
  const reset = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    }
  });

  const baseUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const resetUrl = new URL("/reset-password", baseUrl);
  resetUrl.searchParams.set("token", token);
  const delivery = await emailProvider.send({
    to: user.email,
    subject: "ClinicNova şifre yenileme",
    message: `Şifrenizi 30 dakika içinde yenilemek için bu bağlantıyı açın: ${resetUrl.toString()}`
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: delivery.ok ? "PASSWORD_RESET_REQUESTED" : "PASSWORD_RESET_DELIVERY_FAILED",
      module: "auth",
      organizationId: user.organizationId,
      branchId: user.branchId,
      metadata: { provider: delivery.provider }
    }
  });

  if (!delivery.ok) {
    await prisma.passwordResetToken.deleteMany({ where: { id: reset.id } });
  }
  return { accepted: true };
}

export async function resetPassword(token: string, password: string) {
  const reset = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: tokenHash(token), usedAt: null, expiresAt: { gt: new Date() } }
  });
  if (!reset) return false;

  const user = await prisma.user.findFirst({ where: { id: reset.userId, active: true } });
  if (!user) return false;
  const passwordHash = await hashPassword(password);

  const changed = await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });
    if (consumed.count !== 1) return false;
    await transaction.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });
    await transaction.user.update({ where: { id: user.id }, data: { passwordHash } });
    await transaction.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_COMPLETED",
        module: "auth",
        organizationId: user.organizationId,
        branchId: user.branchId
      }
    });
    return true;
  });
  return changed;
}
