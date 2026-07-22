import { assertProductionReady } from "../src/lib/production-readiness";

try {
  const readiness = assertProductionReady();
  for (const check of readiness.checks) {
    const marker = check.state === "pass" ? "✓" : check.state === "warning" ? "!" : "×";
    console.log(`${marker} ${check.label}: ${check.detail}`);
  }
  console.log("ClinicNova üretim ortamı hazır.");
} catch (error) {
  console.error("ClinicNova üretim ortamı hazır değil:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
