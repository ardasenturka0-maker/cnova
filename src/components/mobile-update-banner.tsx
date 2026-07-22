"use client";

import { useEffect, useState } from "react";

function parts(value: string) { return value.split(".").map((item) => Number.parseInt(item, 10) || 0); }
function older(current: string, required: string) {
  const left = parts(current); const right = parts(required);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) < (right[index] ?? 0);
  }
  return false;
}

export function MobileUpdateBanner() {
  const [update, setUpdate] = useState<{ required: boolean; version: string; url: string; sha256?: string } | null>(null);
  useEffect(() => {
    const match = navigator.userAgent.match(/ClinicNovaAndroid\/([0-9.]+)/);
    if (!match) return;
    fetch("/api/mobile/version").then((response) => response.json()).then((data: { currentVersion: string; minimumVersion: string; apkUrl?: string; sha256?: string }) => {
      if (data.apkUrl && older(match[1], data.currentVersion)) setUpdate({ required: older(match[1], data.minimumVersion), version: data.currentVersion, url: data.apkUrl, sha256: data.sha256 });
    }).catch(() => undefined);
  }, []);
  if (!update) return null;
  return <aside className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-3 border-b border-amber-400 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
    <span>{update.required ? "Güvenlik güncellemesi gerekli" : "Yeni ClinicNova sürümü hazır"}: {update.version}</span>
    <a className="font-semibold underline" href={update.url}>İmzalı APK’yı güncelle</a>
    {update.sha256 ? <span className="sr-only">SHA-256 {update.sha256}</span> : null}
  </aside>;
}
