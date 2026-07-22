"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "PDF / Yazdır", className }: { label?: string; className?: string }) {
  return (
    <Button className={className} type="button" variant="outline" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  );
}
