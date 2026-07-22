import type { ProviderResult } from "@/lib/integrations/types";
import { dispatchOutboundEvent } from "@/lib/integrations/outboundWebhook";

export async function createEPrescription(patientName: string): Promise<ProviderResult> {
  return dispatchOutboundEvent("prescription.create", { patientName });
}
