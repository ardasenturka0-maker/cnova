"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.get("email") })
    });
    const data = await response.json() as { error?: string; message?: string };
    setMessage(data.error ?? data.message ?? "İstek alındı.");
    setPending(false);
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="forgot-email">E-posta</Label><Input id="forgot-email" name="email" type="email" autoComplete="email" required /></div>
      {message ? <p className="rounded-md border bg-muted p-3 text-sm">{message}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>{pending ? "Gönderiliyor" : "Şifre bağlantısı gönder"}</Button>
    </form>
  );
}
