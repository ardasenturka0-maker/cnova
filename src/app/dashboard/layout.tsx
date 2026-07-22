import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { requireSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const locale = await getLocale();
  const [organization, notifications] = await Promise.all([
    prisma.organization.findFirst({
      where: { id: session.organizationId },
      select: { name: true }
    }),
    prisma.notification.findMany({
      where: { organizationId: session.organizationId, OR: [{ userId: null }, { userId: session.userId }] },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  const bellNotifications = notifications.filter((notification) => !notification.actionUrl?.startsWith("/dashboard/tourism")).slice(0, 8).map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    read: notification.read,
    actionUrl: notification.actionUrl ?? null,
    createdAt: new Date(notification.createdAt).toISOString()
  }));

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar className="sticky top-0 hidden h-screen lg:flex" locale={locale} role={session.role} />
      <div className="min-w-0 flex-1">
        <Topbar session={session} organizationName={organization?.name ?? "ClinicNova"} notifications={bellNotifications} locale={locale} />
        <main className="mx-auto w-full max-w-[1500px] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
