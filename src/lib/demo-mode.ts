export function isDemoMode() {
  const enabled = process.env.DEMO_MODE === "true";
  if (enabled && process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_DEMO !== "true") {
    throw new Error("DEMO_MODE üretimde yalnızca ALLOW_PRODUCTION_DEMO=true ile açıkça etkinleştirilebilir.");
  }
  return enabled;
}
