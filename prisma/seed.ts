import {
  PrismaClient,
  Role,
  Gender,
  PatientTag,
  AppointmentStatus,
  TreatmentStatus,
  PaymentType,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
  StockMovementType,
  ConsentStatus,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationStatus,
  RecallStatus,
  TourismLeadSourceChannel,
  TourismLeadStatus,
  TourismCurrency,
  TourismPackageStatus,
  ReservationShareChannel,
  ReservationShareStatus,
  LeadFollowUpStatus,
  PostTreatmentFollowUpStatus,
  ReviewPlatform,
  ReviewRequestStatus,
  BeforeAfterStatus,
  DigitalConsentStatus,
  TourismSurveySource,
  ChatbotCategory,
  ChatConversationChannel,
  ChatConversationStatus,
  ChatMessageSender,
  NotificationType,
  TaskPriority,
  TaskStatus,
  IntegrationProvider,
  IntegrationLogStatus
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const treatmentTypes = [
  "Muayene",
  "Dolgu",
  "Kanal tedavisi",
  "Implant",
  "Dis cekimi",
  "Protez",
  "Ortodonti",
  "Temizlik",
  "Beyazlatma"
];

const firstNames = [
  "Ayse",
  "Mehmet",
  "Elif",
  "Can",
  "Zeynep",
  "Mert",
  "Deniz",
  "Ece",
  "Kerem",
  "Selin"
];

const lastNames = [
  "Yilmaz",
  "Kaya",
  "Demir",
  "Sahin",
  "Celik",
  "Aydin",
  "Arslan",
  "Koc",
  "Polat",
  "Eren"
];

const now = new Date();

function daysFromNow(day: number) {
  return new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
}

function appointmentDate(day: number, hour: number, minute = 0) {
  const date = daysFromNow(day);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function resetDatabase() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed production veritabanında çalıştırılamaz.");
  await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER "AuditLog_immutable_update"');
  try {
  await prisma.integrationLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.chatbotKnowledgeBase.deleteMany();
  await prisma.surveyTemplate.deleteMany();
  await prisma.digitalConsent.deleteMany();
  await prisma.consentTemplate.deleteMany();
  await prisma.beforeAfterCase.deleteMany();
  await prisma.reviewRequest.deleteMany();
  await prisma.postTreatmentFollowUp.deleteMany();
  await prisma.leadFollowUp.deleteMany();
  await prisma.followUpSequence.deleteMany();
  await prisma.reservationShare.deleteMany();
  await prisma.transferPartner.deleteMany();
  await prisma.hotelPartner.deleteMany();
  await prisma.treatmentPackageItem.deleteMany();
  await prisma.tourismPackage.deleteMany();
  await prisma.leadMessage.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.reportSnapshot.deleteMany();
  await prisma.recall.deleteMany();
  await prisma.communicationLog.deleteMany();
  await prisma.surveyResponse.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.treatmentPlan.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.demoRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.organization.deleteMany();
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER "AuditLog_immutable_update"');
  }
}

async function main() {
  await resetDatabase();

  const passwordHash = await bcrypt.hash("password123", 12);

  const organization = await prisma.organization.create({
    data: {
      name: "Nova Dental Group",
      slug: "nova-dental",
      plan: "Kurumsal"
    }
  });

  const mainBranch = await prisma.branch.create({
    data: {
      name: "Nisantasi Klinik",
      city: "Istanbul",
      address: "Tesvikiye Mah. Klinik Sok. No:12",
      phone: "+90 212 555 10 10",
      organizationId: organization.id
    }
  });

  const secondBranch = await prisma.branch.create({
    data: {
      name: "Kadikoy Klinik",
      city: "Istanbul",
      address: "Bagdat Cad. No:248",
      phone: "+90 216 555 20 20",
      organizationId: organization.id
    }
  });

  const owner = await prisma.user.create({
    data: {
      name: "Derya Nova",
      email: "owner@clinicnova.test",
      passwordHash,
      role: Role.CLINIC_OWNER,
      organizationId: organization.id,
      branchId: mainBranch.id
    }
  });

  const doctor = await prisma.user.create({
    data: {
      name: "Dr. Emir Aydin",
      email: "doctor@clinicnova.test",
      passwordHash,
      role: Role.DOCTOR,
      organizationId: organization.id,
      branchId: mainBranch.id
    }
  });

  const receptionist = await prisma.user.create({
    data: {
      name: "Seda Resepsiyon",
      email: "receptionist@clinicnova.test",
      passwordHash,
      role: Role.RECEPTIONIST,
      organizationId: organization.id,
      branchId: mainBranch.id
    }
  });

  const accountant = await prisma.user.create({
    data: {
      name: "Baris Finans",
      email: "accountant@clinicnova.test",
      passwordHash,
      role: Role.ACCOUNTANT,
      organizationId: organization.id,
      branchId: secondBranch.id
    }
  });

  const manager = await prisma.user.create({
    data: {
      name: "Melis Operasyon",
      email: "manager@clinicnova.test",
      passwordHash,
      role: Role.MANAGER,
      organizationId: organization.id,
      branchId: mainBranch.id
    }
  });

  const doctorUsers = [doctor, owner].map((user) => user.id);

  const staffSeeds = [
    ["Dr. Emir Aydin", "Hekim", "Implantoloji", "Koltuk 1", mainBranch.id],
    ["Dr. Lara Er", "Hekim", "Ortodonti", "Koltuk 2", mainBranch.id],
    ["Dr. Mert Soy", "Hekim", "Endodonti", "Koltuk 3", secondBranch.id],
    ["Dr. Defne Kor", "Hekim", "Protez", "Koltuk 4", secondBranch.id],
    ["Seda Resepsiyon", "Resepsiyon", "", "", mainBranch.id],
    ["Nazan Asistan", "Asistan", "", "", mainBranch.id],
    ["Baris Finans", "Muhasebe", "", "", secondBranch.id],
    ["Melis Operasyon", "Klinik Muduru", "", "", mainBranch.id]
  ] as const;

  for (const [fullName, roleLabel, specialty, room, branchId] of staffSeeds) {
    await prisma.staff.create({
      data: {
        fullName,
        roleLabel,
        phone: "+90 5" + Math.floor(100000000 + Math.random() * 899999999),
        email: fullName.toLowerCase().replaceAll(" ", ".") + "@clinicnova.test",
        workingHours: "09:00-18:00",
        compensation: roleLabel === "Hekim" ? "%35 hakedis" : "Aylik maas",
        active: true,
        organizationId: organization.id,
        branchId,
        doctorProfile: specialty
          ? {
              create: {
                specialty,
                room,
                satisfactionScore: 4.5,
                weeklySchedule: {
                  monday: ["09:00", "18:00"],
                  tuesday: ["09:00", "18:00"],
                  thursday: ["10:00", "19:00"]
                }
              }
            }
          : undefined
      }
    });
  }

  await prisma.patient.createMany({
    data: Array.from({ length: 50 }).map((_, index) => {
      const branchId = index % 3 === 0 ? secondBranch.id : mainBranch.id;
      const firstName = firstNames[index % firstNames.length];
      const lastName = lastNames[(index + 3) % lastNames.length];
      const phone = "+90 5" + String(320000000 + index * 137).padStart(9, "0");
      return {
        firstName,
        lastName,
        nationalId: index % 4 === 0 ? String(10000000000 + index) : null,
        phone,
        phoneNormalized: phone.replace(/\D/g, "").slice(-10),
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@mail.test`,
        birthDate: new Date(Date.UTC(1980 + (index % 30), index % 12, (index % 27) + 1)),
        gender: index % 2 === 0 ? Gender.FEMALE : Gender.MALE,
        address: "Istanbul",
        allergies: index % 9 === 0 ? "Penisilin hassasiyeti" : null,
        chronicDiseases: index % 11 === 0 ? "Hipertansiyon" : null,
        notes: index % 5 === 0 ? "Tedavi sonrasi telefonla takip tercih ediyor." : null,
        tag: [PatientTag.NEW, PatientTag.ACTIVE, PatientTag.PASSIVE, PatientTag.RISKY, PatientTag.VIP][index % 5],
        lastVisitAt: index % 3 === 0 ? daysFromNow(-index) : null,
        organizationId: organization.id,
        branchId
      };
    })
  });

  const patients = await prisma.patient.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "asc" } });

  await prisma.appointment.createMany({
    data: Array.from({ length: 100 }).map((_, index) => {
      const patient = patients[index % patients.length];
      return {
        patientId: patient.id,
        doctorId: doctorUsers[index % doctorUsers.length],
        startsAt: appointmentDate((index % 35) - 10, 9 + (index % 8), index % 2 === 0 ? 0 : 30),
        durationMinutes: [30, 45, 60][index % 3],
        room: `Koltuk ${(index % 4) + 1}`,
        treatmentType: treatmentTypes[index % treatmentTypes.length],
        status: [AppointmentStatus.PLANNED, AppointmentStatus.ARRIVED, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED][index % 5],
        notes: index % 6 === 0 ? "Hasta randevu onayi bekliyor." : null,
        organizationId: organization.id,
        branchId: patient.branchId
      };
    })
  });

  await prisma.treatmentPlan.createMany({
    data: Array.from({ length: 40 }).map((_, index) => {
      const patient = patients[index % patients.length];
      return {
        patientId: patient.id,
        doctorId: doctorUsers[index % doctorUsers.length],
        toothNumber: String((index % 32) + 1),
        treatmentType: treatmentTypes[index % treatmentTypes.length],
        description: "Kademeli tedavi plani ve kontrol randevusu olusturuldu.",
        estimatedFee: 1500 + index * 225,
        status: [TreatmentStatus.PROPOSED, TreatmentStatus.ACCEPTED, TreatmentStatus.STARTED, TreatmentStatus.COMPLETED, TreatmentStatus.CANCELLED][index % 5],
        plannedAt: daysFromNow((index % 20) - 10),
        organizationId: organization.id,
        branchId: patient.branchId
      };
    })
  });

  await prisma.treatment.createMany({
    data: Array.from({ length: 40 }).map((_, index) => {
      const patient = patients[(index + 7) % patients.length];
      return {
        patientId: patient.id,
        doctorId: doctorUsers[index % doctorUsers.length],
        toothNumber: String((index % 28) + 1),
        treatmentType: treatmentTypes[(index + 2) % treatmentTypes.length],
        description: "Klinik notu ve tedavi materyali kaydi.",
        fee: 900 + index * 180,
        paymentPlan: {
          total: 900 + index * 180,
          downPayment: index % 3 === 0 ? 300 : 0,
          installmentCount: (index % 4) + 1,
          firstInstallmentDate: daysFromNow(7).toISOString().slice(0, 10),
          installments: Array.from({ length: (index % 4) + 1 }).map((__, installmentIndex) => ({
            number: installmentIndex + 1,
            dueDate: daysFromNow(7 + installmentIndex * 30).toISOString().slice(0, 10),
            amount: Math.round(((900 + index * 180 - (index % 3 === 0 ? 300 : 0)) / ((index % 4) + 1)) * 100) / 100
          })),
          note: index % 2 === 0 ? "Kart ile aylik tahsilat planlandi." : null
        },
        status: [TreatmentStatus.ACCEPTED, TreatmentStatus.STARTED, TreatmentStatus.COMPLETED][index % 3],
        performedAt: daysFromNow(-index),
        organizationId: organization.id,
        branchId: patient.branchId
      };
    })
  });

  await prisma.payment.createMany({
    data: Array.from({ length: 60 }).map((_, index) => {
      const patient = patients[index % patients.length];
      return {
        patientId: index % 8 === 0 ? null : patient.id,
        type: index % 9 === 0 ? PaymentType.EXPENSE : PaymentType.INCOME,
        amount: index % 9 === 0 ? 1200 + index * 20 : 750 + index * 155,
        method: [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER, PaymentMethod.ONLINE][index % 4],
        description: index % 9 === 0 ? "Malzeme gideri" : "Tedavi tahsilati",
        status: [PaymentStatus.PAID, PaymentStatus.PENDING, PaymentStatus.CANCELLED][index % 3],
        paidAt: daysFromNow(-index),
        organizationId: organization.id,
        branchId: patient.branchId
      };
    })
  });

  const payments = await prisma.payment.findMany({ where: { organizationId: organization.id }, take: 24 });

  await prisma.invoice.createMany({
    data: payments.slice(0, 18).map((payment, index) => ({
      number: `CNV-${new Date().getFullYear()}-${String(index + 1).padStart(4, "0")}`,
      patientId: payment.patientId,
      paymentId: payment.id,
      total: payment.amount,
      status: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PAID][index % 3],
      providerRef: index % 2 === 0 ? `mock-efatura-${index + 1}` : null,
      issuedAt: index % 3 === 0 ? daysFromNow(-index) : null,
      organizationId: organization.id,
      branchId: payment.branchId
    }))
  });

  const stockNames = [
    "Kompozit dolgu seti",
    "Anestezi kartusu",
    "Eldiven",
    "Maske",
    "Sterilizasyon poseti",
    "Implant vida",
    "Bonding ajan",
    "Ortodontik braket",
    "Ayna seti",
    "Frez seti"
  ];

  await prisma.stockItem.createMany({
    data: Array.from({ length: 20 }).map((_, index) => ({
      name: stockNames[index % stockNames.length],
      category: ["Sarf", "Cerrahi", "Ortodonti", "Sterilizasyon"][index % 4],
      currentQuantity: index % 6 === 0 ? 4 + index : 25 + index * 2,
      minimumQuantity: 12,
      unit: ["adet", "kutu", "paket"][index % 3],
      supplier: ["Medikal Plus", "DentalLine", "Nova Tedarik"][index % 3],
      purchasePrice: 180 + index * 35,
      organizationId: organization.id,
      branchId: index % 3 === 0 ? secondBranch.id : mainBranch.id
    }))
  });

  const stockItems = await prisma.stockItem.findMany({ where: { organizationId: organization.id } });

  await prisma.stockMovement.createMany({
    data: stockItems.flatMap((item, index) => [
      {
        itemId: item.id,
        type: StockMovementType.IN,
        quantity: 20 + index,
        note: "Seed giris hareketi",
        movedAt: daysFromNow(-index - 3),
        organizationId: organization.id,
        branchId: item.branchId
      },
      {
        itemId: item.id,
        type: StockMovementType.OUT,
        quantity: 3 + (index % 6),
        note: "Tedavi sarf cikisi",
        movedAt: daysFromNow(-index),
        organizationId: organization.id,
        branchId: item.branchId
      }
    ])
  });

  await prisma.consent.createMany({
    data: patients.slice(0, 12).map((patient, index) => ({
      patientId: patient.id,
      templateName: ["Implant Onami", "Kanal Tedavisi Onami", "KVKK Acik Riza"][index % 3],
      content: "Hasta bilgilendirme metni, islem riski ve acik riza kaydi.",
      status: [ConsentStatus.DRAFT, ConsentStatus.SENT, ConsentStatus.SIGNED][index % 3],
      timestamp: daysFromNow(-index),
      signedAt: index % 3 === 2 ? daysFromNow(-index + 1) : null,
      organizationId: organization.id,
      branchId: patient.branchId
    }))
  });

  const survey = await prisma.survey.create({
    data: {
      title: "Tedavi Sonrasi Memnuniyet",
      description: "Randevu ve tedavi deneyimi kisa anketi",
      organizationId: organization.id,
      branchId: mainBranch.id
    }
  });

  await prisma.surveyResponse.createMany({
    data: Array.from({ length: 15 }).map((_, index) => {
      const patient = patients[index % patients.length];
      const score = (index % 5) + 1;
      return {
        surveyId: survey.id,
        patientId: patient.id,
        score,
        comment: score < 3 ? "Bekleme suresi uzundu, takip isteniyor." : "Ekip ilgiliydi.",
        followUpNeeded: score < 3,
        organizationId: organization.id,
        branchId: patient.branchId
      };
    })
  });

  await prisma.communicationLog.createMany({
    data: Array.from({ length: 20 }).map((_, index) => {
      const patient = patients[index % patients.length];
      return {
        patientId: patient.id,
        channel: [CommunicationChannel.WHATSAPP, CommunicationChannel.SMS, CommunicationChannel.EMAIL, CommunicationChannel.PHONE][index % 4],
        direction: index % 3 === 0 ? CommunicationDirection.INBOUND : CommunicationDirection.OUTBOUND,
        subject: index % 3 === 0 ? ["Randevu degisikligi", "Odeme plani sorusu", "Tedavi sonrasi hassasiyet", "Kontrol talebi"][index % 4] : index % 2 === 0 ? "Randevu hatirlatma" : "Tedavi sonrasi takip",
        source: index % 3 === 0 ? ["WhatsApp yaniti", "Telefon aramasi", "E-posta cevabi", "SMS yaniti"][index % 4] : "Klinik paneli",
        contactName: `${patient.firstName} ${patient.lastName}`,
        contactValue: [patient.phone, patient.phone, patient.email ?? patient.phone, patient.phone][index % 4],
        message: index % 3 === 0 ? "Hasta donus yapti, ekip aksiyon bekliyor." : index % 2 === 0 ? "Randevu hatirlatma mesaji" : "Tedavi sonrasi takip mesaji",
        status: index % 3 === 0 ? CommunicationStatus.SENT : [CommunicationStatus.QUEUED, CommunicationStatus.SENT, CommunicationStatus.FAILED][index % 3],
        provider: index % 3 === 0 ? "manuel-kayit" : "mock-provider",
        providerRef: `mock-${index + 1}`,
        organizationId: organization.id,
        branchId: patient.branchId
      };
    })
  });

  const tourismLeadSources = [
    ...Array(10).fill(TourismLeadSourceChannel.WHATSAPP),
    ...Array(8).fill(TourismLeadSourceChannel.INSTAGRAM_DM),
    ...Array(7).fill(TourismLeadSourceChannel.WEB_FORM),
    ...Array(5).fill(TourismLeadSourceChannel.MANUAL)
  ] as TourismLeadSourceChannel[];
  const tourismCountries = ["United Kingdom", "Germany", "Netherlands", "France", "USA", "Saudi Arabia", "Turkey"];
  const tourismCities = ["London", "Berlin", "Amsterdam", "Paris", "New York", "Riyadh", "Istanbul"];
  const tourismTreatments = ["Dental Implant", "Hollywood Smile", "Veneers", "Teeth Whitening", "Full Mouth Restoration", "Zirconium Crown"];
  const tourismLeadNames = [
    "John Smith", "Emily Carter", "Lukas Weber", "Sophie Muller", "Noah de Vries", "Camille Laurent",
    "Michael Brown", "Aisha Al Saud", "Oliver Wilson", "Emma Johnson", "Hannah Becker", "Thomas Martin",
    "Mia van Dijk", "Lucas Bernard", "Sarah Davis", "Omar Al Rashid", "James Taylor", "Laura Hoffmann",
    "Anna Jansen", "Nora Petit", "Daniel Clark", "Fatima Khan", "Ryan Miller", "Julia Fischer",
    "Eva Smit", "Chloe Dubois", "Ethan Walker", "Yusuf Demir", "Grace Lee", "Mason Hall"
  ];
  const tourismLeadStatuses = [
    TourismLeadStatus.NEW,
    TourismLeadStatus.CONTACTED,
    TourismLeadStatus.WAITING_REPLY,
    TourismLeadStatus.QUALIFIED,
    TourismLeadStatus.PACKAGE_SENT,
    TourismLeadStatus.BOOKED,
    TourismLeadStatus.TREATMENT_STARTED,
    TourismLeadStatus.TREATMENT_COMPLETED,
    TourismLeadStatus.LOST
  ];
  const followUpCandidateStatuses: TourismLeadStatus[] = [TourismLeadStatus.WAITING_REPLY, TourismLeadStatus.PACKAGE_SENT, TourismLeadStatus.QUALIFIED];
  const activeFollowUpStatuses: TourismLeadStatus[] = [TourismLeadStatus.WAITING_REPLY, TourismLeadStatus.PACKAGE_SENT, TourismLeadStatus.QUALIFIED, TourismLeadStatus.CONTACTED];

  await prisma.lead.createMany({
    data: tourismLeadNames.map((fullName, index) => {
      const countryIndex = index % tourismCountries.length;
      const phonePrefix = ["+44", "+49", "+31", "+33", "+1", "+966", "+90"][countryIndex];
      const leadStatus = tourismLeadStatuses[index % tourismLeadStatuses.length];
      return {
        organizationId: organization.id,
        branchId: index % 3 === 0 ? secondBranch.id : mainBranch.id,
        sourceChannel: tourismLeadSources[index],
        fullName,
        phone: `${phonePrefix} 700 000 ${String(1000 + index).slice(0, 4)}`,
        email: `${fullName.toLowerCase().replaceAll(" ", ".")}@tourism.test`,
        country: tourismCountries[countryIndex],
        city: tourismCities[countryIndex],
        language: countryIndex === 6 ? "TR" : "EN",
        interestedTreatment: tourismTreatments[index % tourismTreatments.length],
        estimatedBudget: ["3000-5000 EUR", "5000-8000 EUR", "8000-12000 EUR", "2500-4000 GBP"][index % 4],
        travelDate: daysFromNow(18 + index),
        message: index % 2 === 0 ? "I want treatment, hotel and airport transfer package." : "Could you send price and travel details?",
        leadStatus,
        leadScore: Math.min(98, 42 + ((index * 7) % 56)),
        assignedToUserId: [receptionist.id, manager.id, owner.id][index % 3],
        lastContactAt: index % 3 === 0 ? daysFromNow(-index) : null,
        nextFollowUpAt: followUpCandidateStatuses.includes(leadStatus) ? daysFromNow((index % 3) - 1) : null,
        gdprConsent: index % 5 !== 0,
        notes: index % 4 === 0 ? "Rontgen/fotograf bekleniyor; seyahat tarihi sicak." : null,
        createdAt: daysFromNow(-index - 1)
      };
    })
  });

  const leads = await prisma.lead.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "asc" } });

  await prisma.leadMessage.createMany({
    data: leads.flatMap((lead, index) => [
      {
        leadId: lead.id,
        organizationId: organization.id,
        branchId: lead.branchId,
        direction: CommunicationDirection.INBOUND,
        channel: lead.sourceChannel === TourismLeadSourceChannel.WEB_FORM ? CommunicationChannel.EMAIL : CommunicationChannel.WHATSAPP,
        source: lead.sourceChannel,
        subject: lead.interestedTreatment,
        message: lead.message,
        createdAt: lead.createdAt
      },
      {
        leadId: lead.id,
        organizationId: organization.id,
        branchId: lead.branchId,
        direction: CommunicationDirection.OUTBOUND,
        channel: index % 3 === 0 ? CommunicationChannel.EMAIL : CommunicationChannel.WHATSAPP,
        source: "Sales CRM",
        subject: "Ilk danisman donusu",
        message: lead.language === "TR" ? "Merhaba, tedavi + otel + transfer paketinizi hazirlayabiliriz." : "Hi, our team can prepare your treatment + hotel + transfer package.",
        createdByUserId: lead.assignedToUserId,
        createdAt: daysFromNow(-index + 1)
      }
    ])
  });

  await prisma.hotelPartner.createMany({
    data: [
      { organizationId: organization.id, branchId: mainBranch.id, name: "Nova Stay Bomonti", contactPerson: "Ece Turan", phone: "+90 212 555 33 10", email: "sales@novastay.test", city: "Istanbul", district: "Sisli", address: "Bomonti Cad.", starRating: 4, pricePerNight: 95, currency: TourismCurrency.EUR, notes: "Klinik transferine 12 dk.", active: true },
      { organizationId: organization.id, branchId: mainBranch.id, name: "Bosphorus Care Hotel", contactPerson: "Murat Kaya", phone: "+90 212 555 33 20", email: "health@bosphoruscare.test", city: "Istanbul", district: "Besiktas", address: "Barbaros Bulvari", starRating: 5, pricePerNight: 150, currency: TourismCurrency.EUR, notes: "VIP hasta odalari uygun.", active: true },
      { organizationId: organization.id, branchId: secondBranch.id, name: "Kadikoy Comfort Suites", contactPerson: "Selin Ar", phone: "+90 216 555 33 30", email: "booking@comfort.test", city: "Istanbul", district: "Kadikoy", address: "Bagdat Cad.", starRating: 4, pricePerNight: 80, currency: TourismCurrency.EUR, notes: "Anadolu yakasi hastalar icin ekonomik.", active: true }
    ]
  });

  await prisma.transferPartner.createMany({
    data: [
      { organizationId: organization.id, branchId: mainBranch.id, name: "Nova VIP Transfer", contactPerson: "Ali Demir", phone: "+90 532 555 44 10", email: "ops@novavip.test", vehicleTypes: ["Vito", "Mercedes E", "Minivan"], airportList: ["IST", "SAW"], basePrice: 65, currency: TourismCurrency.EUR, notes: "24/7 saglik turizmi operasyonu.", active: true },
      { organizationId: organization.id, branchId: secondBranch.id, name: "CareRoute Istanbul", contactPerson: "Dilan Yuce", phone: "+90 532 555 44 20", email: "dispatch@careroute.test", vehicleTypes: ["Sedan", "Vito"], airportList: ["IST", "SAW"], basePrice: 55, currency: TourismCurrency.EUR, notes: "Ingilizce surucu opsiyonu.", active: true }
    ]
  });

  const hotels = await prisma.hotelPartner.findMany({ where: { organizationId: organization.id } });
  const transfers = await prisma.transferPartner.findMany({ where: { organizationId: organization.id } });

  await prisma.tourismPackage.createMany({
    data: leads.slice(0, 5).map((lead, index) => {
      const treatmentPrice = 3600 + index * 1150;
      const nights = 4 + index;
      const hotelPrice = nights * Number(hotels[index % hotels.length].pricePerNight);
      const transferPrice = Number(transfers[index % transfers.length].basePrice) * 2;
      const discount = index % 2 === 0 ? 250 : 0;
      return {
        organizationId: organization.id,
        branchId: lead.branchId,
        leadId: lead.id,
        patientId: patients[index]?.id ?? null,
        publicToken: `pkg-demo-${index + 1}`,
        packageTitle: `${lead.interestedTreatment} + Hotel + Transfer`,
        treatmentSummary: `${lead.interestedTreatment} icin kisisellestirilmis saglik turizmi paketi.`,
        hotelInfo: `${hotels[index % hotels.length].name}, ${nights} gece`,
        transferInfo: `${transfers[index % transfers.length].name}, cift yon havalimani transferi`,
        arrivalAirport: index % 2 === 0 ? "IST" : "SAW",
        arrivalDate: daysFromNow(24 + index * 3),
        departureDate: daysFromNow(28 + index * 3),
        numberOfCompanions: index % 3,
        totalTreatmentPrice: treatmentPrice,
        hotelPrice,
        transferPrice,
        discount,
        finalPrice: treatmentPrice + hotelPrice + transferPrice - discount,
        currency: [TourismCurrency.EUR, TourismCurrency.GBP, TourismCurrency.USD][index % 3],
        packageStatus: [TourismPackageStatus.SENT, TourismPackageStatus.ACCEPTED, TourismPackageStatus.VIEWED, TourismPackageStatus.DRAFT, TourismPackageStatus.SENT][index],
        validUntil: daysFromNow(14 + index),
        notes: "Paket kabul edilirse n8n mock ile otel ve transfer firmasina paylasilacak.",
        createdByUserId: lead.assignedToUserId,
        createdAt: daysFromNow(-index - 2)
      };
    })
  });

  const tourismPackages = await prisma.tourismPackage.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: "asc" } });

  await prisma.treatmentPackageItem.createMany({
    data: tourismPackages.flatMap((tourismPackage, packageIndex) => [
      { packageId: tourismPackage.id, organizationId: organization.id, treatmentName: leads[packageIndex].interestedTreatment, toothArea: packageIndex % 2 === 0 ? "Upper / Lower jaw" : "Smile zone", quantity: 1, unitPrice: tourismPackage.totalTreatmentPrice, totalPrice: tourismPackage.totalTreatmentPrice, estimatedDuration: packageIndex % 2 === 0 ? "5-7 days" : "3-5 days", explanation: "Rontgen ve fotograf incelemesi sonrasi netlesir." },
      { packageId: tourismPackage.id, organizationId: organization.id, treatmentName: "Online consultation", toothArea: null, quantity: 1, unitPrice: 0, totalPrice: 0, estimatedDuration: "30 min", explanation: "Tedavi oncesi danismanlik dahildir." }
    ])
  });

  await prisma.reservationShare.createMany({
    data: tourismPackages.filter((tourismPackage) => tourismPackage.packageStatus !== TourismPackageStatus.DRAFT).map((tourismPackage, index) => ({
      organizationId: organization.id,
      branchId: tourismPackage.branchId,
      packageId: tourismPackage.id,
      leadId: tourismPackage.leadId,
      hotelPartnerId: hotels[index % hotels.length].id,
      transferPartnerId: transfers[index % transfers.length].id,
      sharedVia: ReservationShareChannel.N8N,
      payloadJson: { packageId: tourismPackage.id, hotel: tourismPackage.hotelInfo, transfer: tourismPackage.transferInfo, airport: tourismPackage.arrivalAirport },
      status: tourismPackage.packageStatus === TourismPackageStatus.ACCEPTED ? ReservationShareStatus.CONFIRMED : ReservationShareStatus.SENT
    }))
  });

  await prisma.followUpSequence.createMany({
    data: [
      { organizationId: organization.id, branchId: mainBranch.id, name: "3/7/14 gun satis kurtarma dizisi", description: "Cevap vermeyen lead icin TR/EN WhatsApp ve e-posta takip akisi.", active: true, stepsJson: [{ dayOffset: 3, channel: "WHATSAPP", language: "TR", messageTemplate: "Merhaba {{name}}, dis tedavinizle ilgili bilgi talebinizi aldik. Devam etmek ister misiniz?", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST", "TREATMENT_STARTED"] }, { dayOffset: 7, channel: "WHATSAPP", language: "EN", messageTemplate: "Hi {{name}}, do you have any questions about treatment price, duration, hotel or airport transfer in Turkey?", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST", "TREATMENT_STARTED"] }, { dayOffset: 14, channel: "EMAIL", language: "EN", messageTemplate: "Hi {{name}}, your consultation request is still open. Would you like us to prepare a treatment + hotel + transfer package?", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST", "TREATMENT_STARTED"] }] },
      { organizationId: organization.id, branchId: mainBranch.id, name: "Instagram sicak lead donusu", description: "DM sonrasi hizli fiyat ve fotograf isteme akisi.", active: true, stepsJson: [{ dayOffset: 1, channel: "WHATSAPP", language: "EN", messageTemplate: "Could you share photos or X-ray so our doctors can prepare a precise plan?", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST"] }] },
      { organizationId: organization.id, branchId: secondBranch.id, name: "Paket sonrasi karar destek", description: "Paket gonderilmis ancak donus alinamamis leadler.", active: true, stepsJson: [{ dayOffset: 3, channel: "EMAIL", language: "EN", messageTemplate: "Your package is ready. We can adjust hotel, transfer or dates if needed.", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST"] }] }
    ]
  });

  const followUpSequences = await prisma.followUpSequence.findMany({ where: { organizationId: organization.id } });

  await prisma.leadFollowUp.createMany({
    data: leads.filter((lead) => activeFollowUpStatuses.includes(lead.leadStatus)).slice(0, 12).map((lead, index) => ({
      organizationId: organization.id,
      branchId: lead.branchId,
      leadId: lead.id,
      sequenceId: followUpSequences[index % followUpSequences.length].id,
      currentStep: index % 3,
      nextRunAt: daysFromNow((index % 4) - 2),
      status: index % 5 === 0 ? LeadFollowUpStatus.PAUSED : LeadFollowUpStatus.ACTIVE,
      lastMessageAt: index % 2 === 0 ? daysFromNow(-index) : null
    }))
  });

  const treatmentRecords = await prisma.treatment.findMany({ where: { organizationId: organization.id } });

  await prisma.postTreatmentFollowUp.createMany({
    data: tourismPackages.slice(0, 4).map((tourismPackage, index) => ({
      organizationId: organization.id,
      branchId: tourismPackage.branchId,
      patientId: patients[index].id,
      treatmentId: treatmentRecords[index]?.id ?? null,
      packageId: tourismPackage.id,
      publicToken: `care-demo-${index + 1}`,
      returnCountry: leads[index].country,
      returnDate: daysFromNow(-index - 4),
      followUpDay: [3, 7, 14, 30][index],
      nextMessageAt: daysFromNow((index % 3) - 1),
      status: [PostTreatmentFollowUpStatus.SCHEDULED, PostTreatmentFollowUpStatus.SENT, PostTreatmentFollowUpStatus.ISSUE_REPORTED, PostTreatmentFollowUpStatus.COMPLETED][index],
      issueReported: index === 2,
      issueDescription: index === 2 ? "Hassasiyet ve gece agrisi bildirildi." : null,
      painLevel: index === 2 ? 7 : null
    }))
  });

  await prisma.reviewRequest.createMany({
    data: Array.from({ length: 10 }).map((_, index) => ({
      organizationId: organization.id,
      branchId: patients[index % patients.length].branchId,
      patientId: patients[index % patients.length].id,
      treatmentId: treatmentRecords[index % treatmentRecords.length]?.id ?? null,
      packageId: tourismPackages[index % tourismPackages.length]?.id ?? null,
      platform: [ReviewPlatform.GOOGLE, ReviewPlatform.TRUSTPILOT, ReviewPlatform.CUSTOM][index % 3],
      reviewLink: index % 2 === 0 ? "https://reviews.google.test/clinicnova" : "https://trustpilot.test/clinicnova",
      scheduledAt: daysFromNow(index - 5),
      sentAt: index % 3 === 0 ? daysFromNow(index - 4) : null,
      status: [ReviewRequestStatus.SCHEDULED, ReviewRequestStatus.SENT, ReviewRequestStatus.CLICKED, ReviewRequestStatus.COMPLETED, ReviewRequestStatus.FAILED][index % 5],
      language: index % 4 === 0 ? "TR" : "EN",
      messageTemplate: index % 4 === 0 ? "Merhaba {{name}}, memnun kaldiysaniz kisa bir yorum birakmaniz bizi mutlu eder: {{reviewLink}}" : "Hi {{name}}, if you were happy with your treatment, we would really appreciate a short review: {{reviewLink}}"
    }))
  });

  await prisma.consentTemplate.createMany({
    data: [
      { organizationId: organization.id, branchId: mainBranch.id, title: "International Implant Consent", language: "EN", content: "This demo consent explains treatment risks, travel timing, hotel/transfer data sharing and aftercare responsibilities.", treatmentType: "Dental Implant", active: true },
      { organizationId: organization.id, branchId: mainBranch.id, title: "Saglik Turizmi KVKK Rizasi", language: "TR", content: "Bu demo riza metni tedavi, konaklama, transfer ve iletisim verilerinin islenmesini aciklar.", treatmentType: "Health Tourism", active: true }
    ]
  });

  const consentTemplates = await prisma.consentTemplate.findMany({ where: { organizationId: organization.id } });

  await prisma.digitalConsent.createMany({
    data: leads.slice(0, 8).map((lead, index) => ({
      organizationId: organization.id,
      branchId: lead.branchId,
      patientId: patients[index]?.id ?? null,
      leadId: lead.id,
      templateId: consentTemplates[index % consentTemplates.length].id,
      title: consentTemplates[index % consentTemplates.length].title,
      contentSnapshot: consentTemplates[index % consentTemplates.length].content,
      language: lead.language,
      publicToken: `consent-demo-${index + 1}`,
      status: [DigitalConsentStatus.SENT, DigitalConsentStatus.SIGNED, DigitalConsentStatus.VIEWED, DigitalConsentStatus.DRAFT][index % 4],
      signedAt: index % 4 === 1 ? daysFromNow(-index) : null,
      signerName: index % 4 === 1 ? lead.fullName : null,
      signerIp: index % 4 === 1 ? "127.0.0.1" : null,
      signerUserAgent: index % 4 === 1 ? "Mock Browser" : null,
      signatureData: index % 4 === 1 ? `signature-${lead.fullName}` : null
    }))
  });

  await prisma.beforeAfterCase.createMany({
    data: patients.slice(0, 6).map((patient, index) => ({
      organizationId: organization.id,
      branchId: patient.branchId,
      patientId: patient.id,
      treatmentType: ["Implant", "Veneers", "Hollywood Smile", "Whitening", "Zirconium Crown", "Full Mouth Restoration"][index],
      title: `Tourism before/after case #${index + 1}`,
      description: "Onayli once/sonra vaka anlatimi ve sosyal medya aciklamasi mock uretilebilir.",
      beforeImageUrl: `https://placehold.co/640x420?text=Before+${index + 1}`,
      afterImageUrl: `https://placehold.co/640x420?text=After+${index + 1}`,
      consentGiven: index !== 1,
      consentId: null,
      country: tourismCountries[index % tourismCountries.length],
      ageRange: ["25-34", "35-44", "45-54"][index % 3],
      gender: index % 2 === 0 ? "Female" : "Male",
      tags: ["smile-design", tourismTreatments[index % tourismTreatments.length].toLowerCase().replaceAll(" ", "-")],
      privacyNotes: "Yuz gorunurlugu ve KVKK/GDPR izni kontrol edildi.",
      status: [BeforeAfterStatus.APPROVED, BeforeAfterStatus.DRAFT, BeforeAfterStatus.PUBLISHED_WEBSITE, BeforeAfterStatus.PUBLISHED_SOCIAL, BeforeAfterStatus.APPROVED, BeforeAfterStatus.ARCHIVED][index]
    }))
  });

  await prisma.surveyTemplate.create({
    data: {
      organizationId: organization.id,
      branchId: mainBranch.id,
      title: "International Patient Satisfaction",
      language: "EN",
      questionsJson: ["Overall satisfaction", "Doctor attention", "Clinic hygiene", "Transfer experience", "Hotel experience", "Turkey experience", "NPS"],
      active: true
    }
  });

  const surveyTemplate = await prisma.surveyTemplate.findFirst({ where: { organizationId: organization.id } });

  await prisma.surveyResponse.createMany({
    data: patients.slice(0, 8).map((patient, index) => ({
      surveyId: survey.id,
      patientId: patient.id,
      treatmentId: treatmentRecords[index % treatmentRecords.length]?.id ?? null,
      packageId: tourismPackages[index % tourismPackages.length].id,
      surveyTemplateId: surveyTemplate?.id ?? null,
      score: (index % 5) + 1,
      rating: (index % 5) + 1,
      comment: index % 5 < 2 ? "Hotel transfer timing needs attention." : "Everything was smooth, thank you.",
      answersJson: { doctor: 5 - (index % 2), clinic: 5, transfer: 4, hotel: 4, turkey: 5 },
      npsScore: [10, 9, 8, 6, 4][index % 5],
      submittedAt: daysFromNow(-index),
      source: [TourismSurveySource.WHATSAPP, TourismSurveySource.EMAIL, TourismSurveySource.WEB_LINK][index % 3],
      followUpNeeded: index % 5 < 2,
      organizationId: organization.id,
      branchId: patient.branchId
    }))
  });

  await prisma.chatbotKnowledgeBase.createMany({
    data: [
      { organizationId: organization.id, branchId: mainBranch.id, question: "How much is dental implant?", answer: "For dental implant treatments, the final price depends on your X-ray, bone condition and treatment plan. If you share photos or X-ray, our team can prepare a personalized package including treatment, hotel and airport transfer.", language: "EN", category: ChatbotCategory.PRICE, active: true },
      { organizationId: organization.id, branchId: mainBranch.id, question: "Implant fiyati nedir?", answer: "Implant tedavisinde net fiyat; rontgen, kemik durumu ve tedavi planina gore degisir. Fotograf veya rontgen paylasirsaniz ekibimiz tedavi, otel ve transfer dahil size ozel paket hazirlayabilir.", language: "TR", category: ChatbotCategory.PRICE, active: true },
      { organizationId: organization.id, branchId: mainBranch.id, question: "Do you provide hotel and transfer?", answer: "Yes, we can prepare packages including treatment, hotel and airport transfer through our partner network.", language: "EN", category: ChatbotCategory.HOTEL, active: true }
    ]
  });

  await prisma.chatConversation.createMany({
    data: leads.slice(0, 6).map((lead, index) => ({
      organizationId: organization.id,
      branchId: lead.branchId,
      leadId: lead.id,
      channel: [ChatConversationChannel.WEBSITE, ChatConversationChannel.WHATSAPP, ChatConversationChannel.INSTAGRAM][index % 3],
      language: lead.language,
      status: index % 2 === 0 ? ChatConversationStatus.HUMAN_NEEDED : ChatConversationStatus.BOT_HANDLED
    }))
  });

  const chatConversations = await prisma.chatConversation.findMany({ where: { organizationId: organization.id } });

  await prisma.chatMessage.createMany({
    data: chatConversations.flatMap((conversation, index) => [
      { organizationId: organization.id, conversationId: conversation.id, sender: ChatMessageSender.PATIENT, message: "How much for implants with hotel?", createdAt: daysFromNow(-index - 1) },
      { organizationId: organization.id, conversationId: conversation.id, sender: ChatMessageSender.BOT, message: "Final price depends on X-ray and treatment plan. We can prepare a package with hotel and airport transfer.", createdAt: daysFromNow(-index - 1) }
    ])
  });

  await prisma.notification.createMany({
    data: [
      { organizationId: organization.id, userId: receptionist.id, title: "Yeni sicak lead", message: "John Smith implant + otel paketi icin donus bekliyor.", type: NotificationType.LEAD, read: false, actionUrl: "/dashboard/tourism/leads" },
      { organizationId: organization.id, userId: manager.id, title: "Paket kabul edildi", message: "Emily Carter paketi kabul etti; otel/transfer paylasimi hazir.", type: NotificationType.PACKAGE, read: false, actionUrl: "/dashboard/tourism/hotel-transfer" },
      { organizationId: organization.id, userId: doctor.id, title: "Tedavi sonrasi sorun", message: "Bir hasta hassasiyet bildirdi, hekim kontrolu gerekiyor.", type: NotificationType.ISSUE, read: false, actionUrl: "/dashboard/tourism/post-treatment" }
    ]
  });

  await prisma.task.createMany({
    data: [
      { organizationId: organization.id, branchId: mainBranch.id, assignedToUserId: receptionist.id, relatedLeadId: leads[0].id, title: "John Smith icin paket gonder", description: "Fotograf ve butce bilgisi var, satis kaybi riski yuksek.", priority: TaskPriority.HIGH, status: TaskStatus.TODO, dueDate: daysFromNow(1) },
      { organizationId: organization.id, branchId: mainBranch.id, assignedToUserId: manager.id, relatedLeadId: leads[1].id, relatedPatientId: patients[1].id, title: "Otel ve transfer rezervasyonunu dogrula", description: "Paket kabul edildi, n8n paylasimi sonrasi firma teyidi bekleniyor.", priority: TaskPriority.URGENT, status: TaskStatus.IN_PROGRESS, dueDate: daysFromNow(0) },
      { organizationId: organization.id, branchId: mainBranch.id, assignedToUserId: doctor.id, relatedPatientId: patients[2].id, title: "Tedavi sonrasi agri bildirimi", description: "Uzaktan takip formunda agri seviyesi 7 bildirildi.", priority: TaskPriority.URGENT, status: TaskStatus.TODO, dueDate: daysFromNow(0) }
    ]
  });

  await prisma.integrationLog.createMany({
    data: [
      { organizationId: organization.id, branchId: mainBranch.id, provider: IntegrationProvider.AIRTABLE, eventType: "lead.sync", payloadJson: { leadId: leads[0].id }, responseJson: { ok: true, mode: "mock" }, status: IntegrationLogStatus.SUCCESS },
      { organizationId: organization.id, branchId: mainBranch.id, provider: IntegrationProvider.N8N, eventType: "reservation.share", payloadJson: { packageId: tourismPackages[1].id }, responseJson: { workflow: "mock-reservation-share" }, status: IntegrationLogStatus.SUCCESS },
      { organizationId: organization.id, branchId: mainBranch.id, provider: IntegrationProvider.WHATSAPP, eventType: "followup.sent", payloadJson: { leadId: leads[2].id }, responseJson: { queued: true }, status: IntegrationLogStatus.PENDING }
    ]
  });

  await prisma.recall.createMany({
    data: Array.from({ length: 10 }).map((_, index) => {
      const patient = patients[(index * 3) % patients.length];
      return {
        patientId: patient.id,
        reason: ["6 aylik kontrol", "Implant kontrolu", "Tedavi sonrasi takip"][index % 3],
        dueDate: daysFromNow(index - 3),
        status: [RecallStatus.OPEN, RecallStatus.CONTACTED, RecallStatus.SCHEDULED][index % 3],
        notes: "Hasta ile kontrol randevusu icin iletisime gecilecek.",
        organizationId: organization.id,
        branchId: patient.branchId
      };
    })
  });

  await prisma.reportSnapshot.createMany({
    data: [
      {
        type: "monthly-revenue",
        title: "Aylik Gelir Raporu",
        payload: { revenue: 285000, pending: 42500, growth: 12.5 },
        periodStart: daysFromNow(-30),
        periodEnd: now,
        organizationId: organization.id,
        branchId: mainBranch.id
      },
      {
        type: "branch-comparison",
        title: "Sube Karsilastirmasi",
        payload: { nisantasi: 184000, kadikoy: 101000 },
        periodStart: daysFromNow(-30),
        periodEnd: now,
        organizationId: organization.id,
        branchId: null
      }
    ]
  });

  await prisma.demoRequest.create({
    data: {
      fullName: "Gokce Klinik",
      clinicName: "Gokce Dental",
      phone: "+90 532 555 22 11",
      email: "demo@clinicnova.test",
      city: "Izmir",
      clinicSize: "3-5 hekim",
      message: "Coklu sube ve online randevu icin demo talep ediyorum.",
      organizationId: organization.id
    }
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: owner.id,
        action: "CREATE",
        module: "patients",
        entityId: patients[0]?.id,
        metadata: { source: "seed" },
        organizationId: organization.id,
        branchId: mainBranch.id
      },
      {
        userId: receptionist.id,
        action: "SEND_REMINDER",
        module: "appointments",
        metadata: { provider: "mock-whatsapp" },
        organizationId: organization.id,
        branchId: mainBranch.id
      },
      {
        userId: manager.id,
        action: "EXPORT",
        module: "reports",
        metadata: { format: "csv" },
        organizationId: organization.id,
        branchId: null
      },
      {
        userId: accountant.id,
        action: "PAYMENT_CAPTURE",
        module: "finance",
        metadata: { provider: "mock-pos" },
        organizationId: organization.id,
        branchId: secondBranch.id
      }
    ]
  });

  console.log("ClinicNova seed completed");
  console.log("Demo users:");
  console.log("owner@clinicnova.test / password123");
  console.log("doctor@clinicnova.test / password123");
  console.log("receptionist@clinicnova.test / password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
