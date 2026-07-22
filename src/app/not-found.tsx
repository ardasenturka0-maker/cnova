import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Sayfa bulunamadı</h1>
        <p className="mt-2 text-sm text-muted-foreground">Aradığınız kayıt veya sayfa taşınmış olabilir.</p>
        <Link className={cn(buttonVariants(), "mt-5")} href="/">
          Ana Sayfa
        </Link>
      </div>
    </div>
  );
}
