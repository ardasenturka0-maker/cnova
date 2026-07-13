import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authAudience, authIssuer, getAuthSecret } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

export const patientCookieName = "clinicnova_patient_session";

export type PatientSession = {
  kind: "patient";
  patientId: string;
  name: string;
  organizationId: string;
  branchId: string;
};

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

export async function findPatientByPhone(phone: string) {
  const digits = normalizePhone(phone);
  if (digits.length < 7) return null;

  const patients = await prisma.patient.findMany({ where: { deletedAt: null }, take: 500 });
  return patients.find((patient) => normalizePhone(patient.phone) === digits) ?? null;
}

export async function createPatientSessionToken(session: PatientSession) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(authIssuer)
    .setAudience(authAudience)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getAuthSecret());
}

export async function verifyPatientSessionToken(token: string): Promise<PatientSession | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      issuer: authIssuer,
      audience: authAudience
    });
    if (payload.kind !== "patient") return null;
    return payload as PatientSession;
  } catch {
    return null;
  }
}

export async function getPatientSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(patientCookieName)?.value;
  if (!token) return null;
  return verifyPatientSessionToken(token);
}

export async function requirePatientSession() {
  const session = await getPatientSession();
  if (!session) {
    redirect("/portal/login");
  }
  return session;
}
