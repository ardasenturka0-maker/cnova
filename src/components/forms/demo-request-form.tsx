"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { demoRequestSchema } from "@/lib/validations/demo";

type DemoValues = z.infer<typeof demoRequestSchema>;

export function DemoRequestForm() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<DemoValues>({
    resolver: zodResolver(demoRequestSchema)
  });

  async function onSubmit(values: DemoValues) {
    setSuccess(false);
    setError(null);
    const response = await fetch("/api/demo-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Demo talebi alınamadı.");
      return;
    }

    reset();
    setSuccess(true);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Ad Soyad</Label>
          <Input id="fullName" {...register("fullName")} />
          {errors.fullName ? <p className="text-sm text-destructive">{errors.fullName.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clinicName">Klinik Adı</Label>
          <Input id="clinicName" {...register("clinicName")} />
          {errors.clinicName ? <p className="text-sm text-destructive">{errors.clinicName.message}</p> : null}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" {...register("phone")} />
          {errors.phone ? <p className="text-sm text-destructive">{errors.phone.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">Şehir</Label>
          <Input id="city" {...register("city")} />
          {errors.city ? <p className="text-sm text-destructive">{errors.city.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clinicSize">Klinik büyüklüğü</Label>
          <Select id="clinicSize" {...register("clinicSize")}>
            <option value="">Seçiniz</option>
            <option value="1 hekim">1 hekim</option>
            <option value="2-5 hekim">2-5 hekim</option>
            <option value="6-15 hekim">6-15 hekim</option>
            <option value="Coklu sube">Çoklu şube</option>
          </Select>
          {errors.clinicSize ? <p className="text-sm text-destructive">{errors.clinicSize.message}</p> : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Mesaj</Label>
        <Textarea id="message" {...register("message")} />
      </div>
      {success ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">Demo talebiniz kaydedildi.</div> : null}
      {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      <Button type="submit" disabled={isSubmitting}>
        <Send className="h-4 w-4" />
        {isSubmitting ? "Gönderiliyor" : "Demo Talep Et"}
      </Button>
    </form>
  );
}
