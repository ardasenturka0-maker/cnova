import {
  AppointmentStatus,
  BeforeAfterStatus,
  ChatbotCategory,
  ChatConversationChannel,
  ChatConversationStatus,
  ChatMessageSender,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationStatus,
  ConsentStatus,
  DigitalConsentStatus,
  Gender,
  IntegrationLogStatus,
  IntegrationProvider,
  InvoiceStatus,
  LeadFollowUpStatus,
  NotificationType,
  PatientTag,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  PostTreatmentFollowUpStatus,
  RecallStatus,
  ReservationShareChannel,
  ReservationShareStatus,
  ReviewPlatform,
  ReviewRequestStatus,
  Role,
  StockMovementType,
  TaskPriority,
  TaskStatus,
  TourismCurrency,
  TourismLeadSourceChannel,
  TourismLeadStatus,
  TourismPackageStatus,
  TourismSurveySource,
  TreatmentStatus
} from "@prisma/client";

const now = new Date();

function days(day: number) {
  return new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
}

function id(prefix: string, index: number) {
  return `${prefix}_${String(index).padStart(2, "0")}`;
}

const organization = {
  id: "org_demo",
  name: "Nova Dental Demo",
  slug: "nova-dental-demo",
  plan: "Kurumsal",
  createdAt: days(-80),
  updatedAt: now
};

const branches = [
  { id: "branch_01", name: "Nişantaşı Klinik", city: "İstanbul", address: "Teşvikiye Mah. Klinik Sok.", phone: "+90 212 555 10 10", organizationId: organization.id, createdAt: days(-80), updatedAt: now },
  { id: "branch_02", name: "Kadıköy Klinik", city: "İstanbul", address: "Bağdat Cad.", phone: "+90 216 555 20 20", organizationId: organization.id, createdAt: days(-70), updatedAt: now }
];

const users = [
  { id: "user_owner", name: "Derya Nova", email: "owner@clinicnova.test", passwordHash: "demo", role: Role.CLINIC_OWNER, active: true, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-80), updatedAt: now },
  { id: "user_doctor", name: "Dr. Emir Aydın", email: "doctor@clinicnova.test", passwordHash: "demo", role: Role.DOCTOR, active: true, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-70), updatedAt: now },
  { id: "user_receptionist", name: "Seda Resepsiyon", email: "receptionist@clinicnova.test", passwordHash: "demo", role: Role.RECEPTIONIST, active: true, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-65), updatedAt: now },
  { id: "user_accountant", name: "Barış Finans", email: "accountant@clinicnova.test", passwordHash: "demo", role: Role.ACCOUNTANT, active: true, organizationId: organization.id, branchId: branches[1].id, createdAt: days(-60), updatedAt: now },
  { id: "user_manager", name: "Melis Operasyon", email: "manager@clinicnova.test", passwordHash: "demo", role: Role.MANAGER, active: true, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-55), updatedAt: now }
];

const names = [
  ["Ayşe", "Yılmaz"],
  ["Mehmet", "Demir"],
  ["Elif", "Kaya"],
  ["Can", "Şahin"],
  ["Zeynep", "Çelik"],
  ["Mert", "Aydın"],
  ["Deniz", "Arslan"],
  ["Ece", "Koç"],
  ["Kerem", "Polat"],
  ["Selin", "Eren"],
  ["Bora", "Aksoy"],
  ["İpek", "Güneş"]
];

const patients = names.map(([firstName, lastName], index) => ({
  id: id("patient", index + 1),
  firstName,
  lastName,
  nationalId: index % 3 === 0 ? String(10000000000 + index) : null,
  phone: `+90 532 555 ${String(1000 + index).slice(0, 4)}`,
  phoneNormalized: `532555${String(1000 + index).slice(0, 4)}`,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@mail.test`,
  birthDate: new Date(Date.UTC(1985 + index, index % 12, 10)),
  gender: index % 2 === 0 ? Gender.FEMALE : Gender.MALE,
  address: "İstanbul",
  allergies: index % 5 === 0 ? "Penisilin hassasiyeti" : null,
  chronicDiseases: index % 7 === 0 ? "Hipertansiyon" : null,
  medications: index % 7 === 0 ? "Ramipril 5mg" : null,
  notes: index % 4 === 0 ? "Tedavi sonrası telefonla takip tercih ediyor." : null,
  tag: [PatientTag.NEW, PatientTag.ACTIVE, PatientTag.PASSIVE, PatientTag.RISKY, PatientTag.VIP][index % 5],
  lastVisitAt: days(-index),
  organizationId: organization.id,
  branchId: branches[index % branches.length].id,
  createdAt: days(-30 - index),
  updatedAt: now
}));

const treatmentTypes = ["Muayene", "Dolgu", "Kanal tedavisi", "İmplant", "Diş çekimi", "Protez", "Ortodonti", "Temizlik"];

const appointments = Array.from({ length: 28 }).map((_, index) => ({
  id: id("appointment", index + 1),
  patientId: patients[index % patients.length].id,
  doctorId: index % 2 === 0 ? users[1].id : users[0].id,
  startsAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + (index % 10) - 2, 9 + (index % 8), index % 2 ? 30 : 0),
  durationMinutes: [30, 45, 60][index % 3],
  room: `Koltuk ${(index % 4) + 1}`,
  treatmentType: treatmentTypes[index % treatmentTypes.length],
  status: [AppointmentStatus.PLANNED, AppointmentStatus.ARRIVED, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED][index % 5],
  notes: index % 6 === 0 ? "Hasta onayı bekleniyor." : null,
  organizationId: organization.id,
  branchId: patients[index % patients.length].branchId,
  createdAt: days(-index),
  updatedAt: now
}));

const treatmentPlans = Array.from({ length: 14 }).map((_, index) => ({
  id: id("plan", index + 1),
  patientId: patients[index % patients.length].id,
  doctorId: users[1].id,
  toothNumber: String((index % 32) + 1),
  treatmentType: treatmentTypes[index % treatmentTypes.length],
  description: "Kademeli tedavi planı ve kontrol randevusu oluşturuldu.",
  estimatedFee: 1800 + index * 350,
  status: [TreatmentStatus.PROPOSED, TreatmentStatus.ACCEPTED, TreatmentStatus.STARTED, TreatmentStatus.COMPLETED][index % 4],
  plannedAt: days(index - 7),
  organizationId: organization.id,
  branchId: patients[index % patients.length].branchId,
  createdAt: days(-index),
  updatedAt: now
}));

const treatments = Array.from({ length: 18 }).map((_, index) => ({
  id: id("treatment", index + 1),
  patientId: patients[index % patients.length].id,
  doctorId: users[1].id,
  toothNumber: String((index % 28) + 1),
  treatmentType: treatmentTypes[(index + 2) % treatmentTypes.length],
  description: "Klinik notu ve tedavi materyali kaydı.",
  fee: 900 + index * 240,
  paymentPlan: {
    total: 900 + index * 240,
    downPayment: index % 3 === 0 ? 300 : 0,
    installmentCount: (index % 4) + 1,
    firstInstallmentDate: days(7).toISOString().slice(0, 10),
    installments: Array.from({ length: (index % 4) + 1 }).map((__, installmentIndex) => ({
      number: installmentIndex + 1,
      dueDate: days(7 + installmentIndex * 30).toISOString().slice(0, 10),
      amount: Math.round(((900 + index * 240 - (index % 3 === 0 ? 300 : 0)) / ((index % 4) + 1)) * 100) / 100
    })),
    note: index % 2 === 0 ? "Kart ile aylık tahsilat planlandı." : null
  },
  status: [TreatmentStatus.ACCEPTED, TreatmentStatus.STARTED, TreatmentStatus.COMPLETED][index % 3],
  performedAt: days(-index),
  organizationId: organization.id,
  branchId: patients[index % patients.length].branchId,
  createdAt: days(-index),
  updatedAt: now
}));

const referralSources = ["Dr. Emir Aydın referansı", "Google araması", "Instagram", "Hasta tavsiyesi: Ayşe Yılmaz", null, "Web sitesi formu"];

const payments = Array.from({ length: 26 }).map((_, index) => {
  const isExpense = index % 8 === 0;
  const treatment = !isExpense && index % 6 !== 0 ? treatments[index % treatments.length] : null;
  const listAmount = isExpense ? null : treatment ? treatment.fee : 850 + index * 210;
  const discountAmount = !isExpense && index % 3 === 1 && listAmount ? Math.round(Number(listAmount) * 0.1) : null;
  const amount = isExpense ? 1500 + index * 80 : Math.max(Number(listAmount ?? 0) - Number(discountAmount ?? 0), 0);
  const status = [PaymentStatus.PAID, PaymentStatus.PENDING, PaymentStatus.CANCELLED][index % 3];

  return {
    id: id("payment", index + 1),
    patientId: treatment ? treatment.patientId : index % 6 === 0 ? null : patients[index % patients.length].id,
    treatmentId: treatment?.id ?? null,
    type: isExpense ? PaymentType.EXPENSE : PaymentType.INCOME,
    amount,
    listAmount,
    discountAmount,
    referralSource: isExpense ? null : referralSources[index % referralSources.length],
    method: [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER, PaymentMethod.ONLINE][index % 4],
    description: isExpense ? "Malzeme gideri" : "Tedavi tahsilatı",
    status,
    paidAt: days(-index),
    dueDate: status === PaymentStatus.PENDING ? days(14 - index) : null,
    organizationId: organization.id,
    branchId: patients[index % patients.length].branchId,
    createdAt: days(-index),
    updatedAt: now
  };
});

const invoices = payments.slice(0, 12).map((payment, index) => ({
  id: id("invoice", index + 1),
  number: `CNV-2026-${String(index + 1).padStart(4, "0")}`,
  patientId: payment.patientId,
  paymentId: payment.id,
  total: payment.amount,
  status: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PAID][index % 3],
  providerRef: index % 2 === 0 ? `mock-efatura-${index + 1}` : null,
  issuedAt: index % 3 === 0 ? days(-index) : null,
  organizationId: organization.id,
  branchId: payment.branchId,
  createdAt: days(-index),
  updatedAt: now
}));

const stockItems = ["Kompozit dolgu", "Anestezi kartuşu", "Eldiven", "Maske", "Sterilizasyon poşeti", "İmplant vida", "Bonding ajan", "Frez seti"].map((name, index) => ({
  id: id("stock", index + 1),
  name,
  category: ["Sarf", "Cerrahi", "Sterilizasyon", "Ortodonti"][index % 4],
  currentQuantity: index % 3 === 0 ? 5 + index : 26 + index * 3,
  minimumQuantity: 12,
  unit: ["adet", "kutu", "paket"][index % 3],
  supplier: ["Medikal Plus", "DentalLine", "Nova Tedarik"][index % 3],
  purchasePrice: 180 + index * 45,
  organizationId: organization.id,
  branchId: branches[index % branches.length].id,
  createdAt: days(-20 - index),
  updatedAt: now
}));

const stockMovements = stockItems.flatMap((item, index) => [
  { id: id("movement_in", index + 1), itemId: item.id, type: StockMovementType.IN, quantity: 20 + index, note: "Demo giriş", movedAt: days(-index - 4), organizationId: organization.id, branchId: item.branchId, createdAt: days(-index - 4), updatedAt: now },
  { id: id("movement_out", index + 1), itemId: item.id, type: StockMovementType.OUT, quantity: 3 + index, note: "Tedavi sarf çıkışı", movedAt: days(-index), organizationId: organization.id, branchId: item.branchId, createdAt: days(-index), updatedAt: now }
]);
const stockOffers: any[] = [];

const staff = [
  { id: "staff_01", fullName: "Dr. Emir Aydın", roleLabel: "Hekim", phone: "+90 532 555 2001", email: "emir@clinicnova.test", workingHours: "09:00-18:00", compensation: "%35 hakediş", active: true, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-50), updatedAt: now },
  { id: "staff_02", fullName: "Dr. Lara Er", roleLabel: "Hekim", phone: "+90 532 555 2002", email: "lara@clinicnova.test", workingHours: "10:00-19:00", compensation: "%40 hakediş", active: true, organizationId: organization.id, branchId: branches[1].id, createdAt: days(-45), updatedAt: now },
  { id: "staff_03", fullName: "Seda Resepsiyon", roleLabel: "Resepsiyon", phone: "+90 532 555 2003", email: "seda@clinicnova.test", workingHours: "09:00-18:00", compensation: "Aylık maaş", active: true, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-40), updatedAt: now }
];

const doctorProfiles = staff.slice(0, 2).map((person, index) => ({
  id: id("doctor_profile", index + 1),
  staffId: person.id,
  specialty: index === 0 ? "İmplantoloji" : "Ortodonti",
  room: `Koltuk ${index + 1}`,
  satisfactionScore: 4.6 + index / 10,
  weeklySchedule: { monday: ["09:00", "18:00"], tuesday: ["09:00", "18:00"], thursday: ["10:00", "19:00"] },
  createdAt: days(-30),
  updatedAt: now
}));

const consents = patients.slice(0, 7).map((patient, index) => ({
  id: id("consent", index + 1),
  patientId: patient.id,
  templateName: ["İmplant Onamı", "Kanal Tedavisi Onamı", "KVKK Açık Rıza"][index % 3],
  content: "Hasta işlem, riskler ve alternatifler hakkında bilgilendirildi.",
  status: [ConsentStatus.DRAFT, ConsentStatus.SENT, ConsentStatus.SIGNED][index % 3],
  timestamp: days(-index),
  signedAt: index % 3 === 2 ? days(-index + 1) : null,
  organizationId: organization.id,
  branchId: patient.branchId,
  createdAt: days(-index),
  updatedAt: now
}));

const surveys = [{ id: "survey_01", title: "Tedavi Sonrası Memnuniyet", description: "Kısa deneyim anketi", active: true, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-20), updatedAt: now }];
const surveyResponses = patients.slice(0, 10).map((patient, index) => ({
  id: id("survey_response", index + 1),
  surveyId: surveys[0].id,
  patientId: patient.id,
  score: (index % 5) + 1,
  comment: index % 5 < 2 ? "Bekleme süresi takip edilmeli." : "Ekip ilgiliydi.",
  followUpNeeded: index % 5 < 2,
  organizationId: organization.id,
  branchId: patient.branchId,
  createdAt: days(-index),
  updatedAt: now
}));

const communicationLogs = patients.slice(0, 12).map((patient, index) => ({
  id: id("comm", index + 1),
  patientId: patient.id,
  channel: [CommunicationChannel.WHATSAPP, CommunicationChannel.SMS, CommunicationChannel.EMAIL, CommunicationChannel.PHONE][index % 4],
  direction: index % 3 === 0 ? CommunicationDirection.INBOUND : CommunicationDirection.OUTBOUND,
  subject: index % 3 === 0 ? ["Randevu değişikliği", "Ödeme planı sorusu", "Tedavi sonrası hassasiyet", "Kontrol talebi"][index % 4] : index % 2 === 0 ? "Randevu hatırlatma" : "Tedavi sonrası takip",
  source: index % 3 === 0 ? ["WhatsApp yanıtı", "Telefon araması", "E-posta cevabı", "SMS yanıtı"][index % 4] : "Klinik paneli",
  contactName: `${patient.firstName} ${patient.lastName}`,
  contactValue: [patient.phone, patient.phone, patient.email ?? patient.phone, patient.phone][index % 4],
  message: index % 3 === 0 ? "Hasta dönüş yaptı, ekip aksiyon bekliyor." : index % 2 === 0 ? "Randevu hatırlatma mesajı" : "Tedavi sonrası takip mesajı",
  status: index % 3 === 0 ? CommunicationStatus.SENT : [CommunicationStatus.QUEUED, CommunicationStatus.SENT, CommunicationStatus.FAILED][index % 3],
  provider: index % 3 === 0 ? "manuel-kayıt" : "mock-provider",
  providerRef: `mock-${index + 1}`,
  organizationId: organization.id,
  branchId: patient.branchId,
  createdAt: days(-index),
  updatedAt: now
}));

const tourismLeadSources = [
  ...Array(10).fill(TourismLeadSourceChannel.WHATSAPP),
  ...Array(8).fill(TourismLeadSourceChannel.INSTAGRAM_DM),
  ...Array(7).fill(TourismLeadSourceChannel.WEB_FORM),
  ...Array(5).fill(TourismLeadSourceChannel.MANUAL)
] as TourismLeadSourceChannel[];
const tourismCountries = ["United Kingdom", "Germany", "Netherlands", "France", "USA", "Saudi Arabia", "Turkey"];
const tourismCities = ["London", "Berlin", "Amsterdam", "Paris", "New York", "Riyadh", "Istanbul"];
const tourismTreatments = ["Dental Implant", "Hollywood Smile", "Veneers", "Teeth Whitening", "Full Mouth Restoration", "Zirconium Crown"];
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
const tourismLeadNames = [
  "John Smith",
  "Emily Carter",
  "Lukas Weber",
  "Sophie Müller",
  "Noah de Vries",
  "Camille Laurent",
  "Michael Brown",
  "Aisha Al Saud",
  "Oliver Wilson",
  "Emma Johnson",
  "Hannah Becker",
  "Thomas Martin",
  "Mia van Dijk",
  "Lucas Bernard",
  "Sarah Davis",
  "Omar Al Rashid",
  "James Taylor",
  "Laura Hoffmann",
  "Anna Jansen",
  "Nora Petit",
  "Daniel Clark",
  "Fatima Khan",
  "Ryan Miller",
  "Julia Fischer",
  "Eva Smit",
  "Chloe Dubois",
  "Ethan Walker",
  "Yusuf Demir",
  "Grace Lee",
  "Mason Hall"
];

const leads = tourismLeadNames.map((fullName, index) => {
  const countryIndex = index % tourismCountries.length;
  const sourceChannel = tourismLeadSources[index];
  const leadStatus = tourismLeadStatuses[index % tourismLeadStatuses.length];
  const phonePrefix = ["+44", "+49", "+31", "+33", "+1", "+966", "+90"][countryIndex];
  return {
    id: id("lead", index + 1),
    organizationId: organization.id,
    branchId: branches[index % branches.length].id,
    sourceChannel,
    fullName,
    phone: `${phonePrefix} 700 000 ${String(1000 + index).slice(0, 4)}`,
    email: `${fullName.toLowerCase().replaceAll(" ", ".")}@tourism.test`,
    country: tourismCountries[countryIndex],
    city: tourismCities[countryIndex],
    language: countryIndex === 6 ? "TR" : "EN",
    interestedTreatment: tourismTreatments[index % tourismTreatments.length],
    estimatedBudget: [`3000-5000 EUR`, `5000-8000 EUR`, `8000-12000 EUR`, `2500-4000 GBP`][index % 4],
    travelDate: days(18 + index),
    message: index % 2 === 0 ? "I want treatment, hotel and airport transfer package." : "Could you send price and travel details?",
    leadStatus,
    leadScore: Math.min(98, 42 + ((index * 7) % 56)),
    assignedToUserId: [users[2].id, users[4].id, users[0].id][index % 3],
    lastContactAt: index % 3 === 0 ? days(-index) : null,
    nextFollowUpAt: followUpCandidateStatuses.includes(leadStatus) ? days((index % 3) - 1) : null,
    gdprConsent: index % 5 !== 0,
    notes: index % 4 === 0 ? "Röntgen/fotoğraf bekleniyor; seyahat tarihi sıcak." : null,
    createdAt: days(-index - 1),
    updatedAt: now
  };
});

const leadMessages = leads.flatMap((lead, index) => [
  {
    id: id("lead_msg_in", index + 1),
    leadId: lead.id,
    organizationId: organization.id,
    branchId: lead.branchId,
    direction: CommunicationDirection.INBOUND,
    channel: lead.sourceChannel === TourismLeadSourceChannel.INSTAGRAM_DM ? CommunicationChannel.WHATSAPP : lead.sourceChannel === TourismLeadSourceChannel.WEB_FORM ? CommunicationChannel.EMAIL : CommunicationChannel.WHATSAPP,
    source: lead.sourceChannel,
    subject: lead.interestedTreatment,
    message: lead.message,
    createdByUserId: null,
    createdAt: lead.createdAt,
    updatedAt: now
  },
  {
    id: id("lead_msg_out", index + 1),
    leadId: lead.id,
    organizationId: organization.id,
    branchId: lead.branchId,
    direction: CommunicationDirection.OUTBOUND,
    channel: index % 3 === 0 ? CommunicationChannel.EMAIL : CommunicationChannel.WHATSAPP,
    source: "Sales CRM",
    subject: "İlk danışman dönüşü",
    message: lead.language === "TR" ? "Merhaba, tedavi + otel + transfer paketinizi hazırlayabiliriz." : "Hi, our team can prepare your treatment + hotel + transfer package.",
    createdByUserId: lead.assignedToUserId,
    createdAt: days(-index + 1),
    updatedAt: now
  }
]);

const hotelPartners = [
  { id: "hotel_01", organizationId: organization.id, branchId: branches[0].id, name: "Nova Stay Bomonti", contactPerson: "Ece Turan", phone: "+90 212 555 33 10", email: "sales@novastay.test", city: "İstanbul", district: "Şişli", address: "Bomonti Cad.", starRating: 4, pricePerNight: 95, currency: TourismCurrency.EUR, notes: "Klinik transferine 12 dk.", active: true, createdAt: days(-40), updatedAt: now },
  { id: "hotel_02", organizationId: organization.id, branchId: branches[0].id, name: "Bosphorus Care Hotel", contactPerson: "Murat Kaya", phone: "+90 212 555 33 20", email: "health@bosphoruscare.test", city: "İstanbul", district: "Beşiktaş", address: "Barbaros Bulvarı", starRating: 5, pricePerNight: 150, currency: TourismCurrency.EUR, notes: "VIP hasta odaları uygun.", active: true, createdAt: days(-38), updatedAt: now },
  { id: "hotel_03", organizationId: organization.id, branchId: branches[1].id, name: "Kadıköy Comfort Suites", contactPerson: "Selin Ar", phone: "+90 216 555 33 30", email: "booking@comfort.test", city: "İstanbul", district: "Kadıköy", address: "Bağdat Cad.", starRating: 4, pricePerNight: 80, currency: TourismCurrency.EUR, notes: "Anadolu yakası hastalar için ekonomik.", active: true, createdAt: days(-35), updatedAt: now }
];

const transferPartners = [
  { id: "transfer_01", organizationId: organization.id, branchId: branches[0].id, name: "Nova VIP Transfer", contactPerson: "Ali Demir", phone: "+90 532 555 44 10", email: "ops@novavip.test", vehicleTypes: ["Vito", "Mercedes E", "Minivan"], airportList: ["IST", "SAW"], basePrice: 65, currency: TourismCurrency.EUR, notes: "24/7 sağlık turizmi operasyonu.", active: true, createdAt: days(-32), updatedAt: now },
  { id: "transfer_02", organizationId: organization.id, branchId: branches[1].id, name: "CareRoute İstanbul", contactPerson: "Dilan Yüce", phone: "+90 532 555 44 20", email: "dispatch@careroute.test", vehicleTypes: ["Sedan", "Vito"], airportList: ["IST", "SAW"], basePrice: 55, currency: TourismCurrency.EUR, notes: "İngilizce sürücü opsiyonu.", active: true, createdAt: days(-31), updatedAt: now }
];

const tourismPackages = leads.slice(0, 5).map((lead, index) => {
  const treatmentPrice = 3600 + index * 1150;
  const nights = 4 + index;
  const hotelPrice = nights * Number(hotelPartners[index % hotelPartners.length].pricePerNight);
  const transferPrice = Number(transferPartners[index % transferPartners.length].basePrice) * 2;
  const discount = index % 2 === 0 ? 250 : 0;
  return {
    id: id("tour_pkg", index + 1),
    organizationId: organization.id,
    branchId: lead.branchId,
    leadId: lead.id,
    patientId: index < patients.length ? patients[index].id : null,
    publicToken: `pkg-demo-${index + 1}`,
    packageTitle: `${lead.interestedTreatment} + Hotel + Transfer`,
    treatmentSummary: `${lead.interestedTreatment} için kişiselleştirilmiş sağlık turizmi paketi.`,
    hotelInfo: `${hotelPartners[index % hotelPartners.length].name}, ${nights} gece`,
    transferInfo: `${transferPartners[index % transferPartners.length].name}, çift yön havalimanı transferi`,
    arrivalAirport: index % 2 === 0 ? "IST" : "SAW",
    arrivalDate: days(24 + index * 3),
    departureDate: days(28 + index * 3),
    numberOfCompanions: index % 3,
    totalTreatmentPrice: treatmentPrice,
    hotelPrice,
    transferPrice,
    discount,
    finalPrice: treatmentPrice + hotelPrice + transferPrice - discount,
    currency: [TourismCurrency.EUR, TourismCurrency.GBP, TourismCurrency.USD][index % 3],
    packageStatus: [TourismPackageStatus.SENT, TourismPackageStatus.ACCEPTED, TourismPackageStatus.VIEWED, TourismPackageStatus.DRAFT, TourismPackageStatus.SENT][index],
    validUntil: days(14 + index),
    notes: "Paket kabul edilirse n8n mock ile otel ve transfer firmasına paylaşılacak.",
    createdByUserId: lead.assignedToUserId,
    createdAt: days(-index - 2),
    updatedAt: now
  };
});

const treatmentPackageItems = tourismPackages.flatMap((pkg, packageIndex) => [
  { id: id(`tour_pkg_${packageIndex + 1}_item`, 1), packageId: pkg.id, organizationId: organization.id, treatmentName: leads[packageIndex].interestedTreatment, toothArea: packageIndex % 2 === 0 ? "Upper / Lower jaw" : "Smile zone", quantity: 1, unitPrice: Number(pkg.totalTreatmentPrice), totalPrice: Number(pkg.totalTreatmentPrice), estimatedDuration: packageIndex % 2 === 0 ? "5-7 days" : "3-5 days", explanation: "Röntgen ve fotoğraf incelemesi sonrası netleşir.", createdAt: pkg.createdAt, updatedAt: now },
  { id: id(`tour_pkg_${packageIndex + 1}_item`, 2), packageId: pkg.id, organizationId: organization.id, treatmentName: "Online consultation", toothArea: null, quantity: 1, unitPrice: 0, totalPrice: 0, estimatedDuration: "30 min", explanation: "Tedavi öncesi danışmanlık dahildir.", createdAt: pkg.createdAt, updatedAt: now }
]);

const reservationShares = tourismPackages.filter((pkg) => pkg.packageStatus !== TourismPackageStatus.DRAFT).map((pkg, index) => ({
  id: id("reservation_share", index + 1),
  organizationId: organization.id,
  branchId: pkg.branchId,
  packageId: pkg.id,
  leadId: pkg.leadId,
  hotelPartnerId: hotelPartners[index % hotelPartners.length].id,
  transferPartnerId: transferPartners[index % transferPartners.length].id,
  sharedVia: ReservationShareChannel.N8N,
  payloadJson: { packageId: pkg.id, hotel: pkg.hotelInfo, transfer: pkg.transferInfo, airport: pkg.arrivalAirport },
  status: pkg.packageStatus === TourismPackageStatus.ACCEPTED ? ReservationShareStatus.CONFIRMED : ReservationShareStatus.SENT,
  createdAt: days(-index - 1),
  updatedAt: now
}));

const followUpSequences = [
  {
    id: "follow_seq_01",
    organizationId: organization.id,
    branchId: branches[0].id,
    name: "3/7/14 gün satış kurtarma dizisi",
    description: "Cevap vermeyen lead için TR/EN WhatsApp ve e-posta takip akışı.",
    active: true,
    stepsJson: [
      { dayOffset: 3, channel: "WHATSAPP", language: "TR", messageTemplate: "Merhaba {{name}}, diş tedavinizle ilgili bilgi talebinizi aldık. Devam etmek ister misiniz?", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST", "TREATMENT_STARTED"] },
      { dayOffset: 7, channel: "WHATSAPP", language: "EN", messageTemplate: "Hi {{name}}, do you have any questions about treatment price, duration, hotel or airport transfer in Turkey?", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST", "TREATMENT_STARTED"] },
      { dayOffset: 14, channel: "EMAIL", language: "EN", messageTemplate: "Hi {{name}}, your consultation request is still open. Would you like us to prepare a treatment + hotel + transfer package?", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST", "TREATMENT_STARTED"] }
    ],
    createdAt: days(-25),
    updatedAt: now
  },
  { id: "follow_seq_02", organizationId: organization.id, branchId: branches[0].id, name: "Instagram sıcak lead dönüşü", description: "DM sonrası hızlı fiyat ve fotoğraf isteme akışı.", active: true, stepsJson: [{ dayOffset: 1, channel: "WHATSAPP", language: "EN", messageTemplate: "Could you share photos or X-ray so our doctors can prepare a precise plan?", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST"] }], createdAt: days(-20), updatedAt: now },
  { id: "follow_seq_03", organizationId: organization.id, branchId: branches[1].id, name: "Paket sonrası karar destek", description: "Paket gönderilmiş ancak dönüş alınmamış leadler.", active: true, stepsJson: [{ dayOffset: 3, channel: "EMAIL", language: "EN", messageTemplate: "Your package is ready. We can adjust hotel, transfer or dates if needed.", stopIfLeadReplied: true, stopIfStatusIn: ["BOOKED", "LOST"] }], createdAt: days(-18), updatedAt: now }
];

const leadFollowUps = leads.filter((lead) => activeFollowUpStatuses.includes(lead.leadStatus)).slice(0, 12).map((lead, index) => ({
  id: id("lead_follow", index + 1),
  organizationId: organization.id,
  branchId: lead.branchId,
  leadId: lead.id,
  sequenceId: followUpSequences[index % followUpSequences.length].id,
  currentStep: index % 3,
  nextRunAt: days((index % 4) - 2),
  status: index % 5 === 0 ? LeadFollowUpStatus.PAUSED : LeadFollowUpStatus.ACTIVE,
  lastMessageAt: index % 2 === 0 ? days(-index) : null,
  createdAt: days(-index - 2),
  updatedAt: now
}));

const postTreatmentFollowUps = tourismPackages.slice(0, 4).map((pkg, index) => ({
  id: id("post_care", index + 1),
  organizationId: organization.id,
  branchId: pkg.branchId,
  patientId: patients[index].id,
  treatmentId: treatments[index].id,
  packageId: pkg.id,
  publicToken: `care-demo-${index + 1}`,
  returnCountry: leads[index].country,
  returnDate: days(-index - 4),
  followUpDay: [3, 7, 14, 30][index],
  nextMessageAt: days((index % 3) - 1),
  status: [PostTreatmentFollowUpStatus.SCHEDULED, PostTreatmentFollowUpStatus.SENT, PostTreatmentFollowUpStatus.ISSUE_REPORTED, PostTreatmentFollowUpStatus.COMPLETED][index],
  issueReported: index === 2,
  issueDescription: index === 2 ? "Hassasiyet ve gece ağrısı bildirildi." : null,
  painLevel: index === 2 ? 7 : null,
  createdAt: days(-index - 5),
  updatedAt: now
}));

const reviewRequests = Array.from({ length: 10 }).map((_, index) => ({
  id: id("review_req", index + 1),
  organizationId: organization.id,
  branchId: patients[index % patients.length].branchId,
  patientId: patients[index % patients.length].id,
  treatmentId: treatments[index % treatments.length].id,
  packageId: tourismPackages[index % tourismPackages.length]?.id ?? null,
  platform: [ReviewPlatform.GOOGLE, ReviewPlatform.TRUSTPILOT, ReviewPlatform.CUSTOM][index % 3],
  reviewLink: index % 2 === 0 ? "https://reviews.google.test/clinicnova" : "https://trustpilot.test/clinicnova",
  scheduledAt: days(index - 5),
  sentAt: index % 3 === 0 ? days(index - 4) : null,
  status: [ReviewRequestStatus.SCHEDULED, ReviewRequestStatus.SENT, ReviewRequestStatus.CLICKED, ReviewRequestStatus.COMPLETED, ReviewRequestStatus.FAILED][index % 5],
  language: index % 4 === 0 ? "TR" : "EN",
  messageTemplate: index % 4 === 0 ? "Merhaba {{name}}, memnun kaldıysanız kısa bir yorum bırakmanız bizi mutlu eder: {{reviewLink}}" : "Hi {{name}}, if you were happy with your treatment, we would really appreciate a short review: {{reviewLink}}",
  createdAt: days(-index - 3),
  updatedAt: now
}));

const beforeAfterCases = patients.slice(0, 6).map((patient, index) => ({
  id: id("before_after", index + 1),
  organizationId: organization.id,
  branchId: patient.branchId,
  patientId: patient.id,
  treatmentType: ["Implant", "Veneers", "Hollywood Smile", "Whitening", "Zirconium Crown", "Full Mouth Restoration"][index],
  title: `${["Implant", "Veneer", "Smile design", "Whitening", "Crown", "Restoration"][index]} vaka #${index + 1}`,
  description: "Onaylı önce/sonra vaka anlatımı ve sosyal medya açıklaması mock üretilebilir.",
  beforeImageUrl: `https://placehold.co/640x420?text=Before+${index + 1}`,
  afterImageUrl: `https://placehold.co/640x420?text=After+${index + 1}`,
  consentGiven: index !== 1,
  consentId: index !== 1 ? id("digital_consent", index + 1) : null,
  country: tourismCountries[index % tourismCountries.length],
  ageRange: ["25-34", "35-44", "45-54"][index % 3],
  gender: index % 2 === 0 ? "Female" : "Male",
  tags: ["smile-design", tourismTreatments[index % tourismTreatments.length].toLowerCase().replaceAll(" ", "-")],
  privacyNotes: "Yüz görünürlüğü ve KVKK/GDPR izni kontrol edildi.",
  status: [BeforeAfterStatus.APPROVED, BeforeAfterStatus.DRAFT, BeforeAfterStatus.PUBLISHED_WEBSITE, BeforeAfterStatus.PUBLISHED_SOCIAL, BeforeAfterStatus.APPROVED, BeforeAfterStatus.ARCHIVED][index],
  createdAt: days(-index - 6),
  updatedAt: now
}));

const consentTemplates = [
  { id: "consent_template_01", organizationId: organization.id, branchId: branches[0].id, title: "International Implant Consent", language: "EN", content: "This demo consent explains treatment risks, travel timing, hotel/transfer data sharing and aftercare responsibilities.", treatmentType: "Dental Implant", active: true, createdAt: days(-30), updatedAt: now },
  { id: "consent_template_02", organizationId: organization.id, branchId: branches[0].id, title: "Sağlık Turizmi KVKK Rızası", language: "TR", content: "Bu demo rıza metni tedavi, konaklama, transfer ve iletişim verilerinin işlenmesini açıklar.", treatmentType: "Health Tourism", active: true, createdAt: days(-30), updatedAt: now }
];

const digitalConsents = leads.slice(0, 8).map((lead, index) => ({
  id: id("digital_consent", index + 1),
  organizationId: organization.id,
  branchId: lead.branchId,
  patientId: index < patients.length ? patients[index].id : null,
  leadId: lead.id,
  templateId: consentTemplates[index % consentTemplates.length].id,
  title: consentTemplates[index % consentTemplates.length].title,
  contentSnapshot: consentTemplates[index % consentTemplates.length].content,
  language: lead.language,
  publicToken: `consent-demo-${index + 1}`,
  status: [DigitalConsentStatus.SENT, DigitalConsentStatus.SIGNED, DigitalConsentStatus.VIEWED, DigitalConsentStatus.DRAFT][index % 4],
  signedAt: index % 4 === 1 ? days(-index) : null,
  signerName: index % 4 === 1 ? lead.fullName : null,
  signerIp: index % 4 === 1 ? "127.0.0.1" : null,
  signerUserAgent: index % 4 === 1 ? "Mock Browser" : null,
  signatureData: index % 4 === 1 ? `signature-${lead.fullName}` : null,
  sourceConsentId: null,
  createdAt: days(-index - 2),
  updatedAt: now
}));

const surveyTemplates = [
  {
    id: "tour_survey_template_01",
    organizationId: organization.id,
    branchId: branches[0].id,
    title: "International Patient Satisfaction",
    language: "EN",
    questionsJson: ["Overall satisfaction", "Doctor attention", "Clinic hygiene", "Transfer experience", "Hotel experience", "Turkey experience", "NPS"],
    active: true,
    createdAt: days(-25),
    updatedAt: now
  }
];

const tourismSurveyResponses = patients.slice(0, 8).map((patient, index) => ({
  id: id("tour_survey_response", index + 1),
  surveyId: surveys[0].id,
  patientId: patient.id,
  treatmentId: treatments[index % treatments.length].id,
  packageId: tourismPackages[index % tourismPackages.length].id,
  surveyTemplateId: surveyTemplates[0].id,
  score: (index % 5) + 1,
  rating: (index % 5) + 1,
  comment: index % 5 < 2 ? "Hotel transfer timing needs attention." : "Everything was smooth, thank you.",
  answersJson: { doctor: 5 - (index % 2), clinic: 5, transfer: 4, hotel: 4, turkey: 5 },
  npsScore: [10, 9, 8, 6, 4][index % 5],
  submittedAt: days(-index),
  source: [TourismSurveySource.WHATSAPP, TourismSurveySource.EMAIL, TourismSurveySource.WEB_LINK][index % 3],
  followUpNeeded: index % 5 < 2,
  organizationId: organization.id,
  branchId: patient.branchId,
  createdAt: days(-index),
  updatedAt: now
}));

const allSurveyResponses = [...surveyResponses, ...tourismSurveyResponses];

const chatbotKnowledgeBase = [
  { id: "kb_01", organizationId: organization.id, branchId: branches[0].id, question: "How much is dental implant?", answer: "For dental implant treatments, the final price depends on your X-ray, bone condition and treatment plan. If you share photos or X-ray, our team can prepare a personalized package including treatment, hotel and airport transfer.", language: "EN", category: ChatbotCategory.PRICE, active: true, createdAt: days(-18), updatedAt: now },
  { id: "kb_02", organizationId: organization.id, branchId: branches[0].id, question: "İmplant fiyatı nedir?", answer: "İmplant tedavisinde net fiyat; röntgen, kemik durumu ve tedavi planına göre değişir. Fotoğraf veya röntgen paylaşırsanız ekibimiz tedavi, otel ve transfer dahil size özel paket hazırlayabilir.", language: "TR", category: ChatbotCategory.PRICE, active: true, createdAt: days(-18), updatedAt: now },
  { id: "kb_03", organizationId: organization.id, branchId: branches[0].id, question: "Do you provide hotel and transfer?", answer: "Yes, we can prepare packages including treatment, hotel and airport transfer through our partner network.", language: "EN", category: ChatbotCategory.HOTEL, active: true, createdAt: days(-18), updatedAt: now }
];

const chatConversations = leads.slice(0, 6).map((lead, index) => ({
  id: id("chat_conv", index + 1),
  organizationId: organization.id,
  branchId: lead.branchId,
  leadId: lead.id,
  channel: [ChatConversationChannel.WEBSITE, ChatConversationChannel.WHATSAPP, ChatConversationChannel.INSTAGRAM][index % 3],
  language: lead.language,
  status: index % 2 === 0 ? ChatConversationStatus.HUMAN_NEEDED : ChatConversationStatus.BOT_HANDLED,
  createdAt: days(-index - 1),
  updatedAt: now
}));

const chatMessages = chatConversations.flatMap((conversation, index) => [
  { id: id("chat_msg_patient", index + 1), organizationId: organization.id, conversationId: conversation.id, sender: ChatMessageSender.PATIENT, message: "How much for implants with hotel?", createdAt: days(-index - 1), updatedAt: now },
  { id: id("chat_msg_bot", index + 1), organizationId: organization.id, conversationId: conversation.id, sender: ChatMessageSender.BOT, message: chatbotKnowledgeBase[0].answer, createdAt: days(-index - 1), updatedAt: now }
]);

const notifications = [
  { id: "notification_01", organizationId: organization.id, userId: users[2].id, title: "Yeni sıcak lead", message: "John Smith implant + otel paketi için dönüş bekliyor.", type: NotificationType.LEAD, read: false, actionUrl: "/dashboard/tourism/leads", createdAt: days(-1) },
  { id: "notification_02", organizationId: organization.id, userId: users[4].id, title: "Paket kabul edildi", message: "Emily Carter paketi kabul etti; otel/transfer paylaşımı hazır.", type: NotificationType.PACKAGE, read: false, actionUrl: "/dashboard/tourism/hotel-transfer", createdAt: days(-1) },
  { id: "notification_03", organizationId: organization.id, userId: users[1].id, title: "Tedavi sonrası sorun", message: "Bir hasta hassasiyet bildirdi, hekim kontrolü gerekiyor.", type: NotificationType.ISSUE, read: false, actionUrl: "/dashboard/tourism/post-treatment", createdAt: days(-2) }
];

const tasks = [
  { id: "task_01", organizationId: organization.id, branchId: branches[0].id, assignedToUserId: users[2].id, relatedLeadId: leads[0].id, relatedPatientId: null, title: "John Smith için paket gönder", description: "Fotoğraf ve bütçe bilgisi var, satış kaybı riski yüksek.", priority: TaskPriority.HIGH, status: TaskStatus.TODO, dueDate: days(1), createdAt: days(-1), updatedAt: now },
  { id: "task_02", organizationId: organization.id, branchId: branches[0].id, assignedToUserId: users[4].id, relatedLeadId: leads[1].id, relatedPatientId: patients[1].id, title: "Otel ve transfer rezervasyonunu doğrula", description: "Paket kabul edildi, n8n paylaşımı sonrası firma teyidi bekleniyor.", priority: TaskPriority.URGENT, status: TaskStatus.IN_PROGRESS, dueDate: days(0), createdAt: days(-1), updatedAt: now },
  { id: "task_03", organizationId: organization.id, branchId: branches[0].id, assignedToUserId: users[1].id, relatedLeadId: null, relatedPatientId: patients[2].id, title: "Tedavi sonrası ağrı bildirimi", description: "Uzaktan takip formunda ağrı seviyesi 7 bildirildi.", priority: TaskPriority.URGENT, status: TaskStatus.TODO, dueDate: days(0), createdAt: days(-2), updatedAt: now }
];

const integrationLogs = [
  { id: "integration_01", organizationId: organization.id, branchId: branches[0].id, provider: IntegrationProvider.AIRTABLE, eventType: "lead.sync", payloadJson: { leadId: leads[0].id }, responseJson: { ok: true, mode: "mock" }, status: IntegrationLogStatus.SUCCESS, errorMessage: null, createdAt: days(-1) },
  { id: "integration_02", organizationId: organization.id, branchId: branches[0].id, provider: IntegrationProvider.N8N, eventType: "reservation.share", payloadJson: { packageId: tourismPackages[1].id }, responseJson: { workflow: "mock-reservation-share" }, status: IntegrationLogStatus.SUCCESS, errorMessage: null, createdAt: days(-1) },
  { id: "integration_03", organizationId: organization.id, branchId: branches[0].id, provider: IntegrationProvider.WHATSAPP, eventType: "followup.sent", payloadJson: { leadId: leads[2].id }, responseJson: { queued: true }, status: IntegrationLogStatus.PENDING, errorMessage: null, createdAt: days(0) }
];

const recalls = patients.slice(0, 8).map((patient, index) => ({
  id: id("recall", index + 1),
  patientId: patient.id,
  reason: ["6 aylık kontrol", "İmplant kontrolü", "Tedavi sonrası takip"][index % 3],
  dueDate: days(index - 3),
  status: [RecallStatus.OPEN, RecallStatus.CONTACTED, RecallStatus.SCHEDULED][index % 3],
  notes: "Kontrol randevusu için iletişime geçilecek.",
  organizationId: organization.id,
  branchId: patient.branchId,
  createdAt: days(-index),
  updatedAt: now
}));

const reportSnapshots = [
  { id: "report_01", type: "monthly-revenue", title: "Aylık Gelir Raporu", payload: { revenue: 285000 }, periodStart: days(-30), periodEnd: now, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-1), updatedAt: now },
  { id: "report_02", type: "branch-comparison", title: "Şube Karşılaştırması", payload: { nisantasi: 184000, kadikoy: 101000 }, periodStart: days(-30), periodEnd: now, organizationId: organization.id, branchId: null, createdAt: days(-1), updatedAt: now }
];

const auditLogs = [
  { id: "audit_01", userId: users[0].id, action: "LOGIN", module: "auth", entityId: null, metadata: { source: "demo" }, ip: null, userAgent: null, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-1), updatedAt: now },
  { id: "audit_02", userId: users[2].id, action: "SEND_REMINDER", module: "appointments", entityId: null, metadata: { provider: "mock-whatsapp" }, ip: null, userAgent: null, organizationId: organization.id, branchId: branches[0].id, createdAt: days(-1), updatedAt: now }
];

function branchOf(branchId: string | null | undefined) {
  return branches.find((branch) => branch.id === branchId) ?? branches[0];
}

function userOf(userId: string | null | undefined) {
  return users.find((user) => user.id === userId) ?? users[0];
}

function patientOf(patientId: string | null | undefined) {
  return patients.find((patient) => patient.id === patientId) ?? null;
}

function richPatient(patient: any) {
  return {
    ...patient,
    organization,
    branch: branchOf(patient.branchId),
    appointments: appointments.filter((item) => item.patientId === patient.id).map(richAppointment),
    treatmentPlans: treatmentPlans.filter((item) => item.patientId === patient.id).map(richTreatmentPlan),
    treatments: treatments.filter((item) => item.patientId === patient.id).map(richTreatment),
    payments: payments.filter((item) => item.patientId === patient.id),
    invoices: invoices.filter((item) => item.patientId === patient.id),
    consents: consents.filter((item) => item.patientId === patient.id),
    surveyResponses: allSurveyResponses.filter((item) => item.patientId === patient.id).map(richSurveyResponse),
    communication: communicationLogs.filter((item) => item.patientId === patient.id),
    recalls: recalls.filter((item) => item.patientId === patient.id)
  };
}

function richAppointment(item: any) {
  return { ...item, patient: patientOf(item.patientId), doctor: userOf(item.doctorId), branch: branchOf(item.branchId) };
}

function richTreatment(item: any) {
  return { ...item, patient: patientOf(item.patientId), doctor: userOf(item.doctorId), branch: branchOf(item.branchId) };
}

function richTreatmentPlan(item: any) {
  return { ...item, patient: patientOf(item.patientId), doctor: userOf(item.doctorId), branch: branchOf(item.branchId) };
}

function richPayment(item: any) {
  return {
    ...item,
    patient: patientOf(item.patientId),
    treatment: treatments.find((treatment) => treatment.id === item.treatmentId) ?? null,
    branch: branchOf(item.branchId)
  };
}

function richInvoice(item: any) {
  return { ...item, patient: patientOf(item.patientId), payment: payments.find((payment) => payment.id === item.paymentId) ?? null, branch: branchOf(item.branchId) };
}

function richStockItem(item: any) {
  return { ...item, branch: branchOf(item.branchId), movements: stockMovements.filter((movement) => movement.itemId === item.id), offers: stockOffers.filter((offer) => offer.itemId === item.id) };
}

function richStaff(item: any) {
  return { ...item, branch: branchOf(item.branchId), doctorProfile: doctorProfiles.find((profile) => profile.staffId === item.id) ?? null };
}

function richDoctorProfile(item: any) {
  return { ...item, staff: richStaff(staff.find((person) => person.id === item.staffId) ?? staff[0]) };
}

function richConsent(item: any) {
  return { ...item, patient: patientOf(item.patientId), branch: branchOf(item.branchId) };
}

function richSurvey(item: any) {
  return { ...item, branch: branchOf(item.branchId), responses: allSurveyResponses.filter((response) => response.surveyId === item.id) };
}

function richSurveyResponse(item: any) {
  return { ...item, patient: patientOf(item.patientId), survey: surveys.find((survey) => survey.id === item.surveyId) ?? surveys[0], branch: branchOf(item.branchId) };
}

function richCommunicationLog(item: any) {
  return { ...item, patient: patientOf(item.patientId), branch: branchOf(item.branchId) };
}

function richRecall(item: any) {
  return { ...item, patient: patientOf(item.patientId), branch: branchOf(item.branchId) };
}

function richAuditLog(item: any) {
  return { ...item, user: userOf(item.userId), branch: branchOf(item.branchId) };
}

function leadOf(leadId: string | null | undefined) {
  return leads.find((lead) => lead.id === leadId) ?? null;
}

function packageOf(packageId: string | null | undefined) {
  return tourismPackages.find((pkg) => pkg.id === packageId) ?? null;
}

function hotelOf(hotelPartnerId: string | null | undefined) {
  return hotelPartners.find((partner) => partner.id === hotelPartnerId) ?? null;
}

function transferOf(transferPartnerId: string | null | undefined) {
  return transferPartners.find((partner) => partner.id === transferPartnerId) ?? null;
}

function richLead(item: any) {
  return {
    ...item,
    assignedToUser: userOf(item.assignedToUserId),
    messages: leadMessages.filter((message) => message.leadId === item.id),
    packages: tourismPackages.filter((pkg) => pkg.leadId === item.id).map(richTourismPackage),
    followUps: leadFollowUps.filter((followUp) => followUp.leadId === item.id),
    branch: branchOf(item.branchId)
  };
}

function richLeadMessage(item: any) {
  return { ...item, lead: leadOf(item.leadId), branch: branchOf(item.branchId), createdByUser: userOf(item.createdByUserId) };
}

function richTourismPackage(item: any) {
  return {
    ...item,
    lead: leadOf(item.leadId),
    patient: patientOf(item.patientId),
    items: treatmentPackageItems.filter((treatmentItem) => treatmentItem.packageId === item.id),
    reservationShares: reservationShares.filter((share) => share.packageId === item.id),
    createdByUser: userOf(item.createdByUserId),
    branch: branchOf(item.branchId)
  };
}

function richReservationShare(item: any) {
  return { ...item, package: packageOf(item.packageId), lead: leadOf(item.leadId), hotelPartner: hotelOf(item.hotelPartnerId), transferPartner: transferOf(item.transferPartnerId), branch: branchOf(item.branchId) };
}

function richLeadFollowUp(item: any) {
  return { ...item, lead: leadOf(item.leadId), sequence: followUpSequences.find((sequence) => sequence.id === item.sequenceId) ?? null, branch: branchOf(item.branchId) };
}

function richPostTreatmentFollowUp(item: any) {
  return { ...item, patient: patientOf(item.patientId), package: packageOf(item.packageId), branch: branchOf(item.branchId) };
}

function richReviewRequest(item: any) {
  return { ...item, patient: patientOf(item.patientId), package: packageOf(item.packageId), branch: branchOf(item.branchId) };
}

function richBeforeAfterCase(item: any) {
  return { ...item, patient: patientOf(item.patientId), branch: branchOf(item.branchId) };
}

function richDigitalConsent(item: any) {
  return { ...item, patient: patientOf(item.patientId), lead: leadOf(item.leadId), template: consentTemplates.find((template) => template.id === item.templateId) ?? null, branch: branchOf(item.branchId) };
}

function richChatConversation(item: any) {
  return { ...item, lead: leadOf(item.leadId), messages: chatMessages.filter((message) => message.conversationId === item.id), branch: branchOf(item.branchId) };
}

function richChatMessage(item: any) {
  return { ...item, conversation: chatConversations.find((conversation) => conversation.id === item.conversationId) ?? null };
}

function normalizeValue(value: any) {
  return value instanceof Date ? value.getTime() : value;
}

function matchesValue(itemValue: any, condition: any): boolean {
  if (condition === undefined) return true;
  if (condition === null) return itemValue === null || itemValue === undefined;
  if (typeof condition !== "object" || condition instanceof Date || Array.isArray(condition)) {
    return normalizeValue(itemValue) === normalizeValue(condition);
  }

  if ("equals" in condition && normalizeValue(itemValue) !== normalizeValue(condition.equals)) return false;
  if ("in" in condition && !condition.in.includes(itemValue)) return false;
  if ("notIn" in condition && condition.notIn.includes(itemValue)) return false;
  if ("not" in condition) {
    const rejected = condition.not === null ? itemValue === null || itemValue === undefined : matchesValue(itemValue, condition.not);
    if (rejected) return false;
  }
  if ("lte" in condition && normalizeValue(itemValue) > normalizeValue(condition.lte)) return false;
  if ("lt" in condition && normalizeValue(itemValue) >= normalizeValue(condition.lt)) return false;
  if ("gte" in condition && normalizeValue(itemValue) < normalizeValue(condition.gte)) return false;
  if ("gt" in condition && normalizeValue(itemValue) <= normalizeValue(condition.gt)) return false;
  if ("contains" in condition) {
    const haystack = String(itemValue ?? "").toLowerCase();
    const needle = String(condition.contains ?? "").toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  const operators = ["equals", "in", "notIn", "not", "lte", "lt", "gte", "gt", "contains", "mode"];
  if (Object.keys(condition).some((key) => !operators.includes(key))) {
    if (itemValue === null || itemValue === undefined) return false;
    return matchesWhere(itemValue, condition);
  }

  return true;
}

function matchesWhere(item: any, where: any): boolean {
  if (!where) return true;
  if (where.OR && !where.OR.some((entry: any) => matchesWhere(item, entry))) return false;
  if (where.AND && !where.AND.every((entry: any) => matchesWhere(item, entry))) return false;
  if (where.NOT && matchesWhere(item, where.NOT)) return false;

  return Object.entries(where).every(([key, condition]) => {
    if (["OR", "AND", "NOT"].includes(key)) return true;
    return matchesValue(item[key], condition);
  });
}

function sortRows(rows: any[], orderBy: any) {
  if (!orderBy) return rows;
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const entry of entries) {
      const [key, direction] = Object.entries(entry)[0] ?? [];
      if (!key) continue;
      const left = normalizeValue(a[key]);
      const right = normalizeValue(b[key]);
      if (left === right) continue;
      const multiplier = direction === "desc" ? -1 : 1;
      return left > right ? multiplier : -multiplier;
    }
    return 0;
  });
}

function model(data: any[], rich = (item: any) => item) {
  return {
    async findMany(args?: any) {
      const rows = sortRows(data.filter((item) => matchesWhere(rich(item), args?.where)), args?.orderBy);
      return rows.slice(args?.skip ?? 0, args?.take ? (args?.skip ?? 0) + args.take : undefined).map(rich);
    },
    async findFirst(args?: any) {
      const rows = sortRows(data.filter((item) => matchesWhere(rich(item), args?.where)), args?.orderBy);
      return rows.map(rich)[0] ?? null;
    },
    async findUnique(args?: any) {
      return data.filter((item) => matchesWhere(rich(item), args?.where)).map(rich)[0] ?? null;
    },
    async count(args?: any) {
      return data.filter((item) => matchesWhere(rich(item), args?.where)).length;
    },
    async create(args?: any) {
      const createdAt = new Date();
      const item = { id: id("demo", data.length + 1), ...args?.data, createdAt, updatedAt: createdAt };
      data.unshift(item);
      return rich(item);
    },
    async createMany(args?: any) {
      const items = Array.isArray(args?.data) ? args.data : [];
      const createdAt = new Date();
      items.forEach((entry: any, index: number) => data.unshift({ id: id("demo", data.length + index + 1), ...entry, createdAt, updatedAt: createdAt }));
      return { count: items.length };
    },
    async update(args?: any) {
      const item = data.find((entry) => matchesWhere(entry, args?.where));
      if (item) Object.assign(item, args?.data, { updatedAt: new Date() });
      return rich(item ?? data[0]);
    },
    async updateMany(args?: any) {
      let count = 0;
      const updatedAt = new Date();
      data.forEach((item) => {
        if (matchesWhere(item, args?.where)) {
          Object.assign(item, args?.data, { updatedAt });
          count += 1;
        }
      });
      return { count };
    },
    async deleteMany(args?: any) {
      let count = 0;
      for (let index = data.length - 1; index >= 0; index -= 1) {
        if (matchesWhere(data[index], args?.where)) {
          data.splice(index, 1);
          count += 1;
        }
      }
      return { count };
    },
    async aggregate(args?: any) {
      const filtered = data.filter((item) => matchesWhere(rich(item), args?.where));
      const sumFields = Object.keys(args?._sum ?? { amount: true });
      const avgFields = Object.keys(args?._avg ?? { score: true });
      const result: { _sum: Record<string, number>; _avg: Record<string, number | null> } = { _sum: {}, _avg: {} };
      sumFields.forEach((field) => {
        result._sum[field] = filtered.reduce((sum, item) => sum + Number(item[field] ?? 0), 0);
      });
      avgFields.forEach((field) => {
        result._avg[field] = filtered.length ? filtered.reduce((sum, item) => sum + Number(item[field] ?? 0), 0) / filtered.length : null;
      });
      return result;
    }
  };
}

const mockPrismaStore = {
  organization: model([organization]),
  branch: model(branches),
  user: model(users),
  passwordResetToken: model([]),
  patient: model(patients, richPatient),
  patientFile: model([]),
  appointment: model(appointments, richAppointment),
  treatmentPlan: model(treatmentPlans, richTreatmentPlan),
  treatment: model(treatments, richTreatment),
  payment: model(payments, richPayment),
  invoice: model(invoices, richInvoice),
  stockItem: model(stockItems, richStockItem),
  stockMovement: model(stockMovements),
  stockOffer: model(stockOffers),
  staff: model(staff, richStaff),
  doctorProfile: model(doctorProfiles, richDoctorProfile),
  consent: model(consents, richConsent),
  survey: model(surveys, richSurvey),
  surveyResponse: model(allSurveyResponses, richSurveyResponse),
  communicationLog: model(communicationLogs, richCommunicationLog),
  recall: model(recalls, richRecall),
  reportSnapshot: model(reportSnapshots),
  demoRequest: model([]),
  auditLog: model(auditLogs, richAuditLog),
  lead: model(leads, richLead),
  leadMessage: model(leadMessages, richLeadMessage),
  tourismPackage: model(tourismPackages, richTourismPackage),
  treatmentPackageItem: model(treatmentPackageItems),
  hotelPartner: model(hotelPartners),
  transferPartner: model(transferPartners),
  reservationShare: model(reservationShares, richReservationShare),
  followUpSequence: model(followUpSequences),
  leadFollowUp: model(leadFollowUps, richLeadFollowUp),
  postTreatmentFollowUp: model(postTreatmentFollowUps, richPostTreatmentFollowUp),
  reviewRequest: model(reviewRequests, richReviewRequest),
  beforeAfterCase: model(beforeAfterCases, richBeforeAfterCase),
  consentTemplate: model(consentTemplates),
  digitalConsent: model(digitalConsents, richDigitalConsent),
  surveyTemplate: model(surveyTemplates),
  chatbotKnowledgeBase: model(chatbotKnowledgeBase),
  chatConversation: model(chatConversations, richChatConversation),
  chatMessage: model(chatMessages, richChatMessage),
  notification: model(notifications),
  task: model(tasks),
  integrationLog: model(integrationLogs),
  async $transaction(input: any) {
    if (typeof input === "function") return input(mockPrisma);
    return Promise.all(input);
  },
  async $disconnect() {
    return undefined;
  }
};

// Next dev her sayfa derlemesinde modülü yeniden değerlendirdiği için
// bellek-içi veriler globalThis üzerinde saklanmazsa sıfırlanıyor
// (ör. portaldan gelen randevu talebi panele geçince kayboluyordu).
const globalMockStore = globalThis as unknown as { __clinicnovaMockPrisma?: typeof mockPrismaStore };

export const mockPrisma = globalMockStore.__clinicnovaMockPrisma ?? (globalMockStore.__clinicnovaMockPrisma = mockPrismaStore);
