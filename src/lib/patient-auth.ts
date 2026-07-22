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
    if (
      payload.kind !== "patient"
      || typeof payload.patientId !== "string"
      || typeof payload.name !== "string"
      || typeof payload.organizationId !== "string"
      || typeof payload.branchId !== "string"
    ) return null;
    return {
      kind: "patient",
      patientId: payload.patientId,
      name: payload.name,
      organizationId: payload.organizationId,
      branchId: payload.branchId
    };
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
  const activePatient = await prisma.patient.findFirst({
    where: {
      id: session.patientId,
      organizationId: session.organizationId,
      deletedAt: null,
      branch: { organizationId: session.organizationId }
    },
    select: { firstName: true, lastName: true, branchId: true }
  });
  if (!activePatient) {
    redirect("/portal/logout?reason=inactive");
  }
  return {
    ...session,
    name: `${activePatient.firstName} ${activePatient.lastName}`.trim(),
    branchId: activePatient.branchId
  } satisfies PatientSession;
}
