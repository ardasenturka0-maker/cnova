import type { MessagePayload, MessageProvider, ProviderResult } from "@/lib/integrations/types";
import { dispatchOutboundEvent } from "@/lib/integrations/outboundWebhook";

export const whatsappProvider: MessageProvider = {
  async send(payload: MessagePayload): Promise<ProviderResult> {
    return dispatchOutboundEvent("communication.whatsapp.send", { ...payload });
  }
};
