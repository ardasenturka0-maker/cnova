import { AppointmentStatus, CommunicationChannel, CommunicationStatus, PatientTag, PaymentStatus, PaymentType, RecallStatus, Role, TourismLeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function monthKey(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(date);
}

export async function getDashboardMetrics(organizationId: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = addDays(todayStart, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    todayAppointments,
    weeklyAppointments,
    monthlyPayments,
    pendingPayments,
    hotLeadCount,
    overduePaymentCount,
    activePatientCount,
    newPatientCount,
    lowStocks,
    missedCalls,
    satisfaction,
    recalls,
    revenuePayments,
    chartAppointments,
    treatments,
    doctors
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { organizationId, startsAt: { gte: todayStart, lte: todayEnd } },
      include: { patient: true, doctor: { select: { name: true } } },
      orderBy: { startsAt: "asc" }
    }),
    prisma.appointment.count({
      where: { organizationId, startsAt: { gte: todayStart, lte: weekEnd } }
    }),
    prisma.payment.findMany({
      where: { organizationId, type: PaymentType.INCOME, status: PaymentStatus.PAID, paidAt: { gte: monthStart } }
    }),
    prisma.payment.aggregate({
      where: { organizationId, type: PaymentType.INCOME, status: PaymentStatus.PENDING },
      _sum: { amount: true }
    }),
    prisma.lead.count({
      where: {
        organizationId,
        leadScore: { gte: 70 },
        leadStatus: {
          in: [TourismLeadStatus.NEW, TourismLeadStatus.CONTACTED, TourismLeadStatus.WAITING_REPLY, TourismLeadStatus.QUALIFIED, TourismLeadStatus.PACKAGE_SENT]
        }
      }
    }),
    prisma.payment.count({
      where: { organizationId, type: PaymentType.INCOME, status: PaymentStatus.PENDING, dueDate: { lt: todayStart } }
    }),
    prisma.patient.count({ where: { organizationId, deletedAt: null, tag: { in: [PatientTag.ACTIVE, PatientTag.VIP, PatientTag.RISKY] } } }),
    prisma.patient.count({ where: { organizationId, deletedAt: null, createdAt: { gte: monthStart } } }),
    prisma.stockItem.findMany({
      where: { organizationId },
      include: { branch: { select: { name: true } } },
      orderBy: { currentQuantity: "asc" },
      take: 8
    }),
    prisma.communicationLog.findMany({
      where: { organizationId, channel: CommunicationChannel.PHONE, status: CommunicationStatus.FAILED },
      include: { patient: true },
      orderBy: { createdAt: "desc" },
      take: 6
    }),
    prisma.surveyResponse.aggregate({
      where: { organizationId },
      _avg: { score: true }
    }),
    prisma.recall.findMany({
      where: { organizationId, status: { in: [RecallStatus.OPEN, RecallStatus.CONTACTED] } },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
      take: 8
    }),
    prisma.payment.findMany({
      where: { organizationId, type: PaymentType.INCOME, status: PaymentStatus.PAID, paidAt: { gte: sixMonthsAgo } },
      orderBy: { paidAt: "asc" }
    }),
    prisma.appointment.findMany({
      where: { organizationId, startsAt: { gte: todayStart, lte: weekEnd } },
      orderBy: { startsAt: "asc" }
    }),
    prisma.treatment.findMany({ where: { organizationId }, include: { doctor: { select: { id: true, name: true } } } }),
    prisma.user.findMany({
      where: { organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, active: true },
      include: { _count: { select: { doctorAppointments: true, doctorTreatments: true } } },
      orderBy: { name: "asc" }
    })
  ]);

  const monthlyRevenue = monthlyPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const pendingAmount = toNumber(pendingPayments._sum.amount);
  const visibleLowStocks = lowStocks.filter((item) => item.currentQuantity <= item.minimumQuantity);

  const revenueByMonth = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const amount = revenuePayments
      .filter((payment) => payment.paidAt.getFullYear() === date.getFullYear() && payment.paidAt.getMonth() === date.getMonth())
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    return { month: monthKey(date), gelir: amount };
  });

  const appointmentDensity = Array.from({ length: 7 }).map((_, index) => {
    const day = addDays(todayStart, index);
    const count = chartAppointments.filter((appointment) => startOfDay(appointment.startsAt).getTime() === day.getTime()).length;
    return {
      gun: new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(day),
      randevu: count
    };
  });

  const treatmentDistribution = Object.values(
    treatments.reduce<Record<string, { name: string; value: number }>>((acc, treatment) => {
      acc[treatment.treatmentType] ??= { name: treatment.treatmentType, value: 0 };
      acc[treatment.treatmentType].value += 1;
      return acc;
    }, {})
  ).slice(0, 8);

  const doctorRevenue = treatments.reduce<Record<string, number>>((acc, treatment) => {
    acc[treatment.doctorId] = (acc[treatment.doctorId] ?? 0) + toNumber(treatment.fee);
    return acc;
  }, {});

  const doctorPerformance = doctors.map((doctor) => ({
    name: doctor.name,
    appointments: doctor._count?.doctorAppointments ?? chartAppointments.filter((appointment) => appointment.doctorId === doctor.id).length,
    treatments: doctor._count?.doctorTreatments ?? treatments.filter((treatment) => treatment.doctorId === doctor.id).length,
    revenue: doctorRevenue[doctor.id] ?? 0,
    satisfaction: doctor.role === Role.DOCTOR ? 4.7 : 4.5
  }));

  const smartAlerts = [
    ...visibleLowStocks.slice(0, 3).map((item) => ({
      title: "Stok azaldi",
      description: `${item.name} ${item.currentQuantity} ${item.unit} seviyesinde.`,
      severity: "high" as const
    })),
    ...(pendingAmount > 0
      ? [
          {
            title: "Bekleyen tahsilat",
            description: `${Math.round(pendingAmount).toLocaleString("tr-TR")} TL odeme bekliyor.`,
            severity: "medium" as const
          }
        ]
      : []),
    ...(satisfaction._avg.score && satisfaction._avg.score < 4
      ? [
          {
            title: "Memnuniyet skoru dustu",
            description: "Dusuk puanli anketleri recall listesine alin.",
            severity: "medium" as const
          }
        ]
      : [])
  ];

  return {
    todayAppointments,
    weeklyAppointments,
    monthlyRevenue,
    pendingAmount,
    hotLeadCount,
    overduePaymentCount,
    activePatientCount,
    newPatientCount,
    lowStocks: visibleLowStocks,
    missedCalls,
    satisfactionScore: satisfaction._avg.score ?? 0,
    recalls,
    revenueByMonth,
    appointmentDensity,
    treatmentDistribution,
    doctorPerformance,
    smartAlerts
  };
}

export async function getReports(organizationId: string) {
  const [snapshots, payments, appointments, treatments, stockItems, surveyResponses, branches] = await Promise.all([
    prisma.reportSnapshot.findMany({ where: { organizationId }, include: { branch: true }, orderBy: { createdAt: "desc" } }),
    prisma.payment.findMany({ where: { organizationId }, include: { branch: true } }),
    prisma.appointment.findMany({ where: { organizationId }, include: { branch: true } }),
    prisma.treatment.findMany({ where: { organizationId }, include: { doctor: true } }),
    prisma.stockItem.findMany({ where: { organizationId }, include: { branch: true } }),
    prisma.surveyResponse.findMany({ where: { organizationId } }),
    prisma.branch.findMany({ where: { organizationId } })
  ]);

  const revenue = payments.filter((payment) => payment.type === PaymentType.INCOME && payment.status === PaymentStatus.PAID).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const noShowRate = appointments.length
    ? Math.round((appointments.filter((appointment) => appointment.status === AppointmentStatus.NO_SHOW).length / appointments.length) * 100)
    : 0;
  const cancellationRate = appointments.length
    ? Math.round((appointments.filter((appointment) => appointment.status === AppointmentStatus.CANCELLED).length / appointments.length) * 100)
    : 0;
  const averageSurvey = surveyResponses.length ? surveyResponses.reduce((sum, item) => sum + item.score, 0) / surveyResponses.length : 0;

  const branchComparison = branches.map((branch) => ({
    branch: branch.name,
    revenue: payments.filter((payment) => payment.branchId === branch.id && payment.type === PaymentType.INCOME).reduce((sum, payment) => sum + toNumber(payment.amount), 0),
    appointments: appointments.filter((appointment) => appointment.branchId === branch.id).length
  }));

  return {
    snapshots,
    revenue,
    noShowRate,
    cancellationRate,
    treatmentCount: treatments.length,
    lowStockCount: stockItems.filter((item) => item.currentQuantity <= item.minimumQuantity).length,
    averageSurvey,
    branchComparison
  };
}
