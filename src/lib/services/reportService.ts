import { AppointmentStatus, CommunicationChannel, CommunicationStatus, PatientTag, PaymentStatus, PaymentType, RecallStatus, Role, TreatmentStatus } from "@prisma/client";
import { addClinicDateKey, clinicDateKey, clinicDayRange, clinicStartOfDay, clinicTimeZone, shiftClinicMonth } from "@/lib/clinic-time";
import { prisma } from "@/lib/prisma";
import { canAccess, type ModuleKey } from "@/lib/rbac";
import { toNumber } from "@/lib/utils";

function monthKey(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { month: "short", timeZone: clinicTimeZone }).format(date);
}

type DashboardMetricsOptions = {
  branchId?: string | null;
  role?: Role;
};

export async function getDashboardMetrics(organizationId: string, options: DashboardMetricsOptions = {}) {
  const now = new Date();
  const todayKey = clinicDateKey(now);
  const { from: todayStart, to: tomorrowStart } = clinicDayRange(todayKey);
  const weekEnd = clinicStartOfDay(addClinicDateKey(todayKey, 7));
  const currentMonthKey = `${todayKey.slice(0, 7)}-01`;
  const monthStart = clinicStartOfDay(currentMonthKey);
  const nextMonthStart = clinicStartOfDay(shiftClinicMonth(currentMonthKey, 1));
  const sixMonthsAgo = clinicStartOfDay(shiftClinicMonth(currentMonthKey, -5));
  const branchScope = options.branchId ? { branchId: options.branchId } : {};
  const allowed = (module: ModuleKey) => !options.role || canAccess(options.role, module);

  const [
    todayAppointments,
    weeklyAppointments,
    monthlyPayments,
    pendingPayments,
    pendingPaymentCount,
    overduePaymentCount,
    activePatients,
    newPatientCount,
    lowStocks,
    missedCalls,
    satisfaction,
    recalls,
    revenuePayments,
    chartAppointments,
    treatments,
    doctors,
    inProgressTreatmentCount
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { organizationId, ...branchScope, startsAt: { gte: todayStart, lt: tomorrowStart }, patient: { deletedAt: null } },
      include: { patient: true, doctor: { select: { name: true } } },
      orderBy: { startsAt: "asc" }
    }),
    prisma.appointment.count({
      where: { organizationId, ...branchScope, startsAt: { gte: todayStart, lt: weekEnd }, patient: { deletedAt: null } }
    }),
    prisma.payment.findMany({
      where: { organizationId, ...branchScope, type: PaymentType.INCOME, status: PaymentStatus.PAID, paidAt: { gte: monthStart, lt: nextMonthStart }, OR: [{ patientId: null }, { patient: { deletedAt: null } }] }
    }),
    prisma.payment.aggregate({
      where: { organizationId, ...branchScope, type: PaymentType.INCOME, status: PaymentStatus.PENDING, OR: [{ patientId: null }, { patient: { deletedAt: null } }] },
      _sum: { amount: true }
    }),
    prisma.payment.count({
      where: { organizationId, ...branchScope, type: PaymentType.INCOME, status: PaymentStatus.PENDING, OR: [{ patientId: null }, { patient: { deletedAt: null } }] }
    }),
    prisma.payment.count({
      where: { organizationId, ...branchScope, type: PaymentType.INCOME, status: PaymentStatus.PENDING, dueDate: { lt: todayStart }, OR: [{ patientId: null }, { patient: { deletedAt: null } }] }
    }),
    prisma.patient.findMany({
      where: { organizationId, ...branchScope, deletedAt: null, tag: { in: [PatientTag.ACTIVE, PatientTag.VIP, PatientTag.RISKY] } },
      select: { tag: true }
    }),
    prisma.patient.count({ where: { organizationId, ...branchScope, deletedAt: null, createdAt: { gte: monthStart, lt: nextMonthStart } } }),
    prisma.stockItem.findMany({
      where: { organizationId, ...branchScope, deletedAt: null },
      include: { branch: { select: { name: true } } },
      orderBy: { currentQuantity: "asc" },
      take: 8
    }),
    prisma.communicationLog.findMany({
      where: { organizationId, ...branchScope, channel: CommunicationChannel.PHONE, status: CommunicationStatus.FAILED, OR: [{ patientId: null }, { patient: { deletedAt: null } }] },
      include: { patient: true },
      orderBy: { createdAt: "desc" },
      take: 6
    }),
    prisma.surveyResponse.aggregate({
      where: { organizationId, ...branchScope, patient: { deletedAt: null } },
      _avg: { score: true }
    }),
    prisma.recall.findMany({
      where: { organizationId, ...branchScope, status: { in: [RecallStatus.OPEN, RecallStatus.CONTACTED] }, patient: { deletedAt: null } },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
      take: 8
    }),
    prisma.payment.findMany({
      where: { organizationId, ...branchScope, type: PaymentType.INCOME, status: PaymentStatus.PAID, paidAt: { gte: sixMonthsAgo, lt: nextMonthStart }, OR: [{ patientId: null }, { patient: { deletedAt: null } }] },
      orderBy: { paidAt: "asc" }
    }),
    prisma.appointment.findMany({
      where: { organizationId, ...branchScope, startsAt: { gte: todayStart, lt: weekEnd }, patient: { deletedAt: null } },
      orderBy: { startsAt: "asc" }
    }),
    prisma.treatment.findMany({ where: { organizationId, ...branchScope, patient: { deletedAt: null } }, include: { doctor: { select: { id: true, name: true } } } }),
    prisma.user.findMany({
      where: { organizationId, ...branchScope, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, active: true },
      include: { _count: { select: {
        doctorAppointments: { where: { ...branchScope, patient: { deletedAt: null } } },
        doctorTreatments: { where: { ...branchScope, patient: { deletedAt: null } } }
      } } },
      orderBy: { name: "asc" }
    }),
    prisma.treatment.count({
      where: { organizationId, ...branchScope, status: TreatmentStatus.STARTED, patient: { deletedAt: null } }
    })
  ]);

  const monthlyRevenue = monthlyPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const pendingAmount = toNumber(pendingPayments._sum.amount);
  const visibleLowStocks = lowStocks.filter((item) => item.currentQuantity <= item.minimumQuantity);
  const activePatientBreakdown = activePatients.reduce<Record<string, number>>((counts, patient) => {
    counts[patient.tag] = (counts[patient.tag] ?? 0) + 1;
    return counts;
  }, {});
  const monthlyRevenueByMethod = monthlyPayments.reduce<Record<string, number>>((totals, payment) => {
    totals[payment.method] = (totals[payment.method] ?? 0) + toNumber(payment.amount);
    return totals;
  }, {});
  const todayAppointmentBreakdown = todayAppointments.reduce<Record<string, number>>((counts, appointment) => {
    counts[appointment.status] = (counts[appointment.status] ?? 0) + 1;
    return counts;
  }, {});

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
    ...(allowed("stocks") ? visibleLowStocks.slice(0, 3).map((item) => ({
      title: "Stok azaldi",
      description: `${item.name} ${item.currentQuantity} ${item.unit} seviyesinde.`,
      severity: "high" as const
    })) : []),
    ...(allowed("finance") && pendingAmount > 0
      ? [
          {
            title: "Bekleyen tahsilat",
            description: `${Math.round(pendingAmount).toLocaleString("tr-TR")} TL odeme bekliyor.`,
            severity: "medium" as const
          }
        ]
      : []),
    ...(allowed("surveys") && satisfaction._avg.score && satisfaction._avg.score < 4
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
    todayAppointments: allowed("appointments") ? todayAppointments : [],
    weeklyAppointments: allowed("appointments") ? weeklyAppointments : 0,
    monthlyRevenue: allowed("finance") ? monthlyRevenue : 0,
    pendingAmount: allowed("finance") ? pendingAmount : 0,
    pendingPaymentCount: allowed("finance") ? pendingPaymentCount : 0,
    overduePaymentCount: allowed("finance") ? overduePaymentCount : 0,
    activePatientCount: allowed("patients") ? activePatients.length : 0,
    activePatientBreakdown: allowed("patients") ? activePatientBreakdown : {},
    newPatientCount: allowed("patients") ? newPatientCount : 0,
    monthlyPaymentCount: allowed("finance") ? monthlyPayments.length : 0,
    monthlyRevenueByMethod: allowed("finance") ? monthlyRevenueByMethod : {},
    todayAppointmentBreakdown: allowed("appointments") ? todayAppointmentBreakdown : {},
    inProgressTreatmentCount: allowed("treatments") ? inProgressTreatmentCount : 0,
    lowStocks: allowed("stocks") ? visibleLowStocks : [],
    missedCalls: allowed("communication") ? missedCalls : [],
    satisfactionScore: allowed("surveys") ? satisfaction._avg.score ?? 0 : 0,
    recalls: allowed("recalls") ? recalls : [],
    revenueByMonth: allowed("finance") ? revenueByMonth : [],
    appointmentDensity: allowed("appointments") ? appointmentDensity : [],
    treatmentDistribution: allowed("treatments") ? treatmentDistribution : [],
    doctorPerformance: allowed("reports") ? doctorPerformance : [],
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
    prisma.stockItem.findMany({ where: { organizationId, deletedAt: null }, include: { branch: true } }),
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
