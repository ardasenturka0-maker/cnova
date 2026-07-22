"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/lib/validations/auth";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "owner@clinicnova.test",
      password: "password123"
    }
  });

  async function onSubmit(values: LoginValues) {
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });

    if (response.status === 202) {
      setMfaRequired(true);
      return;
    }
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Giriş yapılamadı.");
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
      </div>
      {mfaRequired ? <div className="space-y-2">
        <Label htmlFor="mfaCode">Doğrulama kodu</Label>
        <Input id="mfaCode" inputMode="numeric" autoComplete="one-time-code" placeholder="123456 veya kurtarma kodu" autoFocus {...register("mfaCode")} />
        <p className="text-xs text-muted-foreground">Authenticator uygulamanızdaki 6 haneli kodu girin.</p>
      </div> : null}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3"><Label htmlFor="password">Şifre</Label><Link className="text-xs font-medium text-primary hover:underline" href="/forgot-password">Şifremi unuttum</Link></div>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
        {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
      </div>
      {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        <LogIn className="h-4 w-4" />
        {isSubmitting ? "Giriş yapılıyor" : "Giriş Yap"}
      </Button>
    </form>
  );
}
