import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { highlightCards } from "@/lib/marketing";

export function ProductHero() {
  return (
    <section className="hero-product-surface relative overflow-hidden border-b">
      <div className="container grid min-h-[86svh] gap-10 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="relative z-10 max-w-2xl">
          <Badge variant="success" className="mb-5">
            Dental Clinic OS · Yerel + Merkezi
          </Badge>
          <h1 className="text-4xl font-semibold tracking-normal text-foreground sm:text-5xl lg:text-6xl">Hasta kaydından tedaviye, klinik operasyonunu tek panelden yönetin</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Hasta, randevu, tedavi planı, tahsilat, stok ve ekip operasyonlarını kayıpsız bir dijital yolculukta birleştirin.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className={buttonVariants({ size: "lg" })}>
              Ürünü Keşfet
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/features" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Özellikleri Gör
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {highlightCards.map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-lg border bg-background/72 p-3 backdrop-blur">
                <item.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative min-h-[420px] lg:min-h-[620px]">
          <div className="absolute inset-x-0 top-6 rounded-lg border bg-card/95 p-4 shadow-soft lg:left-8 lg:right-0">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <p className="text-sm font-semibold">Bugünkü Klinik Akışı</p>
                <p className="text-xs text-muted-foreground">Nişantaşı + Kadıköy</p>
              </div>
              <Badge>Canlı özet</Badge>
            </div>
            <div className="grid gap-3 py-4 sm:grid-cols-4">
              {[
                ["Randevu", "28"],
                ["Gelir", "₺82K"],
                ["Stok uyarısı", "5"],
                ["Memnuniyet", "4.7"]
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-md border bg-background p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium">Randevu yoğunluğu</p>
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <div className="flex h-44 items-end gap-2">
                  {[42, 62, 48, 88, 76, 58, 72].map((height, index) => (
                    <div key={index} className="flex flex-1 flex-col items-center gap-2">
                      <div className={cn("w-full rounded-md", index === 3 ? "bg-accent" : "bg-primary")} style={{ height: `${height}%` }} />
                      <span className="text-[11px] text-muted-foreground">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][index]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ["09:30", "Elif Kaya", "Dolgu", "Planlandı"],
                  ["10:15", "Mehmet Demir", "İmplant", "Geldi"],
                  ["11:00", "Zeynep Çelik", "Kontrol", "Takip"]
                ].map(([time, name, type, status]) => (
                  <div key={`${time}-${name}`} className="rounded-md border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{name}</p>
                      <span className="text-xs text-muted-foreground">{time}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{type}</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        {status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
