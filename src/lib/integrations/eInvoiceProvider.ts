import type { ProviderResult } from "@/lib/integrations/types";
import { dispatchOutboundEvent } from "@/lib/integrations/outboundWebhook";

export async function sendEInvoice(invoiceNumber: string): Promise<ProviderResult> {
  return dispatchOutboundEvent("invoice.send", { invoiceNumber });
}
