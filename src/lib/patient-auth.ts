import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authAudience, authIssuer, getAuthSecret } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

export const patientCookieName = "clinicnova_patient_session";

export type PatientSession = {
  kind: "patient";
  patientId: string;
  name: string;
  organizationId: string;
  branchId: string;
};

export async function findPatientForPortal(organizationSlug: string, phone: string, birthDate: string) {
  const digits = normalizePhone(phone);
  if (digits.length < 7) return null;
  const parsedBirthDate = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedBirthDate.getTime())) return null;

  const patients = await prisma.patient.findMany({
    where: { organization: { slug: organizationSlug }, phoneNormalized: digits, birthDate: parsedBirthDate, deletedAt: null },
    take: 2
  });
  return patients.length === 1 ? patients[0] : null;
}

export async function findPatientByPhoneInOrganization(organizationId: string, phone: string) {
  const digits = normalizePhone(phone);
  if (digits.length < 7) return null;
  const patients = await prisma.patient.findMany({ where: { organizationId, phoneNormalized: digits, deletedAt: null }, take: 2 });
  return patients[0] ?? null;
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
  const activePatient = await prisma.patient.count({ where: { id: session.patientId, organizationId: session.organizationId, deletedAt: null } });
  if (activePatient !== 1) {
    redirect("/portal/logout?reason=inactive");
  }
  return session;
}
