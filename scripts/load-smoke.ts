async function main() {
  const baseUrl = new URL(process.env.LOAD_TEST_URL ?? "");
  const isProductionLike = !/(^|\.)staging[.-]|localhost|127\.0\.0\.1/.test(baseUrl.hostname);
  if (isProductionLike && process.env.LOAD_TEST_ALLOW_PRODUCTION !== "true") throw new Error("Yük testi yalnız staging/localhost için açıktır.");
  const concurrency = Math.min(100, Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY ?? 20)));
  const requests = Math.min(20_000, Math.max(concurrency, Number(process.env.LOAD_TEST_REQUESTS ?? 500)));
  const latencies: number[] = [];
  let failures = 0;
  let index = 0;
  async function worker() {
    while (index < requests) {
      index += 1;
      const started = performance.now();
      try {
        const response = await fetch(new URL("/api/health", baseUrl), { signal: AbortSignal.timeout(10_000), cache: "no-store" });
        if (!response.ok) failures += 1;
      } catch { failures += 1; }
      latencies.push(performance.now() - started);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  latencies.sort((a, b) => a - b);
  const percentile = (value: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))];
  const failureRate = failures / requests;
  console.log(JSON.stringify({ requests, concurrency, failures, failureRate, p50Ms: Math.round(percentile(.5)), p95Ms: Math.round(percentile(.95)), p99Ms: Math.round(percentile(.99)) }, null, 2));
  if (failureRate > Number(process.env.LOAD_TEST_MAX_FAILURE_RATE ?? .01) || percentile(.95) > Number(process.env.LOAD_TEST_MAX_P95_MS ?? 1000)) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
