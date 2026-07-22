import type { ProviderResult } from "@/lib/integrations/types";
import { dispatchOutboundEvent } from "@/lib/integrations/outboundWebhook";

export async function syncHealthSystem(entity: string): Promise<ProviderResult> {
  return dispatchOutboundEvent("health-system.sync", { entity });
}
