"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Setup = { secret: string; qrCode: string };

export function MfaSettings({ initialEnabled, demo }: { initialEnabled: boolean; demo: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request(method: string, body?: object) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/mfa", { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json() as Setup & { error?: string; recoveryCodes?: string[] };
      if (!response.ok) throw new Error(data.error ?? "İşlem tamamlanamadı.");
      return data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
      return null;
    } finally { setBusy(false); }
  }

  async function begin() {
    const data = await request("POST", { password });
    if (data) setSetup(data);
  }

  async function enable() {
    const data = await request("PUT", { code });
    if (!data) return;
    setRecoveryCodes(data.recoveryCodes ?? []);
    setEnabled(true);
    setSetup(null);
    setCode("");
    setPassword("");
    setMessage("İki aşamalı doğrulama etkinleştirildi.");
  }

  async function disable() {
    const data = await request("DELETE", { password, code });
    if (!data) return;
    setEnabled(false);
    setPassword("");
    setCode("");
    setMessage("İki aşamalı doğrulama kapatıldı.");
  }

  if (demo) return <p className="text-sm text-muted-foreground">2FA kurulumu gerçek veritabanı bağlantısında kullanılabilir.</p>;
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Durum: <strong className={enabled ? "text-emerald-700" : "text-amber-700"}>{enabled ? "Etkin" : "Kapalı"}</strong></p>
    {!enabled && !setup ? <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Yeni 2FA anahtarı oluşturmadan önce mevcut şifrenizi yeniden doğrulayın.</p>
      <Input type="password" autoComplete="current-password" placeholder="Mevcut şifre" value={password} onChange={(event) => setPassword(event.target.value)} />
      <Button type="button" onClick={begin} disabled={busy || password.length < 8}>Authenticator kurulumunu başlat</Button>
    </div> : null}
    {setup ? <div className="space-y-3 rounded-md border p-3">
      <Image src={setup.qrCode} width={240} height={240} alt="Authenticator QR kodu" unoptimized />
      <p className="break-all font-mono text-xs">Manuel anahtar: {setup.secret}</p>
      <div className="space-y-2"><Label htmlFor="mfa-enable-code">6 haneli kod</Label><Input id="mfa-enable-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} /></div>
      <Button type="button" onClick={enable} disabled={busy || code.length < 6}>Doğrula ve etkinleştir</Button>
    </div> : null}
    {recoveryCodes.length ? <div className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-950">
      <strong>Bu kodları şimdi güvenli bir yerde saklayın; tekrar gösterilmez.</strong>
      <div className="mt-2 grid grid-cols-2 gap-1 font-mono">{recoveryCodes.map((item) => <span key={item}>{item}</span>)}</div>
    </div> : null}
    {enabled ? <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">2FA’yı kapat</p>
      <Input type="password" autoComplete="current-password" placeholder="Mevcut şifre" value={password} onChange={(event) => setPassword(event.target.value)} />
      <Input inputMode="numeric" autoComplete="one-time-code" placeholder="6 haneli doğrulama kodu" value={code} onChange={(event) => setCode(event.target.value)} />
      <Button type="button" variant="outline" onClick={disable} disabled={busy || password.length < 8 || code.length < 6}>2FA’yı kapat</Button>
    </div> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </div>;
}
