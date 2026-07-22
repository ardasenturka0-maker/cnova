import type { PaymentPayload, PaymentProvider, ProviderResult } from "@/lib/integrations/types";
import { dispatchOutboundEvent } from "@/lib/integrations/outboundWebhook";

export const paymentProvider: PaymentProvider = {
  async charge(payload: PaymentPayload): Promise<ProviderResult> {
    return dispatchOutboundEvent("payment.charge", { ...payload });
  }
};
