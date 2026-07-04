import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { authCookieName, getAuthSecret } from "@/lib/auth-config";
import { isDemoMode } from "@/lib/demo-mode";
import { prisma } from "@/lib/prisma";

export { authCookieName };

export type AuthSession = {
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
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return payload as AuthSession;
  } catch {
    return null;
  }
}

export async function loginWithPassword(email: string, password: string) {
  if (isDemoMode() && password === "password123") {
    const demoUsers: Record<string, AuthSession> = {
      "owner@clinicnova.test": {
        userId: "user_owner",
        name: "Derya Nova",
        email: "owner@clinicnova.test",
        role: Role.CLINIC_OWNER,
        organizationId: "org_demo",
        branchId: "branch_01"
      },
      "doctor@clinicnova.test": {
        userId: "user_doctor",
        name: "Dr. Emir Aydın",
        email: "doctor@clinicnova.test",
        role: Role.DOCTOR,
        organizationId: "org_demo",
        branchId: "branch_01"
      },
      "receptionist@clinicnova.test": {
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
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    branchId: user.branchId
  } satisfies AuthSession;
}

export async function getCurrentSession() {
  const token = cookies().get(authCookieName)?.value;
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
  return session;
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
