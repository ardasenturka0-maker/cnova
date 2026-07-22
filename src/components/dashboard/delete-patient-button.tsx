"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeletePatientButton({ patientId }: { patientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Hasta silinemedi.");
      }
      window.location.assign("/dashboard/patients");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hasta silinemedi.");
      setDeleting(false);
    }
  }

  return <div className="mt-3 space-y-2">
    <Button type="button" variant="destructive" disabled={deleting} onClick={remove}>
      <Trash2 className="h-4 w-4" />
      {deleting ? "Siliniyor" : "Hastayı Sil"}
    </Button>
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
  </div>;
}
