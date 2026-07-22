import { createHmac } from "node:crypto";
import { isDemoMode } from "@/lib/demo-mode";
import type { ProviderResult } from "@/lib/integrations/types";

type WebhookResponse = {
  ok?: boolean;
  reference?: string;
  message?: string;
};

export async function dispatchOutboundEvent(event: string, payload: Record<string, unknown>): Promise<ProviderResult> {
  if (isDemoMode()) {
    return {
      ok: true,
      provider: `demo-${event}`,
      reference: `demo_${Date.now()}`,
      message: "Demo entegrasyon olayı kaydedildi."
    };
  }

  const endpoint = process.env.N8N_OUTBOUND_WEBHOOK_URL;
  const secret = process.env.N8N_OUTBOUND_SECRET;
  if (!endpoint || !secret) {
    return {
      ok: false,
      provider: "n8n-not-configured",
      reference: "",
      message: "Canlı entegrasyon yapılandırılmadı. N8N_OUTBOUND_WEBHOOK_URL ve N8N_OUTBOUND_SECRET gerekli."
    };
  }

  const timestamp = String(Date.now());
  const body = JSON.stringify({ event, timestamp, payload });
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ClinicNova/1.1",
        "X-ClinicNova-Event": event,
        "X-ClinicNova-Timestamp": timestamp,
        "X-ClinicNova-Signature": `sha256=${signature}`
      },
      body,
      cache: "no-store",
      signal: controller.signal
    });

    const text = await response.text();
    let result: WebhookResponse = {};
    if (text) {
      try {
        result = JSON.parse(text) as WebhookResponse;
      } catch {
        result = {};
      }
    }

    const ok = response.ok && result.ok !== false;
    return {
      ok,
      provider: "n8n-live",
      reference: result.reference ?? response.headers.get("x-request-id") ?? `n8n_${Date.now()}`,
      message: result.message ?? (ok ? "Canlı entegrasyon olayı teslim edildi." : `Entegrasyon HTTP ${response.status} hatası döndürdü.`)
    };
  } catch (error) {
    return {
      ok: false,
      provider: "n8n-live",
      reference: "",
      message: error instanceof Error && error.name === "AbortError" ? "Entegrasyon zaman aşımına uğradı." : "Entegrasyon servisine ulaşılamadı."
    };
  } finally {
    clearTimeout(timeout);
  }
}
