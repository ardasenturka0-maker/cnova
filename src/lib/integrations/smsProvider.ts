import type { MessagePayload, MessageProvider, ProviderResult } from "@/lib/integrations/types";
import { dispatchOutboundEvent } from "@/lib/integrations/outboundWebhook";

export const smsProvider: MessageProvider = {
  async send(payload: MessagePayload): Promise<ProviderResult> {
    return dispatchOutboundEvent("communication.sms.send", { ...payload });
  }
};
