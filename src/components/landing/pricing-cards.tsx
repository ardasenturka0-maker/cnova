import { Check } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { plans } from "@/lib/marketing";

export function PricingCards() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((plan) => (
        <Card key={plan.name} className={cn("flex h-full flex-col", plan.highlighted && "border-primary shadow-soft")}>
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{plan.description}</p>
            <div className="pt-4 text-3xl font-semibold">{plan.price}</div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <ul className="flex-1 space-y-3 text-sm">
              {plan.limits.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/demo" className={cn(buttonVariants({ variant: plan.highlighted ? "default" : "outline" }), "mt-6 w-full")}>
              Demo Talep Et
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
