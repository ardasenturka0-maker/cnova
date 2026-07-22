import { Role } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const exportRoles: Role[] = [Role.SUPER_ADMIN, Role.CLINIC_OWNER, Role.MANAGER];

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Yetkisiz." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!exportRoles.includes(session.role)) {
    return Response.json({ error: "Bu işlem için yönetici yetkisi gerekli." }, { status: 403 });
  }

  const organizationId = session.organizationId;
  const [organization, branches, users, patients, patientFiles, appointments, treatments, payments, invoices, consents, communication, recalls, leads, packages, auditLogs] = await Promise.all([
    prisma.organization.findFirst({ where: { id: organizationId } }),
    prisma.branch.findMany({ where: { organizationId } }),
    prisma.user.findMany({ where: { organizationId }, select: { id: true, name: true, email: true, role: true, active: true, branchId: true, createdAt: true, updatedAt: true } }),
    prisma.patient.findMany({ where: { organizationId } }),
    prisma.patientFile.findMany({ where: { organizationId }, select: { id: true, patientId: true, category: true, fileName: true, mimeType: true, size: true, note: true, createdAt: true, updatedAt: true } }),
    prisma.appointment.findMany({ where: { organizationId } }),
    prisma.treatment.findMany({ where: { organizationId } }),
    prisma.payment.findMany({ where: { organizationId } }),
    prisma.invoice.findMany({ where: { organizationId } }),
    prisma.consent.findMany({ where: { organizationId } }),
    prisma.communicationLog.findMany({ where: { organizationId } }),
    prisma.recall.findMany({ where: { organizationId } }),
    prisma.lead.findMany({ where: { organizationId } }),
    prisma.tourismPackage.findMany({ where: { organizationId } }),
    prisma.auditLog.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } })
  ]);

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "DATA_EXPORT",
      module: "privacy",
      organizationId,
      branchId: session.branchId,
      metadata: { format: "json", patientFileBodiesIncluded: false }
    }
  });

  const exportedAt = new Date().toISOString();
  const safeUsers = users.map(({ id, name, email, role, active, branchId, createdAt, updatedAt }) => ({ id, name, email, role, active, branchId, createdAt, updatedAt }));
  const body = JSON.stringify({
    schemaVersion: 1,
    exportedAt,
    organization,
    branches,
    users: safeUsers,
    patients,
    patientFiles,
    appointments,
    treatments,
    payments,
    invoices,
    consents,
    communication,
    recalls,
    leads,
    packages,
    auditLogs
  }, null, 2);

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="clinicnova-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
