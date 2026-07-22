import "server-only";

import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { authAudience, authCookieName, authIssuer, getAuthSecret } from "@/lib/auth-config";
import { isDemoMode } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";
import { canAccess, type ModuleKey } from "@/lib/rbac";
import { verifyPassword } from "@/lib/password";

export { authCookieName };

export type AuthSession = {
  kind: "staff";
  userId: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  branchId: string | null;
  credentialVersion: string;
};

function credentialVersion(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("base64url");
}

export async function createSessionToken(session: AuthSession) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(authIssuer)
    .setAudience(authAudience)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      issuer: authIssuer,
      audience: authAudience
    });
    const validRole = typeof payload.role === "string" && (Object.values(Role) as string[]).includes(payload.role);
    if (
      payload.kind !== "staff"
      || typeof payload.userId !== "string"
      || typeof payload.name !== "string"
      || typeof payload.email !== "string"
      || !validRole
      || typeof payload.organizationId !== "string"
      || (payload.branchId !== null && typeof payload.branchId !== "string")
      || typeof payload.credentialVersion !== "string"
    ) return null;
    return {
      kind: "staff",
      userId: payload.userId,
      name: payload.name,
      email: payload.email,
      role: payload.role as Role,
      organizationId: payload.organizationId,
      branchId: payload.branchId,
      credentialVersion: payload.credentialVersion
    };
  } catch {
    return null;
  }
}

export async function loginWithPassword(email: string, password: string) {
  if (isDemoMode() && password === "password123") {
    const demoUsers: Record<string, AuthSession> = {
      "owner@clinicnova.test": {
        kind: "staff",
        userId: "user_owner",
        name: "Derya Nova",
        email: "owner@clinicnova.test",
        role: Role.CLINIC_OWNER,
        organizationId: "org_demo",
        branchId: "branch_01",
        credentialVersion: "demo"
      },
      "doctor@clinicnova.test": {
        kind: "staff",
        userId: "user_doctor",
        name: "Dr. Emir Aydın",
        email: "doctor@clinicnova.test",
        role: Role.DOCTOR,
        organizationId: "org_demo",
        branchId: "branch_01",
        credentialVersion: "demo"
      },
      "receptionist@clinicnova.test": {
        kind: "staff",
        userId: "user_receptionist",
        name: "Seda Resepsiyon",
        email: "receptionist@clinicnova.test",
        role: Role.RECEPTIONIST,
        organizationId: "org_demo",
        branchId: "branch_01",
        credentialVersion: "demo"
      }
    };
    return demoUsers[email.toLowerCase()] ?? null;
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { organization: true }
  });

  if (!user || !user.active) {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return {
    kind: "staff",
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    branchId: user.branchId,
    credentialVersion: credentialVersion(user.passwordHash)
  } satisfies AuthSession;
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value;
  if (!token) {
    return null;
  }
  const session = await verifySessionToken(token);
  if (!session || isDemoMode()) return session;

  const user = await prisma.user.findFirst({
    where: { id: session.userId, organizationId: session.organizationId, active: true },
    select: { name: true, email: true, role: true, branchId: true, passwordHash: true }
  });
  if (!user || credentialVersion(user.passwordHash) !== session.credentialVersion) return null;
  return {
    ...session,
    name: user.name,
    email: user.email,
    role: user.role,
    branchId: user.branchId
  } satisfies AuthSession;
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireModuleAccess(module: ModuleKey) {
  const session = await requireSession();
  if (!canAccess(session.role, module)) redirect("/dashboard?error=forbidden");
  return session;
}

export function canManageTrash(role: Role) {
  return role === Role.CLINIC_OWNER || role === Role.MANAGER;
}

export function canDeletePatientFile(role: Role) {
  return canManageTrash(role) || role === Role.DOCTOR;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  if (isDemoMode()) {
    return {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      organizationId: session.organizationId,
      branchId: session.branchId,
      organization: { name: "Nova Dental Demo", plan: "Kurumsal" },
      branch: { name: "Nişantaşı Klinik" }
    };
  }

  return prisma.user.findFirst({
    where: {
      id: session.userId,
      organizationId: session.organizationId,
      active: true
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      branchId: true,
      organization: { select: { name: true, plan: true } },
      branch: { select: { name: true } }
    }
  });
}
