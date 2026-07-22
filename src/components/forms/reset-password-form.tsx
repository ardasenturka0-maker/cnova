"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password !== confirmation) return setMessage("Şifreler eşleşmiyor.");
    setPending(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Şifre yenilenemedi.");
      setPending(false);
      return;
    }
    setMessage("Şifreniz yenilendi. Giriş sayfasına yönlendiriliyorsunuz.");
    setTimeout(() => router.push("/login"), 900);
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="new-password">Yeni şifre</Label><Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} required /></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">Yeni şifre tekrarı</Label><Input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></div>
      <p className="text-xs leading-5 text-muted-foreground">En az 12 karakter; büyük harf, küçük harf ve rakam kullanın.</p>
      {message ? <p className="rounded-md border bg-muted p-3 text-sm">{message}</p> : null}
      <Button className="w-full" type="submit" disabled={pending || !token}>{pending ? "Yenileniyor" : "Şifreyi yenile"}</Button>
    </form>
  );
}
