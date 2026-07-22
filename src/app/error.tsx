"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Bir şey ters gitti</h1>
        <p className="mt-2 text-sm text-muted-foreground">İşlem tamamlanamadı. Tekrar deneyebilirsiniz.</p>
        <Button className="mt-5" type="button" onClick={() => reset()}>
          <RefreshCcw className="h-4 w-4" />
          Tekrar Dene
        </Button>
      </div>
    </div>
  );
}
