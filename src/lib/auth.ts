import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { authAudience, authCookieName, authIssuer, getAuthSecret } from "@/lib/auth-config";
import { isDemoMode } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";

export { authCookieName };

export type AuthSession = {
  kind: "staff";
  userId: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  branchId: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
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
    if (payload.kind !== "staff") return null;
    return payload as AuthSession;
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
        branchId: "branch_01"
      },
      "doctor@clinicnova.test": {
        kind: "staff",
        userId: "user_doctor",
        name: "Dr. Emir Aydın",
        email: "doctor@clinicnova.test",
        role: Role.DOCTOR,
        organizationId: "org_demo",
        branchId: "branch_01"
      },
      "receptionist@clinicnova.test": {
        kind: "staff",
        userId: "user_receptionist",
        name: "Seda Resepsiyon",
        email: "receptionist@clinicnova.test",
        role: Role.RECEPTIONIST,
        organizationId: "org_demo",
        branchId: "branch_01"
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
    branchId: user.branchId
  } satisfies AuthSession;
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  if (isDemoMode()) return session;
  const user = await prisma.user.findFirst({
    where: { id: session.userId, organizationId: session.organizationId, active: true },
    select: { name: true, email: true, role: true, branchId: true }
  });
  if (!user) redirect("/login?error=inactive");
  return { ...session, name: user.name, email: user.email, role: user.role, branchId: user.branchId } satisfies AuthSession;
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
