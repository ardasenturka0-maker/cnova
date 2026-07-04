import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { requireSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const locale = getLocale();
  const organization = await prisma.organization.findFirst({
    where: { id: session.organizationId },
    select: { name: true }
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar className="sticky top-0 hidden h-screen lg:flex" locale={locale} />
      <div className="min-w-0 flex-1">
        <Topbar session={session} organizationName={organization?.name ?? "ClinicNova"} locale={locale} />
        <main className="mx-auto w-full max-w-[1500px] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
