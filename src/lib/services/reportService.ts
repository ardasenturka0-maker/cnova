import { AppointmentStatus, CommunicationChannel, CommunicationStatus, PatientTag, PaymentStatus, PaymentType, RecallStatus, Role } from "@prisma/client";
import { addClinicDateKey, clinicDateKey, clinicDayRange, clinicStartOfDay, clinicTimeZone, shiftClinicMonth } from "@/lib/clinic-time";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

function monthKey(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: clinicTimeZone }).format(date);
}

export async function getDashboardMetrics(organizationId: string) {
  const now = new Date();
  const todayKey = clinicDateKey(now);
  const { from: todayStart, to: tomorrowStart } = clinicDayRange(todayKey);
  const weekEnd = clinicStartOfDay(addClinicDateKey(todayKey, 7));
  const currentMonthKey = `${todayKey.slice(0, 7)}-01`;
  const monthStart = clinicStartOfDay(currentMonthKey);
  const sixMonthsAgo = clinicStartOfDay(shiftClinicMonth(currentMonthKey, -5));

  const [
    todayAppointments,
    weeklyAppointments,
    monthlyPayments,
    pendingPayments,
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
      where: { organizationId, startsAt: { gte: todayStart, lt: tomorrowStart }, patient: { deletedAt: null } },
      include: { patient: true, doctor: { select: { name: true } } },
      orderBy: { startsAt: "asc" }
    }),
    prisma.appointment.count({
      where: { organizationId, startsAt: { gte: todayStart, lt: weekEnd }, patient: { deletedAt: null } }
    }),
    prisma.payment.findMany({
      where: { organizationId, type: PaymentType.INCOME, status: PaymentStatus.PAID, paidAt: { gte: monthStart }, OR: [{ patientId: null }, { patient: { deletedAt: null } }] }
    }),
    prisma.payment.aggregate({
      where: { organizationId, type: PaymentType.INCOME, status: PaymentStatus.PENDING, OR: [{ patientId: null }, { patient: { deletedAt: null } }] },
      _sum: { amount: true }
    }),
    prisma.payment.count({
      where: { organizationId, type: PaymentType.INCOME, status: PaymentStatus.PENDING, dueDate: { lt: todayStart }, OR: [{ patientId: null }, { patient: { deletedAt: null } }] }
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
      where: { organizationId, channel: CommunicationChannel.PHONE, status: CommunicationStatus.FAILED, OR: [{ patientId: null }, { patient: { deletedAt: null } }] },
      include: { patient: true },
      orderBy: { createdAt: "desc" },
      take: 6
    }),
    prisma.surveyResponse.aggregate({
      where: { organizationId, patient: { deletedAt: null } },
      _avg: { score: true }
    }),
    prisma.recall.findMany({
      where: { organizationId, status: { in: [RecallStatus.OPEN, RecallStatus.CONTACTED] }, patient: { deletedAt: null } },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
      take: 8
    }),
    prisma.payment.findMany({
      where: { organizationId, type: PaymentType.INCOME, status: PaymentStatus.PAID, paidAt: { gte: sixMonthsAgo }, OR: [{ patientId: null }, { patient: { deletedAt: null } }] },
      orderBy: { paidAt: "asc" }
    }),
    prisma.appointment.findMany({
      where: { organizationId, startsAt: { gte: todayStart, lt: weekEnd }, patient: { deletedAt: null } },
      orderBy: { startsAt: "asc" }
    }),
    prisma.treatment.findMany({ where: { organizationId, patient: { deletedAt: null } }, include: { doctor: { select: { id: true, name: true } } } }),
    prisma.user.findMany({
      where: { organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, active: true },
      include: { _count: { select: {
        doctorAppointments: { where: { patient: { deletedAt: null } } },
        doctorTreatments: { where: { patient: { deletedAt: null } } }
      } } },
      orderBy: { name: "asc" }
    })
  ]);

  const monthlyRevenue = monthlyPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const pendingAmount = toNumber(pendingPayments._sum.amount);
  const visibleLowStocks = lowStocks.filter((item) => item.currentQuantity <= item.minimumQuantity);

  const revenueByMonth = Array.from({ length: 6 }).map((_, index) => {
    const targetMonthKey = shiftClinicMonth(currentMonthKey, -(5 - index));
    const date = clinicStartOfDay(targetMonthKey);
    const amount = revenuePayments
      .filter((payment) => clinicDateKey(payment.paidAt).slice(0, 7) === targetMonthKey.slice(0, 7))
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    return { month: monthKey(date), gelir: amount };
  });

  const appointmentDensity = Array.from({ length: 7 }).map((_, index) => {
    const dayKey = addClinicDateKey(todayKey, index);
    const day = clinicStartOfDay(dayKey);
    const count = chartAppointments.filter((appointment) => clinicDateKey(appointment.startsAt) === dayKey).length;
    return {
      gun: new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: clinicTimeZone }).format(day),
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
  const currentMonthKey = `${clinicDateKey(new Date()).slice(0, 7)}-01`;
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
  const paidIncome = payments.filter((payment) => payment.type === PaymentType.INCOME && payment.status === PaymentStatus.PAID);
  const paidExpenses = payments.filter((payment) => payment.type === PaymentType.EXPENSE && payment.status === PaymentStatus.PAID);
  const expense = paidExpenses.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const pendingRevenue = payments.filter((payment) => payment.type === PaymentType.INCOME && payment.status === PaymentStatus.PENDING).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const stockValue = stockItems.reduce((sum, item) => sum + item.currentQuantity * toNumber(item.purchasePrice), 0);
  const appointmentStatuses = Object.values(AppointmentStatus).map((status) => ({ status, count: appointments.filter((item) => item.status === status).length }));
  const treatmentDistribution = Object.values(treatments.reduce<Record<string, { name: string; count: number; revenue: number }>>((acc, treatment) => {
    acc[treatment.treatmentType] ??= { name: treatment.treatmentType, count: 0, revenue: 0 };
    acc[treatment.treatmentType].count += 1;
    acc[treatment.treatmentType].revenue += toNumber(treatment.fee);
    return acc;
  }, {})).sort((a, b) => b.revenue - a.revenue);
  const doctorPerformance = Object.values(treatments.reduce<Record<string, { doctor: string; treatments: number; plannedRevenue: number }>>((acc, treatment) => {
    acc[treatment.doctorId] ??= { doctor: treatment.doctor.name, treatments: 0, plannedRevenue: 0 };
    acc[treatment.doctorId].treatments += 1;
    acc[treatment.doctorId].plannedRevenue += toNumber(treatment.fee);
    return acc;
  }, {})).sort((a, b) => b.plannedRevenue - a.plannedRevenue);
  const monthlyCashflow = Array.from({ length: 12 }, (_, index) => {
    const targetMonthKey = shiftClinicMonth(currentMonthKey, -(11 - index));
    const date = clinicStartOfDay(targetMonthKey);
    const sameMonth = (payment: { paidAt: Date }) => clinicDateKey(payment.paidAt).slice(0, 7) === targetMonthKey.slice(0, 7);
    return {
      month: new Intl.DateTimeFormat("tr-TR", { month: "short", year: "2-digit", timeZone: clinicTimeZone }).format(date),
      income: paidIncome.filter(sameMonth).reduce((sum, item) => sum + toNumber(item.amount), 0),
      expense: paidExpenses.filter(sameMonth).reduce((sum, item) => sum + toNumber(item.amount), 0)
    };
  });

  const branchComparison = branches.map((branch) => ({
    branch: branch.name,
    revenue: payments.filter((payment) => payment.branchId === branch.id && payment.type === PaymentType.INCOME).reduce((sum, payment) => sum + toNumber(payment.amount), 0),
    appointments: appointments.filter((appointment) => appointment.branchId === branch.id).length
  }));

  return {
    snapshots,
    revenue,
    expense,
    netRevenue: revenue - expense,
    pendingRevenue,
    stockValue,
    noShowRate,
    cancellationRate,
    treatmentCount: treatments.length,
    lowStockCount: stockItems.filter((item) => item.currentQuantity <= item.minimumQuantity).length,
    averageSurvey,
    branchComparison,
    appointmentStatuses,
    treatmentDistribution,
    doctorPerformance,
    monthlyCashflow
  };
}
