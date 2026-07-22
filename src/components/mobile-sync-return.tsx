"use client";

import { useEffect } from "react";

export function MobileSyncReturn() {
  useEffect(() => {
    window.location.href = "clinicnova://sync";
  }, []);

  return <a className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground" href="clinicnova://sync">Yerel uygulamaya dön ve eşitle</a>;
}
