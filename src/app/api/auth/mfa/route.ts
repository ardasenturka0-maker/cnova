import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentSession, verifyPassword } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";
import { buildOtpauthUri, createMfaSecret, createRecoveryCodes, decryptMfaSecret, encryptMfaSecret, hashRecoveryCode, verifyTotp } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { requestClientId, takeRateLimit } from "@/lib/rate-limit";

function mutationError(request: Request, userId: string) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "Çapraz site isteği reddedildi." }, { status: 403 });
  if (!takeRateLimit({ key: `auth:mfa:${userId}:${requestClientId(request)}`, limit: 10, windowMs: 10 * 60 * 1000 }).allowed) {
    return NextResponse.json({ error: "Çok fazla MFA isteği." }, { status: 429 });
  }
  return null;
}

async function currentUser() {
  const session = await getCurrentSession();
  if (!session || isDemoMode()) return null;
  const user = await prisma.user.findFirst({
    where: { id: session.userId, organizationId: session.organizationId, active: true },
    include: { organization: { select: { name: true } } }
  });
  return user ? { session, user } : null;
}

export async function GET() {
  const current = await currentUser();
  if (!current) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  return NextResponse.json({ enabled: Boolean(current.user.mfaEnabledAt) });
}

export async function POST(request: Request) {
  const current = await currentUser();
  if (!current) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const blocked = mutationError(request, current.user.id); if (blocked) return blocked;
  if (current.user.mfaEnabledAt) return NextResponse.json({ error: "2FA zaten etkin. Önce mevcut 2FA’yı doğrulayarak kapatın." }, { status: 409 });
  const body = await request.json().catch(() => ({})) as { password?: unknown };
  if (!await verifyPassword(String(body.password ?? ""), current.user.passwordHash)) return NextResponse.json({ error: "Şifre hatalı." }, { status: 401 });
  const secret = createMfaSecret();
  const uri = buildOtpauthUri(secret, current.user.email, current.user.organization.name);
  await prisma.user.update({
    where: { id: current.user.id },
    data: {
      mfaPendingSecretEncrypted: encryptMfaSecret(secret),
      mfaPendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });
  return NextResponse.json({ secret, qrCode: await QRCode.toDataURL(uri, { width: 240, margin: 1, errorCorrectionLevel: "M" }) });
}

export async function PUT(request: Request) {
  const current = await currentUser();
  if (!current) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const blocked = mutationError(request, current.user.id); if (blocked) return blocked;
  const code = String((await request.json() as { code?: unknown }).code ?? "");
  if (!current.user.mfaPendingSecretEncrypted || !current.user.mfaPendingExpiresAt || current.user.mfaPendingExpiresAt <= new Date()) {
    return NextResponse.json({ error: "Kurulum süresi doldu. Yeniden başlatın." }, { status: 400 });
  }
  const encrypted = current.user.mfaPendingSecretEncrypted;
  const counter = verifyTotp(decryptMfaSecret(encrypted), code);
  if (counter === null) return NextResponse.json({ error: "Doğrulama kodu geçersiz." }, { status: 400 });
  const recoveryCodes = createRecoveryCodes();
  await prisma.user.update({
    where: { id: current.user.id },
    data: {
      mfaSecretEncrypted: encrypted,
      mfaEnabledAt: new Date(),
      mfaRecoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
      mfaLastUsedCounter: counter,
      mfaPendingSecretEncrypted: null,
      mfaPendingExpiresAt: null
    }
  });
  await writeAuditLog({ userId: current.user.id, action: "ENABLE_MFA", module: "auth", organizationId: current.session.organizationId, branchId: current.session.branchId });
  return NextResponse.json({ recoveryCodes });
}

export async function DELETE(request: Request) {
  const current = await currentUser();
  if (!current) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const blocked = mutationError(request, current.user.id); if (blocked) return blocked;
  if (!current.user.mfaEnabledAt || !current.user.mfaSecretEncrypted) return NextResponse.json({ error: "2FA etkin değil." }, { status: 400 });
  const body = await request.json() as { password?: unknown; code?: unknown };
  if (!await verifyPassword(String(body.password ?? ""), current.user.passwordHash)) return NextResponse.json({ error: "Şifre hatalı." }, { status: 401 });
  const counter = verifyTotp(decryptMfaSecret(current.user.mfaSecretEncrypted), String(body.code ?? ""));
  if (counter === null || counter <= current.user.mfaLastUsedCounter) return NextResponse.json({ error: "Doğrulama kodu geçersiz veya daha önce kullanılmış." }, { status: 401 });
  const consumed = await prisma.user.updateMany({ where: { id: current.user.id, mfaLastUsedCounter: { lt: counter } }, data: { mfaLastUsedCounter: counter } });
  if (consumed.count !== 1) return NextResponse.json({ error: "Doğrulama kodu daha önce kullanılmış." }, { status: 401 });
  await prisma.user.update({
    where: { id: current.user.id },
    data: { mfaSecretEncrypted: null, mfaEnabledAt: null, mfaRecoveryCodeHashes: Prisma.JsonNull, mfaLastUsedCounter: -1 }
  });
  await writeAuditLog({ userId: current.user.id, action: "DISABLE_MFA", module: "auth", organizationId: current.session.organizationId, branchId: current.session.branchId });
  return NextResponse.json({ enabled: false });
}
