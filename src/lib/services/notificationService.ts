import { CommunicationChannel, CommunicationDirection, CommunicationStatus } from "@prisma/client";
import { emailProvider } from "@/lib/integrations/emailProvider";
import { smsProvider } from "@/lib/integrations/smsProvider";
import { whatsappProvider } from "@/lib/integrations/whatsappProvider";
import { prisma } from "@/lib/prisma";

type SendMessageInput = {
  organizationId: string;
  branchId: string;
  patientId?: string;
  to: string;
  message: string;
  channel: CommunicationChannel;
  subject?: string;
};

export async function sendMessage(input: SendMessageInput) {
  if (input.patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: input.patientId, organizationId: input.organizationId, deletedAt: null },
      select: { id: true }
    });
    if (!patient) throw new Error("Hasta bulunamadı veya bu kliniğe ait değil.");
  }
  const provider =
    input.channel === CommunicationChannel.WHATSAPP
      ? whatsappProvider
      : input.channel === CommunicationChannel.SMS
        ? smsProvider
        : emailProvider;

  const result = await provider.send({ to: input.to, message: input.message, subject: input.subject, patientId: input.patientId });

  await prisma.communicationLog.create({
    data: {
      patientId: input.patientId ?? null,
      channel: input.channel,
      direction: CommunicationDirection.OUTBOUND,
      subject: input.subject ?? "Klinik bilgilendirmesi",
      source: "Klinik paneli",
      contactValue: input.to,
      message: input.message,
      status: result.ok ? CommunicationStatus.SENT : CommunicationStatus.FAILED,
      provider: result.provider,
      providerRef: result.reference,
      organizationId: input.organizationId,
      branchId: input.branchId
    }
  });

  if (!result.ok) {
    throw new Error(result.message || "İleti sağlayıcıya teslim edilemedi.");
  }

  return result;
}
