export type AiAssistantContext = {
  topic: "patient" | "appointments" | "finance" | "stock" | "general";
  prompt?: string;
};

export async function getAiAssistantSuggestion(context: AiAssistantContext) {
  const responses: Record<AiAssistantContext["topic"], string> = {
    patient:
      "Hasta ozetinde son ziyaret, bekleyen odeme ve recall kaydini birlikte kontrol edin. Riskli/VIP etiketli hastalar icin cikis sonrasi takip mesaji otomatik onerilebilir.",
    appointments:
      "Bu hafta ogleden sonra yogunluk artiyor. 30 dakikalik kontrolleri sabah bloklarina tasimak koltuk doluluk oranini dengeler.",
    finance:
      "Bekleyen tahsilatlarin buyuk kismi tamamlanan tedavilerden geliyor. Kart/online odeme linki ile ayni gun tahsilat oranini artirabilirsiniz.",
    stock:
      "Minimum seviyenin altindaki sarf malzemeleri icin tedarikci bazli toplu siparis olusturmak birim maliyeti dusurur.",
    general:
      "Bugun icin oncelik: randevu cakismalarini temizle, geciken odemelere hatirlatma gonder, dusuk stoklari siparis listesine ekle."
  };

  return {
    id: `ai_${Date.now()}`,
    title: "Klinik Operasyon Asistanı",
    answer: responses[context.topic],
    prompt: context.prompt ?? null,
    mode: "rules" as const
  };
}
