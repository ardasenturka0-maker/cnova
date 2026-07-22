import type { MessagePayload, MessageProvider, ProviderResult } from "@/lib/integrations/types";
import { dispatchOutboundEvent } from "@/lib/integrations/outboundWebhook";

export const emailProvider: MessageProvider = {
  async send(payload: MessagePayload): Promise<ProviderResult> {
    return dispatchOutboundEvent("communication.email.send", { ...payload });
  }
};
