"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema } from "@/lib/validations/auth";

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema)
  });

  async function onSubmit(values: RegisterValues) {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Kayıt oluşturulamadı.");
      return;
    }

    setMessage("Klinik hesabı oluşturuldu. Giriş sayfasına yönlendiriliyorsunuz.");
    setTimeout(() => router.push("/login"), 800);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="clinicName">Klinik adı</Label>
        <Input id="clinicName" {...register("clinicName")} />
        {errors.clinicName ? <p className="text-sm text-destructive">{errors.clinicName.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Ad soyad</Label>
        <Input id="fullName" {...register("fullName")} />
        {errors.fullName ? <p className="text-sm text-destructive">{errors.fullName.message}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Şifre</Label>
          <Input id="password" type="password" {...register("password")} />
          {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
        </div>
      </div>
      {message ? <div className="rounded-md border bg-muted p-3 text-sm">{message}</div> : null}
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Building2 className="h-4 w-4 animate-pulse" /> : <UserPlus className="h-4 w-4" />}
        {isSubmitting ? "Oluşturuluyor" : "Klinik Hesabı Oluştur"}
      </Button>
    </form>
  );
}
