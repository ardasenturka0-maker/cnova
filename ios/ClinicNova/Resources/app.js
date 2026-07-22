(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const mobileConfig = window.CLINICNOVA_MOBILE_CONFIG || { mode: "production", serverUrl: "" };
  const demoMode = mobileConfig.mode === "demo";
  const storage = {
    get(key, fallback) {
      try {
        let value;
        if (typeof window.ClinicNovaNative?.storage?.getItem === "function") value = window.ClinicNovaNative.storage.getItem(key);
        else if (typeof window.ClinicNovaNative?.storageGet === "function") value = window.ClinicNovaNative.storageGet(key);
        else value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch { return fallback; }
    },
    set(key, value) {
      try {
        const serialized = JSON.stringify(value);
        if (window.ClinicNovaNative?.storage?.setItem) return window.ClinicNovaNative.storage.setItem(key, serialized) !== false;
        if (window.ClinicNovaNative?.storageSet) return window.ClinicNovaNative.storageSet(key, serialized) !== false;
        localStorage.setItem(key, serialized);
        return true;
      } catch { return false; /* Platform storage can be unavailable when the OS keychain is locked. */ }
    }
  };

  const CLINIC_TIME_ZONE = "Europe/Istanbul";
  let today = new Date();
  let todayIso = localDate(today);
  let tomorrowIso = addCalendarDays(todayIso, 1);
  const palette = ["#dff4f1|#0f766e", "#fff0e9|#c65c34", "#e8f1fb|#276aa8", "#f0ecfb|#6e55a8", "#f9e9ed|#a64458"];
  const defaultPatients = [
    { id: 1, name: "Ayşe Yılmaz", phone: "+90 532 555 10 00", email: "ayse@mail.test", tag: "VIP", lastVisit: "Bugün", treatment: "İmplant", color: 0 },
    { id: 2, name: "Mehmet Demir", phone: "+90 532 555 10 01", email: "mehmet@mail.test", tag: "ACTIVE", lastVisit: "Dün", treatment: "Kanal tedavisi", color: 2 },
    { id: 3, name: "Elif Kaya", phone: "+90 532 555 10 02", email: "elif@mail.test", tag: "NEW", lastVisit: "3 gün önce", treatment: "Dolgu", color: 1 },
    { id: 4, name: "Can Şahin", phone: "+90 532 555 10 03", email: "can@mail.test", tag: "ACTIVE", lastVisit: "1 hafta önce", treatment: "Ortodonti", color: 3 },
    { id: 5, name: "Zeynep Çelik", phone: "+90 532 555 10 04", email: "zeynep@mail.test", tag: "ACTIVE", lastVisit: "2 hafta önce", treatment: "Kontrol", color: 4 },
    { id: 6, name: "Mert Aydın", phone: "+90 532 555 10 05", email: "mert@mail.test", tag: "NEW", lastVisit: "Yeni kayıt", treatment: "Muayene", color: 0 }
  ];
  const defaultAppointments = [
    { id: 1, patientId: 3, date: todayIso, time: "09:30", duration: 45, treatment: "Dolgu", doctor: "Dr. Emir Aydın", room: "Koltuk 1", status: "PLANNED" },
    { id: 2, patientId: 2, date: todayIso, time: "10:30", duration: 60, treatment: "İmplant", doctor: "Dr. Emir Aydın", room: "Koltuk 2", status: "ARRIVED" },
    { id: 3, patientId: 5, date: todayIso, time: "12:00", duration: 30, treatment: "Kontrol", doctor: "Dr. Lara Er", room: "Koltuk 1", status: "PLANNED" },
    { id: 4, patientId: 1, date: todayIso, time: "14:30", duration: 60, treatment: "İmplant kontrolü", doctor: "Dr. Emir Aydın", room: "Koltuk 3", status: "PENDING_CONFIRMATION" },
    { id: 5, patientId: 4, date: tomorrowIso, time: "11:00", duration: 45, treatment: "Ortodonti", doctor: "Dr. Lara Er", room: "Koltuk 2", status: "PLANNED" }
  ];
  const defaultTransactions = [
    { id: 1, patientId: 1, name: "Ayşe Yılmaz", detail: "İmplant · Kart", amount: 18500, totalAmount: 42000, remainingAmount: 23500, installmentCount: 4, paidInstallments: 1, components: [{ name: "İmplant", amount: 36000 }, { name: "Cerrahi işlem", amount: 6000 }], isDeposit: true, type: "income", status: "PAID", date: "Bugün, 11:24" },
    { id: 2, patientId: 2, name: "Mehmet Demir", detail: "Kanal tedavisi · Nakit", amount: 7200, type: "income", status: "PAID", date: "Bugün, 10:18" },
    { id: 3, patientId: null, name: "DentalLine Tedarik", detail: "Sarf malzeme", amount: 4600, type: "expense", status: "PAID", date: "Dün, 16:40" },
    { id: 4, patientId: 3, name: "Elif Kaya", detail: "Dolgu · Kart", amount: 3800, type: "income", status: "PAID", date: "Dün, 14:05" },
    { id: 5, patientId: 5, name: "Zeynep Çelik", detail: "Kontrol · Transfer", amount: 2400, type: "income", status: "PAID", date: "9 Temmuz, 12:30" },
    { id: 6, patientId: 4, name: "Can Şahin", detail: "Ortodonti · Vade 8 Temmuz", amount: 6500, type: "income", status: "PENDING", date: "3 gün gecikmiş" },
    { id: 7, patientId: 6, name: "Mert Aydın", detail: "Muayene · Vade 10 Temmuz", amount: 3200, type: "income", status: "PENDING", date: "1 gün gecikmiş" }
  ];
  const defaultTreatmentHistory = {
    1: [{ date: "12 Temmuz 2026", treatment: "İmplant cerrahisi", doctor: "Dr. Emir Aydın", note: "Alt çene implant uygulaması tamamlandı." }, { date: "28 Haziran 2026", treatment: "Dijital ölçü", doctor: "Dr. Lara Er", note: "Protez planlaması yapıldı." }],
    2: [{ date: "11 Temmuz 2026", treatment: "Kanal tedavisi · 2. seans", doctor: "Dr. Emir Aydın", note: "Geçici dolgu yenilendi." }],
    3: [{ date: "9 Temmuz 2026", treatment: "Kompozit dolgu", doctor: "Dr. Lara Er", note: "Kontrol randevusu önerildi." }]
  };
  const defaultTreatmentPlans = [
    { id: 1, patientId: 1, patient: "Ayşe Yılmaz", treatment: "İmplant", tooth: "36", doctor: "Dr. Emir Aydın", branch: "Nişantaşı Klinik", plannedAt: "15 Temmuz 2026", total: 42000, paid: 18500, status: "Devam ediyor", note: "İmplant cerrahisi sonrası protez üst yapı planlandı." },
    { id: 2, patientId: 2, patient: "Mehmet Demir", treatment: "Kanal tedavisi", tooth: "26", doctor: "Dr. Lara Er", branch: "Nişantaşı Klinik", plannedAt: "18 Temmuz 2026", total: 12000, paid: 7200, status: "2. seans", note: "İkinci seans ve kalıcı dolgu kontrolü." },
    { id: 3, patientId: 4, patient: "Can Şahin", treatment: "Ortodonti", tooth: "Tüm ağız", doctor: "Dr. Lara Er", branch: "Nişantaşı Klinik", plannedAt: "22 Temmuz 2026", total: 36000, paid: 29500, status: "Kontrol bekliyor", note: "Aylık plak ve kapanış kontrolü." }
  ];
  const defaultStockItems = [
    { id: 1, name: "Anestezi kartuşu", category: "Anestezi", amount: 8, minimum: 20, unit: "adet", supplier: "DentalLine", purchasePrice: 42, movements: [], offers: [{ id: 1, seller: "DentalLine", unitPrice: 39, shippingPrice: 30, productUrl: "https://example.com", inStock: true }] },
    { id: 2, name: "İmplant seti", category: "Cerrahi", amount: 14, minimum: 10, unit: "set", supplier: "ImplantPro", purchasePrice: 2450, movements: [], offers: [] },
    { id: 3, name: "Cerrahi eldiven", category: "Sarf", amount: 85, minimum: 50, unit: "kutu", supplier: "Medikal Depo", purchasePrice: 310, movements: [], offers: [] },
    { id: 4, name: "Kompozit dolgu", category: "Restoratif", amount: 11, minimum: 8, unit: "tüp", supplier: "DentalLine", purchasePrice: 780, movements: [], offers: [] }
  ];
  const defaultStockRecipes = [
    { id: 1, treatmentType: "Dolgu", itemId: 4, quantity: 1 },
    { id: 2, treatmentType: "Dolgu", itemId: 1, quantity: 1 },
    { id: 3, treatmentType: "İmplant", itemId: 2, quantity: 1 }
  ];
  const defaultClinicDoctors = [
    { id: 1, name: "Dr. Emir Aydın", email: "emir@clinicnova.test", specialty: "Genel diş hekimliği" },
    { id: 2, name: "Dr. Lara Er", email: "lara@clinicnova.test", specialty: "Ortodonti" }
  ];
  const defaultClinicChairs = ["Koltuk 1", "Koltuk 2", "Koltuk 3"];
  const defaultCommunicationLog = [
    { id: 1, patient: "Ayşe Yılmaz", channel: "WhatsApp", message: "Yarınki kontrol randevunuz 14:30'da.", status: "Teslim edildi" },
    { id: 2, patient: "Mehmet Demir", channel: "SMS", message: "Tedavi sonrası kontrolünüz için bizi arayabilirsiniz.", status: "Teslim edildi" },
    { id: 3, patient: "Zeynep Çelik", channel: "E-posta", message: "Kontrol randevunuz için uygun saati bildirebilirsiniz.", status: "Demo taslak" }
  ];
  const defaultConsentRecords = [
    { id: 1, patientId: 1, patient: "Ayşe Yılmaz", form: "İmplant aydınlatılmış onamı", treatment: "İmplant", language: "Türkçe", channel: "Tablet", status: "İmzalandı", date: "Bugün, 09:12", signedAt: "Bugün, 09:12", signer: "Ayşe Yılmaz", version: "v2", note: "Cerrahi işlem öncesi klinikte imzalandı." },
    { id: 2, patientId: 2, patient: "Mehmet Demir", form: "Kanal tedavisi onamı", treatment: "Kanal tedavisi", language: "Türkçe", channel: "SMS bağlantısı", status: "İmzalandı", date: "Dün, 15:40", signedAt: "Dün, 15:40", signer: "Mehmet Demir", version: "v1", note: "İkinci seans öncesi onaylandı." },
    { id: 4, patientId: 5, patient: "Zeynep Çelik", form: "Kişisel veri ve görüntü kullanım onamı", treatment: "Genel", language: "Türkçe", channel: "Klinikte", status: "Taslak", date: "Bugün", signedAt: "", signer: "", version: "v1", note: "Hasta kontrol randevusunda inceleyecek." }
  ];
  const modules = [
    { name: "Finans", detail: "Tahsilat, peşinat ve giderler", icon: "i-wallet", color: "#16845b" },
    { name: "Gerçekleşen tedaviler", detail: "Klinik işlem ve ücret kayıtları", icon: "i-tooth", color: "#276aa8" },
    { name: "Personel", detail: "Ekip, çalışma ve hakediş", icon: "i-users", color: "#16845b" },
    { name: "Raporlar", detail: "Gelir ve performans", icon: "i-chart", color: "#b76b12" },
    { name: "Dijital onam", detail: "Onam ve imza kayıtları", icon: "i-shield", color: "#16845b" },
    { name: "Çöp Kutusu", detail: "30 gün saklanan silinmiş kayıtlar", icon: "i-box", color: "#a64458" }
  ];

  const localDataWasMigrated = storage.get("clinicnova.localDataMigrated", false);
  function localCollection(key, demoDefaults) {
    const stored = storage.get(key, null);
    if (demoMode) return (Array.isArray(stored) ? stored : JSON.parse(JSON.stringify(demoDefaults))).filter((item) => item && typeof item === "object" && !Array.isArray(item));
    if (!Array.isArray(stored)) return [];
    const records = stored.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    if (localDataWasMigrated) return records;
    return records.filter((item) => Number(item.id) > 1_000_000_000_000);
  }

  function safeRecordKey(value) {
    const key = String(value ?? "");
    return key.length > 0 && key.length <= 160 && !["__proto__", "prototype", "constructor"].includes(key) ? key : null;
  }
  function safeGroupedRecords(value, allowedIds = null) {
    const result = Object.create(null);
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (const [rawKey, items] of Object.entries(value)) {
      const key = safeRecordKey(rawKey);
      if (key && Array.isArray(items) && (!allowedIds || allowedIds.has(key))) result[key] = items;
    }
    return result;
  }
  function safeArray(value) { return Array.isArray(value) ? value : []; }
  function safeObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

  let treatmentPlans = localCollection("clinicnova.treatmentPlans", defaultTreatmentPlans);
  let stockItems = localCollection("clinicnova.stockItems", defaultStockItems);
  let stockRecipes = localCollection("clinicnova.stockRecipes", defaultStockRecipes);
  let clinicDoctors = localCollection("clinicnova.clinicDoctors", defaultClinicDoctors);
  let clinicChairs = safeArray(storage.get("clinicnova.clinicChairs", demoMode ? defaultClinicChairs : []));
  let communicationLog = localCollection("clinicnova.communicationLog", defaultCommunicationLog);
  let consentRecords = localCollection("clinicnova.consentRecords", defaultConsentRecords);
  let treatments = localCollection("clinicnova.treatments", []);
  let staffRecords = localCollection("clinicnova.staff", []);
  let surveys = [];
  let surveyResponses = [];
  let recalls = [];
  const defaultReminderSettings = { id: "clinic", enabled: false, weekEnabled: true, dayEnabled: true, template: "Merhaba {{name}}, {{date}} {{time}} tarihindeki {{treatment}} randevunuzu hatırlatırız. {{clinic}}" };
  let reminderSettings = { ...defaultReminderSettings, ...safeObject(storage.get("clinicnova.reminderSettings", {})) };
  let reminderDeliveries = localCollection("clinicnova.reminderDeliveries", []);
  let trashItems = (demoMode || localDataWasMigrated ? safeArray(storage.get("clinicnova.trashItems", [])) : []).filter((item) => !["surveys", "recalls"].includes(item?.kind));
  let dailyTodoCompletions = safeObject(storage.get("clinicnova.dailyTodoCompletions", {}));
  const defaultManualTodos = [
    { id: 900000000001, day: todayIso, title: "Sterilizasyon cihazını çalıştır", detail: "Sabah ilk iş otoklavı başlat.", icon: "🧼", done: true, createdAt: `${todayIso}T07:30:00.000Z` },
    { id: 900000000002, day: todayIso, title: "Laboratuvara ölçü gönder", detail: "Ayşe Yılmaz implant ölçüsü kuryeyle gidecek.", icon: "🦷", done: false, createdAt: `${todayIso}T08:10:00.000Z` }
  ];
  const defaultCalendarNotes = [
    { id: 900000000101, date: todayIso, text: "Dr. Lara Er bugün Nişantaşı Kliniği'nde · 09:00-17:00", doctor: "Dr. Lara Er", createdAt: `${todayIso}T06:00:00.000Z` },
    { id: 900000000102, date: tomorrowIso, text: "Dr. Emir Aydın Ankara şubesinde · 10:00-15:00", doctor: "Dr. Emir Aydın", createdAt: `${todayIso}T06:05:00.000Z` }
  ];
  let manualTodos = localCollection("clinicnova.manualTodos", defaultManualTodos);
  let calendarNotes = localCollection("clinicnova.calendarNotes", defaultCalendarNotes);
  let legacyOfferId = Date.now();
  stockItems.forEach((item) => {
    item.offers = safeArray(item.offers);
    item.offers.forEach((offer) => {
    if (!Number.isFinite(Number(offer.id))) offer.id = legacyOfferId++;
    });
  });

  const state = {
    patients: localCollection("clinicnova.patients", defaultPatients),
    appointments: localCollection("clinicnova.appointments", defaultAppointments),
    transactions: localCollection("clinicnova.transactions", defaultTransactions),
    treatmentHistory: demoMode ? storage.get("clinicnova.treatmentHistory", defaultTreatmentHistory) : storage.get("clinicnova.treatmentHistory", {}),
    patientMedia: storage.get("clinicnova.patientMedia", {}),
    selectedDate: todayIso,
    patientFilter: "ALL",
    patientQuery: "",
    transactionFilter: "ALL",
    consentFilter: "ALL",
    appointmentMonth: calendarDate(`${todayIso.slice(0, 7)}-01`),
    organizerMonth: calendarDate(`${todayIso.slice(0, 7)}-01`),
    organizerDate: todayIso,
    activeView: "home"
  };
  function refreshClinicClock(now = new Date()) {
    const previousToday = todayIso;
    today = now;
    todayIso = localDate(now);
    tomorrowIso = addCalendarDays(todayIso, 1);
    const dayChanged = previousToday !== todayIso;
    if (dayChanged && state.selectedDate === previousToday) {
      state.selectedDate = todayIso;
      const selected = calendarDate(todayIso);
      if (selected) state.appointmentMonth = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1, 12));
    }
    const todayLabel = $("#todayLabel");
    if (todayLabel) todayLabel.textContent = new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(today);
    if (dayChanged && $("#appShell") && !$("#appShell").hidden) renderAll();
    return dayChanged;
  }
  if (!demoMode && !localDataWasMigrated) {
    const patientIds = new Set(state.patients.map((item) => String(item.id)));
    state.treatmentHistory = safeGroupedRecords(state.treatmentHistory, patientIds);
    state.patientMedia = safeGroupedRecords(state.patientMedia, patientIds);
  } else {
    state.treatmentHistory = safeGroupedRecords(state.treatmentHistory);
    state.patientMedia = safeGroupedRecords(state.patientMedia);
  }
  reconcileCompletedTreatmentHistory();
  storage.set("clinicnova.localDataMigrated", true);
  const storedDeviceId = String(storage.get("clinicnova.deviceId", "") || "");
  const deviceId = /^[A-Za-z0-9._:-]{8,128}$/.test(storedDeviceId) && safeRecordKey(storedDeviceId)
    ? storedDeviceId
    : (crypto.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  storage.set("clinicnova.deviceId", deviceId);
  let meshEngine = null;
  let meshConfig = null;
  let meshApplying = false;
  let meshStatus = "Yapılandırılmadı";
  let meshLastPeer = "";
  let syncQueue = safeArray(storage.get("clinicnova.syncQueue", [])).filter((item) => item && typeof item === "object" && !["LEAD", "SURVEY", "SURVEY_RESPONSE", "RECALL"].includes(item.entityType));
  storage.set("clinicnova.syncQueue", syncQueue);
  storage.set("clinicnova.hotLeads", null);
  let syncMap = { ...safeObject(storage.get("clinicnova.syncMap", {})) };
  let syncing = false;
  let inFlightOperationIds = new Set();
  let syncTimer = null;
  let syncRequestTimer = null;
  let persistenceWarningPending = false;
  let serverPermissions = storage.get("clinicnova.serverPermissions", null);
  if (demoMode) serverPermissions = null;
  function hasServerPermission(permission) { return !serverPermissions || serverPermissions[permission] !== false; }
  function canManageTrash() { return !serverPermissions || serverPermissions.trash === true; }
  let productSearchInFlight = false;
  let authenticatedThisRun = false;
  let previewMode = false;
  let previewClinicName = "İnceleme Kliniği";
  let entryMode = "register";
  const LOCAL_AUTH_ITERATIONS = 210000;

  function localDate(date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  }
  function calendarDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }
  function calendarDateKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  function addCalendarDays(value, days) {
    const date = calendarDate(value);
    if (!date) return localDate(new Date());
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return calendarDateKey(date);
  }
  function addCalendarMonthsClamped(value, months) {
    const date = calendarDate(value) || calendarDate(todayIso);
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Number(months || 0), 1, 12));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
    return calendarDateKey(target);
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function currency(value) {
    const number = Number(value);
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number.isFinite(number) ? number : 0);
  }
  function installmentCurrency(value) {
    const number = Number(value);
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0);
  }
  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
  function displayNumber(value, fallback = 0) {
    return escapeHtml(String(finiteNumber(value, fallback)));
  }
  function safeAppointmentStatus(status) {
    return ["PLANNED", "ARRIVED", "COMPLETED", "PENDING_CONFIRMATION", "CANCELLED", "NO_SHOW"].includes(status) ? status : "UNKNOWN";
  }
  const ACTIVE_APPOINTMENT_STATUSES = new Set(["PENDING_CONFIRMATION", "PLANNED", "ARRIVED", "COMPLETED"]);
  function appointmentStartMinutes(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ""));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }
  function normalizedResource(value) {
    return String(value || "").trim().toLocaleLowerCase("tr-TR");
  }
  function appointmentValidationError(appointment) {
    if (!patientById(appointment.patientId)) return "Geçerli bir hasta seçin.";
    if (!calendarDate(appointment.date) || appointmentStartMinutes(appointment.time) === null) return "Randevu tarihi veya saati geçersiz.";
    if (!Number.isInteger(appointment.duration) || appointment.duration < 15 || appointment.duration > 240) return "Randevu süresi 15-240 dakika olmalıdır.";
    if (String(appointment.treatment || "").trim().length < 2 || String(appointment.treatment || "").trim().length > 200) return "Tedavi adı 2-200 karakter olmalıdır.";
    if (!normalizedResource(appointment.doctor)) return "Geçerli bir hekim seçin.";
    if (!normalizedResource(appointment.room) || String(appointment.room).trim().length > 80) return "Geçerli bir koltuk seçin.";
    return "";
  }
  function appointmentConflict(appointment, excludeAppointmentId = null) {
    const start = appointmentStartMinutes(appointment.time);
    if (start === null) return null;
    const end = start + Number(appointment.duration);
    const doctor = normalizedResource(appointment.doctor);
    const room = normalizedResource(appointment.room);
    for (const existing of state.appointments) {
      if (excludeAppointmentId !== null && String(existing.id) === String(excludeAppointmentId)) continue;
      if (existing.date !== appointment.date || !ACTIVE_APPOINTMENT_STATUSES.has(existing.status)) continue;
      const existingStart = appointmentStartMinutes(existing.time);
      const existingDuration = Number(existing.duration);
      if (existingStart === null || !Number.isFinite(existingDuration) || existingDuration <= 0) continue;
      if (!(start < existingStart + existingDuration && end > existingStart)) continue;
      if (doctor && normalizedResource(existing.doctor) === doctor) return { resource: "doctor", appointment: existing };
      if (room && normalizedResource(existing.room) === room) return { resource: "room", appointment: existing };
    }
    return null;
  }
  function appointmentConflictMessage(conflict) {
    return conflict?.resource === "doctor"
      ? "Seçilen doktorun bu saat aralığında başka randevusu var."
      : "Seçilen oda veya koltuk bu saat aralığında dolu.";
  }
  function percentage(value, total) {
    const denominator = finiteNumber(total);
    return denominator > 0 ? Math.max(0, Math.min(100, Math.round(finiteNumber(value) / denominator * 100))) : 0;
  }
  function safeImageSource(value) {
    const source = String(value || "");
    return source.length <= 2_000_000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/i.test(source) ? source : "";
  }
  function safeHttpsURL(value) {
    const source = String(value || "").trim();
    if (!source || source.length > 8192) return "";
    try {
      const parsed = new URL(source);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : "";
    } catch { return ""; }
  }
  function formattedInstallmentDate(value) {
    const date = calendarDate(value);
    return !date ? "Tarih belirtilmedi" : new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE }).format(date);
  }
  function countLabels(items, field) {
    const counts = Object.create(null);
    for (const item of items) {
      const key = safeRecordKey(item?.[field]);
      if (key) counts[key] = finiteNumber(counts[key]) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }
  const FORM_TEXT_LIMITS = Object.freeze({
    loginForm: { serverUrl: 2048, localClinicName: 120, localAdminName: 120, loginEmail: 240, loginPassword: 4096 },
    patientForm: { name: 160, phone: 40, email: 240, nationalId: 40, address: 1000, allergies: 2000, chronicDiseases: 2000, medications: 2000, treatment: 160, note: 4000 },
    patientEditForm: { name: 160, phone: 40, email: 240, nationalId: 40, address: 1000, allergies: 2000, chronicDiseases: 2000, medications: 2000, treatment: 160, note: 4000 },
    appointmentForm: { treatment: 200 },
    paymentForm: { itemName1: 200, itemName2: 200, description: 1000 },
    expenseForm: { name: 200, description: 700 },
    consentForm: { treatment: 200, note: 10_000 },
    balancePaymentForm: { note: 1000 }, consentStatusForm: { actor: 160, note: 4000 },
    stockItemForm: { name: 200, category: 120, unit: 40, supplier: 200 },
    treatmentHistoryForm: { treatment: 200, note: 4000 }, communicationForm: { patient: 160, message: 10_000 },
    treatmentForm: { treatment: 200, tooth: 40, description: 4000 }, treatmentProgressForm: { note: 4000 },
    staffForm: { fullName: 160, roleLabel: 120, phone: 40, email: 240, workingHours: 160, compensation: 160 },
    treatmentPlanForm: { treatment: 200, tooth: 40, branch: 120, paymentPlanNote: 500, note: 4000 },
    stockMovementForm: { note: 500 }, stockRecipeForm: { treatmentType: 200 },
    meshJoinForm: { code: 4096 }, doctorForm: { name: 160, email: 240, specialty: 160 },
    chairForm: { name: 80 }, clinicNameForm: { name: 120 }, stockOfferForm: { productUrl: 8192 },
    connectionForm: { url: 2048 }, reminderSettingsForm: { template: 1000 }, recoveryForm: { code: 64, password: 4096 },
    manualTodoForm: { title: 200, detail: 200 }, calendarNoteForm: { text: 500, doctor: 160 }
  });
  function applyFormTextLimits(root) {
    for (const form of root.querySelectorAll?.("form[id]") || []) {
      const limits = FORM_TEXT_LIMITS[form.id] || {};
      for (const [name, maximum] of Object.entries(limits)) {
        const field = form.elements.namedItem(name) || form.querySelector(`#${name}`);
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.maxLength = maximum;
      }
    }
  }
  function formTextLimitError(form) {
    const limits = FORM_TEXT_LIMITS[form?.id] || {};
    for (const [name, maximum] of Object.entries(limits)) {
      const field = form.elements.namedItem(name) || form.querySelector(`#${name}`);
      if (field && typeof field.value === "string" && field.value.length > maximum) return `Metin alanı en fazla ${maximum} karakter olabilir.`;
    }
    return "";
  }
  function buildLocalPaymentPlan(total, downPayment, installmentCount, firstInstallmentDate, note) {
    const count = Math.max(1, Math.min(24, Number(installmentCount) || 1));
    const remaining = Math.max(0, Math.round((Number(total) - Number(downPayment)) * 100) / 100);
    const base = Math.floor((remaining / count) * 100) / 100;
    let allocated = 0;
    const start = calendarDate(firstInstallmentDate) ? firstInstallmentDate : todayIso;
    const installments = Array.from({ length: count }, (_, index) => {
      const amount = index === count - 1 ? Math.round((remaining - allocated) * 100) / 100 : base;
      allocated += amount;
      return { number: index + 1, dueDate: addCalendarMonthsClamped(start, index), amount };
    });
    return { total: Number(total), downPayment: Number(downPayment), installmentCount: count, firstInstallmentDate: start, installments, note: note || "" };
  }
  function initials(name) {
    return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toLocaleUpperCase("tr-TR")).join("");
  }
  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  function randomSecret(size = 16) {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    return bytesToBase64(bytes);
  }
  async function deriveLocalSecret(secret, salt, iterations = LOCAL_AUTH_ITERATIONS) {
    if (!crypto.subtle && typeof window.ClinicNovaNative?.hashSecret === "function") {
      const result = await window.ClinicNovaNative.hashSecret(secret, salt, iterations);
      if (result) return result;
    }
    if (!crypto.subtle) throw new Error("Bu cihaz güvenli yerel parola doğrulamayı desteklemiyor.");
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(atob(salt), (char) => char.charCodeAt(0)), iterations }, material, 256);
    return bytesToBase64(new Uint8Array(bits));
  }
  function secureEqual(left, right) {
    if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
  }
  function recoveryCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(15));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase().match(/.{1,5}/g).join("-");
  }
  function localAccount() {
    return storage.get("clinicnova.localAccount", null);
  }
  function persistLocalAccount(account) {
    return storage.set("clinicnova.localAccount", account);
  }
  function currentClinicName() {
    return previewMode ? previewClinicName : localAccount()?.clinicName || "ClinicNova";
  }
  function applyLocalIdentity(account = localAccount()) {
    if (previewMode) {
      $("#branchLabel").textContent = previewClinicName;
      $("#welcomeTitle").textContent = "Sürüm incelemeye hazır 👋";
      $("#profileAvatar").textContent = "İN";
      return;
    }
    if (!account) return;
    const adminName = account.adminName || account.name || "ClinicNova";
    $("#branchLabel").textContent = account.clinicName || "ClinicNova";
    $("#welcomeTitle").textContent = `Günaydın, ${adminName.split(/\s+/)[0]} 👋`;
    $("#profileAvatar").textContent = initials(adminName) || "CN";
  }
  function patientById(id) {
    return state.patients.find((patient) => patient.id === Number(id));
  }
  function statusLabel(status) {
    return ({ PLANNED: "Planlandı", ARRIVED: "Geldi", COMPLETED: "Tamamlandı", PENDING_CONFIRMATION: "Onay bekliyor", CANCELLED: "İptal edildi", NO_SHOW: "Gelmedi" })[status] || "Bilinmiyor";
  }
  let localIdCounter = Number(storage.get("clinicnova.localIdCounter", 0)) || 0;
  function nextLocalId() {
    let deviceHash = 2166136261;
    for (const char of deviceId) deviceHash = Math.imul(deviceHash ^ char.charCodeAt(0), 16777619) >>> 0;
    localIdCounter = (localIdCounter + 1) % 1_000_000 || 1;
    if (!storage.set("clinicnova.localIdCounter", localIdCounter)) warnPersistenceFailure();
    return (deviceHash % 4_000_000_000) * 1_000_000 + localIdCounter;
  }
  function meshDocument() {
    const stockBases = stockItems.map((item) => {
      const movements = Array.isArray(item.movements) ? item.movements : [];
      const delta = movements.reduce((sum, movement) => movement.type === "IN" ? sum + Number(movement.quantity || 0) : movement.type === "OUT" ? sum - Number(movement.quantity || 0) : sum, 0);
      const openingBalance = Number.isFinite(Number(item.openingBalance)) ? Number(item.openingBalance) : Math.max(0, Number(item.amount || 0) - delta);
      const { movements: _movements, offers: _offers, amount: _amount, ...base } = item;
      return { ...base, openingBalance };
    });
    return {
      patients: state.patients, appointments: state.appointments,
      transactions: state.transactions.map(({ paymentHistory: _paymentHistory, ...transaction }) => transaction),
      transactionPayments: state.transactions.flatMap((transaction) => safeArray(transaction.paymentHistory).map((entry, index) => ({ ...entry, id: entry.id ?? `${transaction.id}:${index}:${window.ClinicNovaMeshEngine.digest(entry)}`, transactionId: transaction.id }))),
      treatmentHistory: Object.entries(state.treatmentHistory).flatMap(([patientId, items]) => items.map((item) => ({ ...item, id: item.id, patientId }))),
      patientMedia: Object.entries(state.patientMedia).flatMap(([patientId, items]) => items.map((item) => ({ ...item, id: item.id, patientId }))),
      treatmentPlans, stockItems: stockBases,
      stockMovements: stockItems.flatMap((item) => safeArray(item.movements).map((movement) => ({ ...movement, id: movement.id, itemId: item.id }))),
      stockOffers: stockItems.flatMap((item) => safeArray(item.offers).map((offer) => ({ ...offer, id: offer.id, itemId: item.id }))),
      stockRecipes, clinicDoctors,
      clinicConfig: [{ id: "clinic", clinicName: currentClinicName() }],
      clinicChairs: clinicChairs.map((name) => ({ id: window.ClinicNovaMeshEngine.digest(String(name).toLocaleLowerCase("tr-TR")), name })),
      communicationLog,
      consentRecords: consentRecords.map(({ history: _history, ...consent }) => consent),
      consentHistory: consentRecords.flatMap((consent) => safeArray(consent.history).map((entry, index) => ({ ...entry, id: entry.id ?? `${consent.id}:${index}:${window.ClinicNovaMeshEngine.digest(entry)}`, consentId: consent.id }))),
      treatments, staffRecords,
      reminderSettings: [{ ...reminderSettings, id: "clinic" }], reminderDeliveries, trashItems,
      dailyTodoCompletions: Object.entries(dailyTodoCompletions).flatMap(([day, tasks]) => Object.entries(safeObject(tasks)).map(([taskId, completedAt]) => ({ id: `${day}:${taskId}`, day, taskId, completedAt }))),
      manualTodos, calendarNotes
    };
  }
  function applyMeshDocument(document) {
    meshApplying = true;
    try {
      state.patients = safeArray(document.patients); state.appointments = safeArray(document.appointments); state.transactions = safeArray(document.transactions);
      const transactionPayments = safeArray(document.transactionPayments);
      state.transactions.forEach((transaction) => { transaction.paymentHistory = transactionPayments.filter((entry) => String(entry.transactionId) === String(transaction.id)).map(({ transactionId: _transactionId, ...entry }) => entry); });
      state.treatmentHistory = Object.create(null);
      for (const item of safeArray(document.treatmentHistory)) { const patientId = safeRecordKey(item?.patientId); if (!patientId) continue; const { patientId: _patientId, ...record } = item; (state.treatmentHistory[patientId] ||= []).push(record); }
      state.patientMedia = Object.create(null);
      for (const item of safeArray(document.patientMedia)) { const patientId = safeRecordKey(item?.patientId); if (!patientId) continue; const { patientId: _patientId, ...record } = item; (state.patientMedia[patientId] ||= []).push(record); }
      treatmentPlans = safeArray(document.treatmentPlans);
      const stockMovements = safeArray(document.stockMovements); const stockOffers = safeArray(document.stockOffers);
      stockItems = safeArray(document.stockItems).map((base) => {
        const movements = stockMovements.filter((entry) => String(entry.itemId) === String(base.id)).sort((a, b) => Number(a.createdAt || a.id || 0) - Number(b.createdAt || b.id || 0));
        let amount = Number(base.openingBalance || 0);
        for (const movement of movements) amount = movement.type === "IN" ? amount + Number(movement.quantity || 0) : movement.type === "OUT" ? amount - Number(movement.quantity || 0) : Number(movement.quantity || 0);
        const offers = stockOffers.filter((entry) => String(entry.itemId) === String(base.id)).map(({ itemId: _itemId, ...offer }) => offer);
        return { ...base, amount: Math.max(0, amount), movements: movements.map(({ itemId: _itemId, ...movement }) => movement), offers };
      });
      stockRecipes = safeArray(document.stockRecipes);
      clinicDoctors = safeArray(document.clinicDoctors); communicationLog = safeArray(document.communicationLog); consentRecords = safeArray(document.consentRecords);
      const consentHistory = safeArray(document.consentHistory);
      consentRecords.forEach((consent) => { consent.history = consentHistory.filter((entry) => String(entry.consentId) === String(consent.id)).map(({ consentId: _consentId, ...entry }) => entry); });
      treatments = safeArray(document.treatments); staffRecords = safeArray(document.staffRecords); surveys = []; surveyResponses = [];
      reconcileCompletedTreatmentHistory();
      recalls = [];
      reminderSettings = { ...defaultReminderSettings, ...safeObject(safeArray(document.reminderSettings)[0] || reminderSettings) };
      reminderDeliveries = safeArray(document.reminderDeliveries);
      if (reminderDeliveries.some((item) => item.status === "READY")) {
        storage.set("clinicnova.notificationsRead", false);
        if ($("#notificationDot")) $("#notificationDot").hidden = false;
      }
      trashItems = safeArray(document.trashItems);
      if (Array.isArray(document.dailyTodoCompletions)) {
        dailyTodoCompletions = Object.create(null);
        for (const completion of document.dailyTodoCompletions) {
          const day = /^\d{4}-\d{2}-\d{2}$/.test(String(completion?.day || "")) ? String(completion.day) : "";
          const taskId = safeRecordKey(completion?.taskId);
          if (day && taskId) (dailyTodoCompletions[day] ||= Object.create(null))[taskId] = String(completion.completedAt || "");
        }
      }
      manualTodos = safeArray(document.manualTodos).filter((item) => item && typeof item === "object" && !Array.isArray(item));
      calendarNotes = safeArray(document.calendarNotes).filter((item) => item && typeof item === "object" && !Array.isArray(item));
      const clinic = safeArray(document.clinicConfig)[0];
      if (clinic) {
        clinicChairs = safeArray(document.clinicChairs).map((chair) => String(chair.name || "")).filter(Boolean);
        const account = localAccount() || {}; if (clinic.clinicName) account.clinicName = clinic.clinicName;
        storage.set("clinicnova.localAccount", account); applyLocalIdentity(account);
      }
      saveData();
    } finally { meshApplying = false; }
    if (!$("#appShell").hidden) renderAll();
    setTimeout(processAppointmentReminders, 0);
  }
  function warnPersistenceFailure() {
    if (persistenceWarningPending) return;
    persistenceWarningPending = true;
    setTimeout(() => {
      persistenceWarningPending = false;
      showToast("Cihaz depolamasına yazılamadı. Uygulamayı kapatmadan önce boş alanı ve cihaz kilidini kontrol edin.");
    }, 0);
  }
  window.ClinicNovaStorageFailure = warnPersistenceFailure;
  window.ClinicNovaMeshPersistenceFailure = () => {
    meshStatus = "Eşitleme ayarı cihazda saklanamadı";
    warnPersistenceFailure(); updateNetworkBadge();
  };
  function persistMesh() {
    if (!meshEngine || !meshConfig) return false;
    const envelope = meshEngine.export();
    const localStateSaved = storage.set("clinicnova.meshState", envelope);
    const conflictsSaved = storage.set("clinicnova.meshConflicts", meshEngine.materialize().conflicts);
    const nativeSaved = typeof window.ClinicNovaNative?.meshPublish !== "function" || window.ClinicNovaNative.meshPublish(JSON.stringify(envelope)) !== false;
    if (!localStateSaved || !conflictsSaved || !nativeSaved) warnPersistenceFailure();
    return localStateSaved && conflictsSaved && nativeSaved;
  }
  function captureMeshState() {
    if (!meshEngine || meshApplying || demoMode || previewMode) return;
    if (meshEngine.capture(meshDocument()) > 0) persistMesh();
  }
  function saveData() {
    if (previewMode) return;
    const writes = [
      ["clinicnova.patients", state.patients], ["clinicnova.appointments", state.appointments], ["clinicnova.transactions", state.transactions],
      ["clinicnova.treatmentHistory", state.treatmentHistory], ["clinicnova.patientMedia", state.patientMedia],
      ["clinicnova.treatmentPlans", treatmentPlans], ["clinicnova.stockItems", stockItems], ["clinicnova.stockRecipes", stockRecipes],
      ["clinicnova.clinicDoctors", clinicDoctors], ["clinicnova.clinicChairs", clinicChairs], ["clinicnova.communicationLog", communicationLog],
      ["clinicnova.consentRecords", consentRecords], ["clinicnova.treatments", treatments], ["clinicnova.staff", staffRecords],
      ["clinicnova.surveys", surveys], ["clinicnova.surveyResponses", surveyResponses], ["clinicnova.recalls", recalls],
      ["clinicnova.reminderSettings", reminderSettings], ["clinicnova.reminderDeliveries", reminderDeliveries], ["clinicnova.trashItems", trashItems],
      ["clinicnova.dailyTodoCompletions", dailyTodoCompletions],
      ["clinicnova.manualTodos", manualTodos], ["clinicnova.calendarNotes", calendarNotes]
    ];
    const saved = writes.map(([key, value]) => storage.set(key, value)).every(Boolean);
    if (!saved) warnPersistenceFailure();
    captureMeshState();
    return saved;
  }

  let reminderProcessing = false;
  function reminderText(appointment, patient) {
    return String(reminderSettings.template || "")
      .replaceAll("{{name}}", patient.name || "")
      .replaceAll("{{date}}", appointment.date || "")
      .replaceAll("{{time}}", appointment.time || "")
      .replaceAll("{{treatment}}", appointment.treatment || "")
      .replaceAll("{{clinic}}", currentClinicName());
  }
  function daysUntil(dateText) {
    const target = calendarDate(dateText);
    const current = calendarDate(localDate(new Date()));
    const difference = target && current ? (target.getTime() - current.getTime()) / 86_400_000 : Number.NaN;
    return Number.isFinite(difference) ? Math.round(difference) : Number.NaN;
  }
  function dueReminderOffset(appointment, offsets) {
    const remaining = daysUntil(appointment?.date);
    if (!Number.isInteger(remaining) || remaining < 1) return null;
    return [...offsets].sort((left, right) => left - right).find((offset) => remaining <= offset) ?? null;
  }
  function reminderDeliveryId(appointment, offset) {
    return `${appointment.id}:${appointment.date}:${offset}`;
  }
  function whatsappPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00")) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) return `90${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith("5")) return `90${digits}`;
    return digits;
  }
  function whatsappReminderUrl(item) {
    const phone = whatsappPhone(item?.phone);
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(item.message || "")}` : "";
  }
  function reminderTimingLabel(item) {
    const remaining = daysUntil(item?.appointmentDate);
    if (remaining === 0) return "Randevu bugün";
    if (remaining === 1) return "Randevuya 1 gün kaldı";
    if (remaining > 1 && remaining < 7) return `Randevuya ${remaining} gün kaldı`;
    return Number(item?.offset) === 7 ? "Randevuya 1 hafta kaldı" : "Randevuya 1 gün kaldı";
  }
  function reminderActionCards(status = "READY") {
    const items = reminderDeliveries.filter((item) => item.status === status);
    return items.map((item) => {
      const whatsappUrl = whatsappReminderUrl(item);
      return `<article class="offline-record reminder-message-card"><span class="record-icon">💬</span><span class="patient-copy"><strong>${escapeHtml(item.patient || "Hasta")}</strong><small>${escapeHtml(reminderTimingLabel(item))} · ${escapeHtml(item.phone || "Numara yok")}</small><p>${escapeHtml(item.message || "")}</p><span class="modal-actions"><button class="mini-action" data-copy-reminder="${escapeHtml(item.id)}">Metni kopyala</button>${whatsappUrl ? `<a class="mini-action" href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer" data-whatsapp-reminder="${escapeHtml(item.id)}">WhatsApp'ta aç</a>` : ""}<button class="mini-action" data-complete-reminder="${escapeHtml(item.id)}">Gönderildi</button></span></span></article>`;
    }).join("") || `<p class="empty-inline">Gönderilmeyi bekleyen mesaj yok.</p>`;
  }
  function copyReminderMessage(id) {
    const item = reminderDeliveries.find((entry) => String(entry.id) === String(id));
    if (!item) return;
    const fallback = () => {
      const input = document.createElement("textarea");
      input.value = item.message || ""; input.setAttribute("readonly", ""); input.style.position = "fixed"; input.style.opacity = "0";
      document.body.append(input); input.select(); document.execCommand("copy"); input.remove();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(item.message || "").catch(fallback);
    else fallback();
    showToast("Mesaj metni kopyalandı.");
  }
  async function processAppointmentReminders() {
    refreshClinicClock();
    if (reminderProcessing) return;
    reminderProcessing = true;
    try {
      const offsets = reminderSettings.enabled ? [reminderSettings.weekEnabled ? 7 : null, reminderSettings.dayEnabled ? 1 : null].filter(Number.isInteger) : [];
      const appointmentsById = new Map(state.appointments.map((appointment) => [String(appointment.id), appointment]));
      const deliveryCountBeforeCleanup = reminderDeliveries.length;
      reminderDeliveries = reminderDeliveries.filter((item) => {
        if (item.status !== "READY") return true;
        const appointment = appointmentsById.get(String(item.appointmentId));
        return Boolean(appointment && ["PLANNED", "PENDING_CONFIRMATION"].includes(appointment.status) && appointment.date === item.appointmentDate && dueReminderOffset(appointment, offsets) === Number(item.offset));
      });
      let created = 0;
      let refreshed = 0;
      for (const appointment of state.appointments) {
        if (!["PLANNED", "PENDING_CONFIRMATION"].includes(appointment.status)) continue;
        const offset = dueReminderOffset(appointment, offsets);
        if (!offset) continue;
        const deliveryId = reminderDeliveryId(appointment, offset);
        const patient = patientById(appointment.patientId);
        if (!patient?.phone) continue;
        const message = reminderText(appointment, patient);
        const existing = reminderDeliveries.find((item) => item.id === deliveryId);
        if (existing) {
          if (existing.status === "READY" && (existing.patientId !== patient.id || existing.patient !== patient.name || existing.phone !== patient.phone || existing.message !== message)) {
            Object.assign(existing, { patientId: patient.id, patient: patient.name, phone: patient.phone, message, updatedAt: new Date().toISOString() });
            refreshed += 1;
          }
          continue;
        }
        const createdAt = `${addCalendarDays(appointment.date, -offset)}T00:00:00.000Z`;
        reminderDeliveries.unshift({ id: deliveryId, appointmentId: appointment.id, offset, patientId: patient.id, patient: patient.name, phone: patient.phone, appointmentDate: appointment.date, message, status: "READY", createdAt, updatedAt: createdAt });
        created += 1;
      }
      if (created > 0 || refreshed > 0 || reminderDeliveries.length !== deliveryCountBeforeCleanup) saveData();
      if (created > 0) {
        storage.set("clinicnova.notificationsRead", false);
        if ($("#notificationDot")) $("#notificationDot").hidden = false;
        if (typeof window.ClinicNovaNative?.showLocalNotification === "function") {
          window.ClinicNovaNative.showLocalNotification("Randevu mesajı hazır", `${created} hasta için kopyalanabilir hatırlatma mesajı hazırlandı.`, `appointment-reminders-${localDate(new Date())}`);
        } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try { new Notification("Randevu mesajı hazır", { body: `${created} hasta için kopyalanabilir hatırlatma mesajı hazırlandı.` }); } catch { /* Uygulama içi bildirim her zaman kalır. */ }
        }
      }
    } finally { reminderProcessing = false; }
  }
  window.ClinicNovaProcessReminders = processAppointmentReminders;

  function meshPairingCode(config) {
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, clinicId: config.clinicId, secret: config.secret }));
    return `CN1.${bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
  }
  function parseMeshPairingCode(code) {
    const normalized = String(code || "").trim();
    if (!normalized.startsWith("CN1.")) throw new Error("Eşleştirme kodu geçersiz.");
    const encoded = normalized.slice(4).replaceAll("-", "+").replaceAll("_", "/");
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")), (char) => char.charCodeAt(0))));
    if (parsed.v !== 1 || !/^[A-Za-z0-9_-]{8,128}$/.test(parsed.clinicId) || typeof parsed.secret !== "string" || Uint8Array.from(atob(parsed.secret), (char) => char.charCodeAt(0)).length !== 32) throw new Error("Eşleştirme kodu geçersiz.");
    return { clinicId: parsed.clinicId, secret: parsed.secret };
  }
  function configureMesh(config) {
    if (!window.ClinicNovaMeshEngine?.MeshEngine) throw new Error("Yerel ağ eşitleme motoru yüklenemedi.");
    const previousConfig = meshConfig; const previousEngine = meshEngine;
    const nextConfig = { ...config, deviceId, deviceName: `${mobileConfig.platformLabel || "ClinicNova"}-${deviceId.slice(-6)}` };
    const nativeConfigBefore = typeof window.ClinicNovaNative?.meshGetConfig === "function" ? window.ClinicNovaNative.meshGetConfig() : "";
    const nativeEnvelopeBefore = typeof window.ClinicNovaNative?.meshGetEnvelope === "function" ? window.ClinicNovaNative.meshGetEnvelope() : "";
    const localConfigBefore = storage.get("clinicnova.meshConfig", null);
    const localEnvelopeBefore = storage.get("clinicnova.meshState", null);
    const localConflictsBefore = storage.get("clinicnova.meshConflicts", []);
    let configuredNative = false;
    try {
      if (typeof window.ClinicNovaNative?.requestMeshPermission === "function" && !window.ClinicNovaNative.requestMeshPermission()) {
        throw new Error("Yerel ağ eşitlemesi için Yakındaki cihazlar iznini verip yeniden deneyin.");
      }
      if (typeof window.ClinicNovaNative?.meshConfigure === "function") {
        if (!window.ClinicNovaNative.meshConfigure(JSON.stringify(nextConfig))) throw new Error("Klinik anahtarı güvenli cihaz kasasına yazılamadı.");
        configuredNative = true;
      }
      meshConfig = nextConfig;
      let stored = storage.get("clinicnova.meshState", null);
      if (typeof window.ClinicNovaNative?.meshGetEnvelope === "function") {
        try { stored = JSON.parse(window.ClinicNovaNative.meshGetEnvelope() || "null") || stored; } catch { /* Use the browser-local checkpoint. */ }
      }
      meshEngine = new window.ClinicNovaMeshEngine.MeshEngine({ clinicId: meshConfig.clinicId, deviceId, state: stored?.clinicId === meshConfig.clinicId ? stored : null });
      meshEngine.capture(meshDocument());
      if (!persistMesh()) throw new Error("Eşitleme durumu güvenli cihaz kasasına yazılamadı.");
      const configSaved = configuredNative ? storage.set("clinicnova.meshConfig", null) : storage.set("clinicnova.meshConfig", config);
      if (!configSaved) throw new Error("Eşitleme ayarı cihazda saklanamadı.");
      meshStatus = "Yerel ağda eşler aranıyor";
    } catch (error) {
      if (configuredNative) {
        if (nativeConfigBefore) {
          window.ClinicNovaNative?.meshConfigure?.(nativeConfigBefore);
          window.ClinicNovaNative?.meshPublish?.(nativeEnvelopeBefore);
        } else window.ClinicNovaNative?.meshDisable?.();
      }
      storage.set("clinicnova.meshConfig", localConfigBefore);
      storage.set("clinicnova.meshState", localEnvelopeBefore);
      storage.set("clinicnova.meshConflicts", localConflictsBefore);
      meshConfig = previousConfig; meshEngine = previousEngine;
      throw error;
    }
  }
  function initializeMesh() {
    if (demoMode) return;
    try {
      const nativeValue = typeof window.ClinicNovaNative?.meshGetConfig === "function" ? window.ClinicNovaNative.meshGetConfig() : null;
      const config = nativeValue ? JSON.parse(nativeValue) : storage.get("clinicnova.meshConfig", null);
      if (config?.clinicId && config?.secret) configureMesh(config);
    } catch { meshStatus = "Eşitleme yapılandırması açılamadı"; }
  }
  window.ClinicNovaMeshEnvelope = (envelopeText, peerName) => {
    try {
      if (!meshEngine) return;
      const result = meshEngine.merge(JSON.parse(envelopeText));
      applyMeshDocument(result.document); persistMesh();
      meshLastPeer = String(peerName || "Klinik cihazı"); meshStatus = result.conflicts.length ? `${meshLastPeer} ile eşitlendi · ${result.conflicts.length} çakışma kayıtlı` : `${meshLastPeer} ile eşitlendi`;
      showToast(meshStatus);
    } catch (error) { meshStatus = "Eşitleme paketi reddedildi"; showToast(error instanceof Error ? error.message : meshStatus); }
  };
  window.ClinicNovaMeshStatus = (status, peerName) => { meshStatus = String(status || meshStatus); if (peerName) meshLastPeer = String(peerName); updateNetworkBadge(); };
  window.ClinicNovaNative?.onMeshEnvelope?.(window.ClinicNovaMeshEnvelope);
  window.ClinicNovaNative?.onMeshStatus?.(window.ClinicNovaMeshStatus);
  if (!demoMode && !localDataWasMigrated) saveData();

  function operationId() {
    return crypto.randomUUID?.() ?? `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function persistSyncState() {
    if (previewMode) return updateNetworkBadge();
    const queueSaved = storage.set("clinicnova.syncQueue", syncQueue);
    const mapSaved = storage.set("clinicnova.syncMap", syncMap);
    if (!queueSaved || !mapSaved) warnPersistenceFailure();
    updateNetworkBadge();
  }

  function scheduleSync(delay = 750) {
    if (demoMode || previewMode || !navigator.onLine || !storage.get("clinicnova.serverUrl", "")) return;
    if (syncQueue.length && serverPermissions && !syncQueue.some((item) => canSyncEntity(item.entityType))) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncPending(true), delay);
  }

  function canSyncEntity(entityType) {
    if (!serverPermissions) return true;
    const permission = entityType === "PATIENT" ? "patients" : entityType === "APPOINTMENT" ? "appointments" : entityType === "PAYMENT" ? "finance" : ["TREATMENT_PLAN", "TREATMENT"].includes(entityType) ? "treatments" : entityType.startsWith("STOCK_") ? "stocks" : ["DOCTOR", "STAFF"].includes(entityType) ? "staff" : entityType === "CONSENT" ? "consents" : entityType === "COMMUNICATION" ? "communication" : "settings";
    return serverPermissions[permission] !== false;
  }

  function queueCreate(entityType, clientId, payload) {
    if (demoMode || previewMode) return;
    const id = String(clientId);
    const pendingDelete = syncQueue.some((item) => item.entityType === entityType && item.clientId === id && item.action === "DELETE");
    if (pendingDelete) syncQueue = syncQueue.filter((item) => !(item.entityType === entityType && item.clientId === id && item.action === "DELETE" && !inFlightOperationIds.has(item.operationId)));
    const pending = syncQueue.find((item) => item.entityType === entityType && item.clientId === id && item.action === "CREATE" && !item.attemptedAt && !inFlightOperationIds.has(item.operationId));
    if (pending) pending.payload = payload;
    else syncQueue.push({ operationId: operationId(), entityType, action: pendingDelete && syncMap[`${entityType}:${id}`] ? "UPDATE" : "CREATE", clientId: id, createdAt: new Date().toISOString(), payload });
    persistSyncState();
    scheduleSync();
  }

  function queueUpdate(entityType, clientId, payload) {
    if (demoMode || previewMode) return;
    const id = String(clientId);
    const pendingCreate = syncQueue.find((item) => item.entityType === entityType && item.clientId === id && item.action === "CREATE" && !item.attemptedAt && !inFlightOperationIds.has(item.operationId));
    const pendingUpdate = [...syncQueue].reverse().find((item) => item.entityType === entityType && item.clientId === id && item.action === "UPDATE" && !item.attemptedAt && !inFlightOperationIds.has(item.operationId));
    if (pendingCreate) pendingCreate.payload = { ...pendingCreate.payload, ...payload };
    else if (pendingUpdate) pendingUpdate.payload = { ...pendingUpdate.payload, ...payload };
    else syncQueue.push({ operationId: operationId(), entityType, action: "UPDATE", clientId: id, createdAt: new Date().toISOString(), payload });
    persistSyncState();
    scheduleSync();
  }

  function queueDelete(entityType, clientId, payload = {}) {
    if (demoMode || previewMode) return;
    const id = String(clientId);
    const hadQueuedCreate = syncQueue.some((item) => item.entityType === entityType && item.clientId === id && item.action === "CREATE" && !item.attemptedAt && !inFlightOperationIds.has(item.operationId));
    const hasAttemptedCreate = syncQueue.some((item) => item.entityType === entityType && item.clientId === id && item.action === "CREATE" && (item.attemptedAt || inFlightOperationIds.has(item.operationId)));
    syncQueue = syncQueue.filter((item) => item.entityType !== entityType || item.clientId !== id || item.attemptedAt || inFlightOperationIds.has(item.operationId));
    if (!hadQueuedCreate || hasAttemptedCreate || syncMap[`${entityType}:${id}`]) syncQueue.push({ operationId: operationId(), entityType, action: "DELETE", clientId: id, createdAt: new Date().toISOString(), payload });
    persistSyncState();
    scheduleSync();
  }

  function patientPayload(patient) {
    return { name: patient.name, phone: patient.phone, email: patient.email || "", nationalId: patient.nationalId || "", birthDate: patient.birthDate || undefined, gender: patient.gender || "UNSPECIFIED", address: patient.address || "", allergies: patient.allergies || "", chronicDiseases: patient.chronicDiseases || "", medications: patient.medications || "", tag: patient.tag || "NEW", treatment: patient.treatment || "", note: patient.note || "" };
  }

  function appointmentPayload(appointment) {
    return { patientId: String(appointment.patientId), date: appointment.date, time: appointment.time, duration: appointment.duration, treatment: appointment.treatment, doctor: appointment.doctor, room: appointment.room, status: appointment.status };
  }

  function paymentPayload(payment) {
    const method = String(payment.detail || "").split(" · ").pop() || "CARD";
    const description = payment.type === "expense" ? [payment.name, payment.detail].filter(Boolean).join(" · ") : payment.detail;
    return { patientId: payment.patientId ? String(payment.patientId) : undefined, type: payment.type === "expense" ? "EXPENSE" : "INCOME", status: payment.status || "PAID", amount: payment.amount, totalAmount: payment.totalAmount || payment.amount, remainingAmount: payment.type === "expense" ? 0 : outstandingAmount(payment), method, description, isDeposit: Boolean(payment.isDeposit), paidAt: payment.paidAt, dueDate: payment.dueDate, referralSource: payment.referralSource || "", discountAmount: payment.discountAmount || 0 };
  }

  function treatmentPayload(record) { return { patientId: String(record.patientId), doctor: record.doctor, toothNumber: record.tooth || "", treatmentType: record.treatment, description: record.description || "", fee: record.fee || 0, paymentPlan: record.paymentPlan || null, status: record.status || "COMPLETED", date: record.date || todayIso }; }
  function cleanupNativeCameraCaptures() {
    try { window.ClinicNovaNative?.cleanupCameraCaptures?.(); } catch { /* Only the Android packaged bridge owns temporary captures. */ }
  }
  function imageFileData(file) {
    if (!file || !(file instanceof File) || !file.size) return Promise.resolve("");
    if (!file.type.startsWith("image/")) return Promise.reject(new Error("Yalnızca fotoğraf seçilebilir."));
    if (file.size > 12 * 1024 * 1024) return Promise.reject(new Error("Kaynak fotoğraf en fazla 12 MB olabilir."));
    return new Promise((resolve, reject) => {
      const image = new Image(); const url = URL.createObjectURL(file);
      image.onload = () => {
        try {
          if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60_000_000) throw new Error("Fotoğraf çözünürlüğü güvenli sınırı aşıyor.");
          const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Bu cihaz fotoğrafı işleyemedi.");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          let result = canvas.toDataURL("image/jpeg", .82);
          if (result.length > 1_500_000) result = canvas.toDataURL("image/jpeg", .62);
          if (result.length > 2_000_000) throw new Error("Fotoğraf güvenli eşitleme boyutuna küçültülemedi.");
          resolve(result);
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Fotoğraf işlenemedi."));
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Fotoğraf okunamadı.")); };
      image.src = url;
    });
  }
  function staffPayload(record) { return { fullName: record.fullName, roleLabel: record.roleLabel, phone: record.phone || "", email: record.email || "", workingHours: record.workingHours || "", compensation: record.compensation || "", active: record.active !== false }; }
  const consentStatusCode = (status) => ({ Taslak: "DRAFT", "İmza bekliyor": "SENT", İmzalandı: "SIGNED", "İptal edildi": "CANCELLED" })[status] || status || "DRAFT";
  const consentStatusLabel = (status) => ({ DRAFT: "Taslak", SENT: "İmza bekliyor", SIGNED: "İmzalandı", CANCELLED: "İptal edildi" })[status] || status || "Taslak";
  function consentPayload(record) { return { patientId: String(record.patientId), templateName: record.templateName || record.form, content: record.content || [record.treatment, record.note].filter(Boolean).join(" — ") || record.form, status: consentStatusCode(record.status) }; }
  const communicationChannelCode = (channel) => ({ WhatsApp: "WHATSAPP", SMS: "SMS", "E-posta": "EMAIL", Telefon: "PHONE", "Klinik içi not": "IN_APP" })[channel] || channel || "IN_APP";
  const communicationStatusCode = (status) => ({ "Yerel taslak": "QUEUED", Arandı: "SENT", "Yanıt bekleniyor": "SENT", "Teslim edildi": "DELIVERED" })[status] || status || "QUEUED";
  function communicationPayload(record) { const patient = state.patients.find((item) => item.name === record.patient); return { patientId: record.patientId ? String(record.patientId) : patient ? String(patient.id) : undefined, channel: communicationChannelCode(record.channel), direction: record.direction || "OUTBOUND", subject: record.subject || "", source: record.source || "Android", contactName: record.patient || "", contactValue: record.contactValue || patient?.phone || "", message: record.message, status: communicationStatusCode(record.status) }; }

  function queueExistingLocalRecords() {
    if (demoMode || previewMode || storage.get("clinicnova.syncBootstrapComplete", false)) return;
    state.patients.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("PATIENT", item.id, patientPayload(item)));
    state.appointments.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("APPOINTMENT", item.id, appointmentPayload(item)));
    state.transactions.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("PAYMENT", item.id, paymentPayload(item)));
    stockItems.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("STOCK_ITEM", item.id, stockItemPayload(item)));
    stockRecipes.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("STOCK_RECIPE", item.id, stockRecipePayload(item)));
    treatmentPlans.filter((item) => item.patientId && Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("TREATMENT_PLAN", item.id, treatmentPlanPayload(item)));
    clinicDoctors.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("DOCTOR", item.id, doctorPayload(item)));
    treatments.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("TREATMENT", item.id, treatmentPayload(item)));
    staffRecords.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("STAFF", item.id, staffPayload(item)));
    consentRecords.filter((item) => item.patientId && Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("CONSENT", item.id, consentPayload(item)));
    communicationLog.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("COMMUNICATION", item.id, communicationPayload(item)));
    storage.set("clinicnova.syncBootstrapComplete", true);
  }

  function stockItemPayload(item) {
    return { name: item.name, category: item.category, currentQuantity: item.amount, minimumQuantity: item.minimum, unit: item.unit, supplier: item.supplier || "", purchasePrice: item.purchasePrice || 0 };
  }

  function stockRecipePayload(recipe) {
    return { treatmentType: recipe.treatmentType, itemId: String(recipe.itemId), quantity: recipe.quantity };
  }

  function treatmentKey(value) {
    return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
  }

  function applyLocalStockForClinicalRecord(record, nextStatus, label) {
    if (record.status === nextStatus) return { ok: true, message: `${label} durumu güncellendi.` };
    if (nextStatus === "COMPLETED") {
      const recipes = stockRecipes.filter((recipe) => treatmentKey(recipe.treatmentType) === treatmentKey(record.treatment));
      const insufficient = recipes.find((recipe) => {
        const item = stockItems.find((entry) => Number(entry.id) === Number(recipe.itemId));
        return !item || Number(item.amount) < Number(recipe.quantity);
      });
      if (insufficient) {
        const item = stockItems.find((entry) => Number(entry.id) === Number(insufficient.itemId));
        return { ok: false, message: item ? `Stok yetersiz: ${item.name}. Gerekli ${insufficient.quantity} ${item.unit}, mevcut ${item.amount} ${item.unit}.` : "Reçetedeki stok ürünü bulunamadı." };
      }
      record.stockUsage = recipes.map((recipe) => ({ itemId: Number(recipe.itemId), quantity: Number(recipe.quantity) }));
      for (const usage of record.stockUsage) {
        const item = stockItems.find((entry) => Number(entry.id) === usage.itemId);
        item.amount = Number(item.amount) - usage.quantity;
        (item.movements ||= []).unshift({ id: nextLocalId(), type: "OUT", quantity: usage.quantity, note: `${record.treatment} tamamlandı · otomatik sarf`, clinicalRecordId: record.id, automatic: true, date: "Şimdi", createdAt: Date.now() });
      }
      return { ok: true, message: recipes.length ? `${label} tamamlandı; reçetedeki malzemeler stoktan düşüldü.` : `${label} tamamlandı. Bu işlem için malzeme reçetesi tanımlı değil.` };
    }
    if (record.status === "COMPLETED" && Array.isArray(record.stockUsage)) {
      for (const usage of record.stockUsage) {
        const item = stockItems.find((entry) => Number(entry.id) === Number(usage.itemId));
        if (!item) continue;
        item.amount = Number(item.amount) + Number(usage.quantity);
        (item.movements ||= []).unshift({ id: nextLocalId(), type: "IN", quantity: Number(usage.quantity), note: `${record.treatment} geri alındı · otomatik iade`, clinicalRecordId: record.id, automatic: true, date: "Şimdi", createdAt: Date.now() });
      }
      record.stockUsage = [];
      return { ok: true, message: "Tamamlama geri alındı; kullanılan malzemeler stoğa iade edildi." };
    }
    return { ok: true, message: `${label} durumu güncellendi.` };
  }

  const applyLocalStockForAppointment = (appointment, nextStatus) => applyLocalStockForClinicalRecord(appointment, nextStatus, "Randevu");
  const applyLocalStockForTreatment = (treatment, nextStatus) => applyLocalStockForClinicalRecord(treatment, nextStatus, "Tedavi");

  function treatmentStatusLabel(status) {
    return ({ PROPOSED: "Önerildi", ACCEPTED: "Kabul edildi", STARTED: "Devam ediyor", COMPLETED: "Tamamlandı", CANCELLED: "İptal edildi" })[status] || String(status || "Belirsiz");
  }

  function completedTreatmentHistoryEntry(record) {
    const progress = safeArray(record.progressHistory);
    const latestNote = progress[0]?.note || record.description || "Tedavi tamamlandı.";
    return {
      id: record.id, treatmentId: record.id, date: formattedInstallmentDate(record.date || todayIso), treatment: record.treatment,
      doctor: record.doctor, note: latestNote, completedAt: record.completedAt || new Date().toISOString(), syncedTreatment: true, manual: Boolean(record.manual)
    };
  }

  function syncCompletedTreatmentHistory(record) {
    const patientId = safeRecordKey(record?.patientId);
    if (!patientId || !record?.id) return;
    const items = (state.treatmentHistory[patientId] ||= []);
    const matches = (item) => String(item.treatmentId ?? item.id ?? "") === String(record.id);
    if (record.status !== "COMPLETED") {
      state.treatmentHistory[patientId] = items.filter((item) => !matches(item));
      return;
    }
    const entry = completedTreatmentHistoryEntry(record);
    const existingIndex = items.findIndex(matches);
    if (existingIndex >= 0) items.splice(existingIndex, 1, { ...items[existingIndex], ...entry });
    else items.unshift(entry);
    state.treatmentHistory[patientId] = items.filter((item, index, all) => all.findIndex((candidate) => matches(candidate)) === index || !matches(item));
  }

  function reconcileCompletedTreatmentHistory() {
    for (const record of treatments) syncCompletedTreatmentHistory(record);
  }

  function openTreatmentDetail(id) {
    const record = treatments.find((item) => Number(item.id) === Number(id));
    if (!record) return;
    const progress = safeArray(record.progressHistory);
    const completed = record.status === "COMPLETED";
    openModal("TEDAVİ SÜRECİ", `${record.patient} · ${record.treatment}`, `<div class="modal-grid">
      <div class="finance-stats"><article class="finance-stat"><span>Durum</span><strong>${escapeHtml(treatmentStatusLabel(record.status))}</strong><small>${escapeHtml(record.date || "Tarih yok")}</small></article><article class="finance-stat"><span>İlerleme</span><strong>%${displayNumber(completed ? 100 : finiteNumber(record.progress))}</strong><small>${escapeHtml(record.doctor || "Hekim yok")}</small></article></div>
      <p class="modal-note"><strong>${escapeHtml(record.tooth || "Diş / bölge belirtilmedi")}</strong><br/>${escapeHtml(record.description || "Klinik açıklaması eklenmedi.")}</p>
      <section class="patient-section"><div class="patient-section-title"><strong>Tedavi gelişimi</strong><span>${progress.length}</span></div><div class="history-list">${progress.length ? progress.map((entry) => `<article><i>${displayNumber(entry.progress)}%</i><span><strong>${escapeHtml(entry.note)}</strong><small>${escapeHtml(entry.date || "Şimdi")} · ${escapeHtml(entry.doctor || record.doctor)}</small></span></article>`).join("") : `<p class="empty-inline">Henüz ilerleme notu eklenmedi.</p>`}</div></section>
      ${completed ? `<p class="treatment-finished-note">✓ Bu tedavi bitirildi; hasta profiline ve kişi raporuna otomatik eklendi.</p>` : `<div class="modal-actions"><button class="button button-secondary" data-treatment-progress="${escapeHtml(record.id)}">İlerleme ekle</button><button class="button button-primary" data-finish-treatment="${escapeHtml(record.id)}">Tedaviyi bitir</button></div>`}
    </div>`);
  }

  function openTreatmentProgress(id) {
    const record = treatments.find((item) => Number(item.id) === Number(id));
    if (!record || record.status === "COMPLETED") return showToast("Tamamlanan tedaviye yeni ilerleme eklenemez.");
    const current = Math.max(0, Math.min(90, Math.trunc(finiteNumber(record.progress))));
    openModal("TEDAVİ GELİŞİMİ", `${record.patient} · ${record.treatment}`, `<form id="treatmentProgressForm" class="modal-grid"><input type="hidden" name="treatmentId" value="${escapeHtml(record.id)}"/><label class="field">Tamamlanma oranı<select name="progress">${[10,25,50,75,90].map((value) => `<option value="${value}" ${value === current ? "selected" : ""}>%${value}</option>`).join("")}</select></label><label class="field">İlerleme notu<textarea name="note" required minlength="3" placeholder="Yapılan işlem, klinik bulgu ve sonraki adım"></textarea></label><div class="modal-actions"><button type="button" class="button button-secondary" data-treatment-detail="${escapeHtml(record.id)}">Vazgeç</button><button class="button button-primary">İlerlemeyi kaydet</button></div></form>`);
  }

  function prepareRestoredClinicalRecords(records, applyStock) {
    const restored = JSON.parse(JSON.stringify(records || []));
    const applied = [];
    for (const record of restored) {
      if (record.status !== "COMPLETED") continue;
      record.status = "STARTED";
      const result = applyStock(record, "COMPLETED");
      record.status = "COMPLETED";
      if (result.ok) { applied.push(record); continue; }
      for (const previous of applied.reverse()) applyStock(previous, "CANCELLED");
      return { ok: false, message: result.message, records: [] };
    }
    return { ok: true, records: restored };
  }

  function treatmentPlanPayload(plan) {
    return { patientId: String(plan.patientId), doctor: plan.doctor, toothNumber: plan.tooth || "", treatmentType: plan.treatment, description: plan.note || "", estimatedFee: plan.total || 0, paymentPlan: plan.paymentPlan || null, status: plan.statusCode || "PROPOSED", date: plan.date || todayIso };
  }

  function doctorPayload(doctor) {
    return { name: doctor.name, email: doctor.email, specialty: doctor.specialty || "Diş hekimi" };
  }

  function clinicConfigPayload() {
    return { clinicName: currentClinicName(), chairs: clinicChairs };
  }

  function moveToTrash(kind, label, payload) {
    const deletedAt = Date.now();
    const snapshot = payload == null ? null : JSON.parse(JSON.stringify(payload));
    trashItems.unshift({ id: nextLocalId(), kind, label, payload: snapshot, deletedAt, expiresAt: deletedAt + 30 * 24 * 60 * 60 * 1000 });
  }

  function purgeExpiredTrash() {
    const active = trashItems.map((item) => {
      const deletedAt = Number(item.deletedAt) || Date.now();
      const expiresAt = Number(item.expiresAt) || deletedAt + 30 * 24 * 60 * 60 * 1000;
      return { ...item, deletedAt, expiresAt };
    }).filter((item) => Number(item.expiresAt) > Date.now());
    if (active.length === trashItems.length) return;
    trashItems = active;
    storage.set("clinicnova.trashItems", trashItems);
  }

  function trashDaysLeft(item) {
    return Math.max(1, Math.ceil((Number(item.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  function trashKindLabel(kind) {
    return ({ stockItems: "Stok ürünü", stockOffer: "Satın alma fiyatı", patientBundle: "Hasta", appointment: "Randevu", transaction: "Finans", treatmentHistory: "Tedavi geçmişi", treatments: "Tedavi", treatmentPlans: "Tedavi planı", consentRecords: "Onam", media: "Fotoğraf", staffRecords: "Personel" })[kind] || "Kayıt";
  }

  function outstandingAmount(item) {
    return Number.isFinite(Number(item.remainingAmount)) ? Number(item.remainingAmount) : item.status === "PENDING" ? Number(item.amount) : 0;
  }

  function hasOpenBalance(item) {
    return item.type === "income" && outstandingAmount(item) > 0;
  }

  function swipeDeleteRecord(content, triggerAttributes, accessibleLabel, className = "") {
    return `<div class="swipe-delete ${className}" tabindex="0" role="group" aria-label="${escapeHtml(accessibleLabel)}. Sola kaydırın veya Delete tuşuna basın.">
      <span class="swipe-delete-action" aria-hidden="true"><span>🗑</span><small>Bırakınca kaldır</small></span>
      <div class="swipe-delete-content">${content}</div>
      <button type="button" class="swipe-delete-trigger" ${triggerAttributes} hidden aria-hidden="true" tabindex="-1">Kaydı kaldır</button>
    </div>`;
  }

  function transactionMonthKey(item) {
    for (const candidate of [item.paidAt, item.createdAt, item.date]) {
      const value = String(candidate || "").trim();
      if (/^\d{4}-\d{2}/.test(value)) return value.slice(0, 7);
      const parsed = new Date(value);
      if (/T/.test(value) && !Number.isNaN(parsed.getTime())) return localDate(parsed).slice(0, 7);
    }
    const relative = String(item.date || "").toLocaleLowerCase("tr-TR");
    if (/bugün|dün|şimdi/.test(relative)) return todayIso.slice(0, 7);
    const monthNames = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
    const monthIndex = monthNames.findIndex((month) => relative.includes(month));
    if (monthIndex >= 0) return `${todayIso.slice(0, 4)}-${String(monthIndex + 1).padStart(2, "0")}`;
    return todayIso.slice(0, 7); // Eski yerel kayıtlar ay bilgisi taşımıyorsa mevcut dönem içinde gösterilir.
  }

  function monthlyPaidTransactions() {
    const month = todayIso.slice(0, 7);
    return state.transactions.filter((item) => item.type === "income" && item.status === "PAID" && transactionMonthKey(item) === month);
  }

  function paymentProgressPercent(item) {
    const total = Math.max(0, finiteNumber(item.totalAmount, finiteNumber(item.amount)));
    const remaining = Math.max(0, outstandingAmount(item));
    return total > 0 ? Math.max(0, Math.min(100, Math.round((total - remaining) / total * 100))) : 100;
  }

  function paymentInstallmentRows(item) {
    const count = Math.max(1, Math.min(24, Math.trunc(finiteNumber(item.installmentCount, 1))));
    const paidCount = Math.max(0, Math.min(count, Math.trunc(finiteNumber(item.paidInstallments))));
    const explicit = safeArray(item.installments || item.paymentPlan?.installments).slice(0, count);
    const remaining = Math.max(0, outstandingAmount(item));
    const splitExact = (amount, portions) => {
      if (portions <= 0) return [];
      const totalCents = Math.max(0, Math.round(finiteNumber(amount) * 100));
      const baseCents = Math.floor(totalCents / portions);
      return Array.from({ length: portions }, (_, index) => (baseCents + (index === portions - 1 ? totalCents - baseCents * portions : 0)) / 100);
    };
    if (explicit.length !== count) {
      const total = Math.max(remaining, finiteNumber(item.totalAmount,
        Number.isFinite(Number(item.remainingAmount)) ? finiteNumber(item.amount) + remaining : Math.max(finiteNumber(item.amount), remaining)));
      let effectivePaidCount = remaining === 0 ? count : paidCount;
      if (remaining > 0 && effectivePaidCount >= count) effectivePaidCount = count - 1;
      const paidAmounts = splitExact(Math.max(0, total - remaining), effectivePaidCount);
      const unpaidAmounts = splitExact(remaining, count - effectivePaidCount);
      return Array.from({ length: count }, (_, index) => index < effectivePaidCount
        ? { number: index + 1, amount: paidAmounts[index], dueDate: "", state: "Ödendi" }
        : { number: index + 1, amount: unpaidAmounts[index - effectivePaidCount], dueDate: "", state: "Bekliyor" });
    }
    return Array.from({ length: count }, (_, index) => {
      const source = explicit[index];
      const paid = source.legacyPaid === true || (finiteNumber(source.amount) > 0 && finiteNumber(source.paidAmount) >= finiteNumber(source.amount)) || (!explicit.length && index < paidCount) || remaining === 0;
      const current = !paid && (finiteNumber(source.paidAmount) > 0 || (index === paidCount && finiteNumber(item.currentInstallmentPaid) > 0));
      return { number: index + 1, amount: finiteNumber(source.amount), dueDate: source.dueDate || "", state: paid ? "Ödendi" : current ? "Kısmi ödendi" : "Bekliyor" };
    });
  }

  function ensurePaymentInstallments(item) {
    const count = Math.max(1, Math.min(24, Math.trunc(finiteNumber(item.installmentCount, 1))));
    if (safeArray(item.installments).length === count) return item.installments;
    const paidCount = Math.max(0, Math.min(count, Math.trunc(finiteNumber(item.paidInstallments))));
    const remaining = Math.max(0, outstandingAmount(item));
    const unpaidCount = Math.max(1, count - paidCount);
    const base = Math.floor((remaining / unpaidCount) * 100) / 100;
    let allocated = 0;
    item.installments = Array.from({ length: count }, (_, index) => {
      if (index < paidCount) return { number: index + 1, amount: 0, paidAmount: 0, legacyPaid: true };
      const unpaidIndex = index - paidCount;
      const amount = unpaidIndex === unpaidCount - 1 ? Math.round((remaining - allocated) * 100) / 100 : base;
      allocated += amount;
      return { number: index + 1, amount, paidAmount: 0 };
    });
    return item.installments;
  }

  function allocateInstallmentPayment(item, amount) {
    let unallocated = Math.round(amount * 100) / 100;
    const schedule = ensurePaymentInstallments(item);
    for (const installment of schedule) {
      if (unallocated <= 0 || installment.legacyPaid) continue;
      const due = Math.max(0, finiteNumber(installment.amount) - finiteNumber(installment.paidAmount));
      const applied = Math.min(due, unallocated);
      installment.paidAmount = Math.round((finiteNumber(installment.paidAmount) + applied) * 100) / 100;
      unallocated = Math.round((unallocated - applied) * 100) / 100;
    }
    item.paidInstallments = schedule.filter((installment) => installment.legacyPaid || (finiteNumber(installment.amount) > 0 && finiteNumber(installment.paidAmount) >= finiteNumber(installment.amount))).length;
    const current = schedule.find((installment) => !installment.legacyPaid && finiteNumber(installment.paidAmount) < finiteNumber(installment.amount));
    item.currentInstallmentPaid = finiteNumber(current?.paidAmount);
  }

  function buildDailyTodos() {
    const appointmentItems = hasServerPermission("appointments") ? state.appointments.filter((item) => item.date === todayIso && !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status)) : [];
    const confirmations = appointmentItems.filter((item) => item.status === "PENDING_CONFIRMATION");
    const pendingPayments = hasServerPermission("finance") ? state.transactions.filter(hasOpenBalance) : [];
    const criticalStocks = hasServerPermission("stocks") ? stockItems.filter((item) => finiteNumber(item.amount) <= finiteNumber(item.minimum)) : [];
    const unsignedPatients = new Set(hasServerPermission("consents") ? appointmentItems.filter((appointment) => !consentRecords.some((consent) => Number(consent.patientId) === Number(appointment.patientId) && consent.status === "İmzalandı" && (() => { const consentTreatment = treatmentKey(consent.treatment); const appointmentTreatment = treatmentKey(appointment.treatment); return consentTreatment === "genel" || consentTreatment.includes(appointmentTreatment) || appointmentTreatment.includes(consentTreatment); })())).map((item) => Number(item.patientId)) : []);
    const activeTreatments = hasServerPermission("treatments") ? treatments.filter((item) => ["ACCEPTED", "STARTED"].includes(item.status)) : [];
    const fingerprint = (value) => {
      const source = JSON.stringify(value);
      let hash = 2166136261;
      for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619) >>> 0;
      return hash.toString(36);
    };
    const taskId = (name, values) => `${name}:${fingerprint(values)}`;
    const byId = (items, mapper) => items.map(mapper).sort((left, right) => String(left[0]).localeCompare(String(right[0])));
    const tasks = [];
    if (appointmentItems.length) tasks.push({ id: taskId("appointments", byId(appointmentItems, (item) => [item.id, item.status, item.time, item.patientId, item.treatment])), icon: "📅", title: `${appointmentItems.length} randevunun akışını kontrol et`, detail: `Bugün ${appointmentItems.filter((item) => item.status === "ARRIVED").length} hasta geldi, ${appointmentItems.filter((item) => item.status === "PLANNED").length} randevu planlı.`, go: "appointments" });
    if (confirmations.length) tasks.push({ id: taskId("confirmations", byId(confirmations, (item) => [item.id, item.status, item.time])), icon: "☎", title: `${confirmations.length} randevu onayını tamamla`, detail: "Onay bekleyen hastalarla görüşüp randevu durumunu güncelle.", go: "appointments" });
    if (pendingPayments.length) tasks.push({ id: taskId("payments", byId(pendingPayments, (item) => [item.id, Math.round(outstandingAmount(item) * 100), item.status])), icon: "₺", title: `${pendingPayments.length} bekleyen ödeme için aksiyon al`, detail: `Toplam ${currency(pendingPayments.reduce((sum, item) => sum + outstandingAmount(item), 0))} bakiye bekliyor.`, go: "finance" });
    if (criticalStocks.length) tasks.push({ id: taskId("critical-stock", byId(criticalStocks, (item) => [item.id, finiteNumber(item.amount), finiteNumber(item.minimum)])), icon: "!", title: `${criticalStocks.length} kritik stok ürününü tamamla`, detail: criticalStocks.slice(0, 3).map((item) => item.name).join(" · "), go: "stocks" });
    if (unsignedPatients.size) tasks.push({ id: taskId("consents", [...unsignedPatients].sort((left, right) => left - right)), icon: "✓", title: `${unsignedPatients.size} hastanın onamını kontrol et`, detail: "Bugünkü işlemlerle eşleşen imzalı onam bulunamadı.", go: "consents" });
    if (activeTreatments.length) tasks.push({ id: taskId("treatment-progress", byId(activeTreatments, (item) => [item.id, item.status, finiteNumber(item.progress), safeArray(item.progressHistory)[0]?.createdAt || ""])), icon: "🦷", title: `${activeTreatments.length} aktif tedavinin ilerlemesini gözden geçir`, detail: "İlerleyen tedavilere not ekle; tamamlananları bitir.", module: "Gerçekleşen tedaviler" });
    tasks.push({ id: taskId("daily-close", tasks.map((task) => task.id)), icon: "☑", title: "Gün sonu klinik kontrolünü tamamla", detail: "Randevu durumları, tahsilatlar ve stok hareketlerini son kez gözden geçir." });
    const completed = safeObject(dailyTodoCompletions[todayIso]);
    return tasks.filter((task) => !completed[task.id]);
  }

  const MANUAL_TODO_ICONS = ["📌", "📅", "☎", "₺", "🦷", "💊", "🧾", "🧼", "📦", "🔔", "✅", "⚙️"];
  function safeManualIcon(value) {
    return MANUAL_TODO_ICONS.includes(String(value)) ? String(value) : "📌";
  }
  function todaysManualTodos() {
    return manualTodos
      .filter((item) => item && item.day === todayIso)
      .sort((left, right) => String(left.createdAt || left.id || "").localeCompare(String(right.createdAt || right.id || "")));
  }
  function renderDailyTodos() {
    const tasks = buildDailyTodos();
    const manual = todaysManualTodos();
    const openManual = manual.filter((item) => !item.done).length;
    const remaining = tasks.length + openManual;
    $("#dailyTodoSummary").textContent = remaining ? `${remaining} görev kaldı` : "Bugün tamamlandı";
    const manualHtml = manual.map((todo) => `<article class="todo-card manual ${todo.done ? "done" : ""}">
      <span class="todo-icon">${escapeHtml(safeManualIcon(todo.icon))}</span>
      <span><strong>${escapeHtml(todo.title)}</strong><small>${escapeHtml(todo.detail ? todo.detail : "Elle eklenen görev")}</small></span>
      <div class="todo-manual-actions">
        <button type="button" class="todo-complete ${todo.done ? "checked" : ""}" data-toggle-manual-todo="${escapeHtml(todo.id)}" aria-pressed="${todo.done ? "true" : "false"}" aria-label="${escapeHtml(todo.title)}: ${todo.done ? "yapılmadı olarak işaretle" : "yapıldı olarak işaretle"}">${todo.done ? "✓ Yapıldı" : "Yapıldı"}</button>
        <button type="button" class="todo-remove" data-delete-manual-todo="${escapeHtml(todo.id)}" aria-label="${escapeHtml(todo.title)} maddesini kaldır">×</button>
      </div>
    </article>`).join("");
    const autoHtml = tasks.map((task) => `<article class="todo-card"><span class="todo-icon">${task.icon}</span><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.detail)}</small></span><button type="button" class="todo-complete" data-complete-todo="${escapeHtml(task.id)}" ${task.go ? `data-todo-go="${escapeHtml(task.go)}"` : ""} ${task.module ? `data-todo-module="${escapeHtml(task.module)}"` : ""} aria-label="${escapeHtml(task.title)}: yapıldı">Yapıldı</button></article>`).join("");
    $("#dailyTodoList").innerHTML = (manualHtml + autoHtml) || `<div class="todo-complete-state"><span>✓</span><strong>Bugünün klinik kontrolleri tamamlandı.</strong><small>Sağ üstteki + ile kendi maddeni ekleyebilirsin.</small></div>`;
  }

  function renderCalendarOrganizer() {
    if (!$("#organizerCalendar")) return;
    const month = state.organizerMonth || calendarDate(`${todayIso.slice(0, 7)}-01`);
    const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 12));
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    const gridStart = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate() - mondayOffset, 12));
    const dates = Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + index, 12)));
    $("#organizerMonthLabel").textContent = new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE, month: "long", year: "numeric" }).format(first);
    $("#organizerCalendar").innerHTML = dates.map((date) => {
      const iso = calendarDateKey(date);
      const outside = date.getUTCMonth() !== first.getUTCMonth();
      const noteCount = calendarNotes.filter((item) => item.date === iso).length;
      return `<button type="button" class="date-button ${iso === state.organizerDate ? "active" : ""} ${outside ? "outside" : ""} ${noteCount ? "has-note" : ""} ${iso === todayIso ? "is-today" : ""}" data-organizer-date="${iso}" aria-label="${new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(date)}${noteCount ? `, ${noteCount} not` : ""}"><strong>${date.getUTCDate()}</strong>${noteCount ? `<i class="note-dot"></i>` : ""}</button>`;
    }).join("");
    const selected = calendarDate(state.organizerDate) || calendarDate(todayIso);
    const dayNotes = calendarNotes
      .filter((item) => item.date === state.organizerDate)
      .sort((left, right) => String(left.createdAt || left.id || "").localeCompare(String(right.createdAt || right.id || "")));
    $("#organizerSelectedLabel").textContent = new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(selected);
    $("#organizerNoteCount").textContent = dayNotes.length ? `${dayNotes.length} not` : "Not yok";
    $("#organizerNoteList").innerHTML = dayNotes.length ? dayNotes.map((note) => `<article class="organizer-note"><span class="organizer-note-copy"><strong>${escapeHtml(note.text)}</strong>${note.doctor ? `<small>${escapeHtml(note.doctor)}</small>` : ""}</span><button type="button" class="todo-remove" data-delete-calendar-note="${escapeHtml(note.id)}" aria-label="Notu kaldır">×</button></article>`).join("") : `<p class="empty-inline">Bu güne henüz not eklenmedi. Sağ üstteki + ile ekleyin.</p>`;
  }

  function renderDashboard() {
    const allowed = (permission) => !serverPermissions || serverPermissions[permission] !== false;
    const todayAppointments = allowed("appointments") ? state.appointments.filter((item) => item.date === todayIso).sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))) : [];
    const paidThisMonth = monthlyPaidTransactions();
    const revenue = paidThisMonth.reduce((sum, item) => sum + finiteNumber(item.amount), 0);
    const pending = state.transactions.filter(hasOpenBalance);
    const visiblePending = allowed("finance") ? pending : [];
    $("#alertBanner").hidden = !allowed("finance");
    $("#opportunitySummary").textContent = `${visiblePending.length} geciken tahsilat bugün aksiyon bekliyor.`;
    $("#alertBanner").setAttribute("aria-label", `Geciken tahsilatlar: ${visiblePending.length} ödeme aksiyon bekliyor`);
    const metrics = [
      { id: "appointments", label: "Bugünkü randevu", value: todayAppointments.length, detail: `${todayAppointments.filter((item) => item.status === "ARRIVED").length} geldi · ${todayAppointments.filter((item) => item.status === "PLANNED").length} planlı`, icon: "i-calendar" },
      { id: "revenue", label: "Aylık tahsilat", value: currency(revenue), detail: `${paidThisMonth.length} ödenmiş işlem`, icon: "i-wallet", positive: true, bars: true },
      { id: "payments", label: "Bekleyen ödeme", value: currency(visiblePending.reduce((sum, item) => sum + outstandingAmount(item), 0)), detail: `${visiblePending.length} ödeme planı`, icon: "i-chart" }
    ].filter((metric) => !["Aylık tahsilat", "Bekleyen ödeme"].includes(metric.label) || allowed("finance")).filter((metric) => metric.label !== "Bugünkü randevu" || allowed("appointments"));
    $("#metricGrid").innerHTML = metrics.map((metric) => `
      <button type="button" class="metric-card" data-dashboard-summary="${metric.id}" aria-label="${escapeHtml(metric.label)} özetini göster">
        <div class="metric-top"><span>${escapeHtml(metric.label)}</span><span class="metric-icon"><svg><use href="#${metric.icon}"/></svg></span></div>
        <strong>${escapeHtml(metric.value)}</strong>
        <small class="${metric.positive ? "positive" : ""}">${metric.positive ? "↗" : "•"} ${escapeHtml(metric.detail)}</small>
        ${metric.bars ? `<span class="mini-bars">${[25,48,35,62,56,78,92].map((height) => `<i style="height:${height}%"></i>`).join("")}</span>` : ""}
      </button>`).join("");
    renderDailyTodos();
    renderCalendarOrganizer();
    $("#todayAppointments").innerHTML = todayAppointments.length ? todayAppointments.slice(0, 4).map((appointment) => {
      const patient = patientById(appointment.patientId);
      return `<button class="timeline-item" data-appointment="${escapeHtml(appointment.id)}" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;text-align:left;color:inherit">
        <span class="timeline-time"><strong>${escapeHtml(appointment.time)}</strong><small>${displayNumber(appointment.duration)} dk</small></span><span class="timeline-line"></span>
        <span class="timeline-copy"><strong>${escapeHtml(patient?.name || "Hasta")}</strong><small>${escapeHtml(appointment.treatment)} · ${escapeHtml(appointment.doctor)}</small></span>
        <span class="status-pill ${safeAppointmentStatus(appointment.status)}">${escapeHtml(statusLabel(appointment.status))}</span>
      </button>`;
    }).join("") : `<div class="empty-state">Bugün için randevu görünmüyor.</div>`;
    const quickPermissions = { "add-patient": "patients", "add-appointment": "appointments", "add-payment": "finance" };
    $$("#view-home [data-action]").forEach((button) => { if (quickPermissions[button.dataset.action]) button.hidden = !allowed(quickPermissions[button.dataset.action]); });
    $("#view-home [data-go='appointments']").hidden = !allowed("appointments");
  }

  function renderPatients() {
    const query = state.patientQuery.toLocaleLowerCase("tr-TR");
    const patients = state.patients.filter((patient) => {
      const matchesFilter = state.patientFilter === "ALL" || patient.tag === state.patientFilter;
      const haystack = `${patient.name} ${patient.phone} ${patient.email} ${patient.tag}`.toLocaleLowerCase("tr-TR");
      return matchesFilter && haystack.includes(query);
    });
    $("#patientCountLabel").textContent = `${state.patients.length} kayıtlı hasta`;
    $("#patientList").innerHTML = patients.length ? patients.map((patient) => {
      const colorIndex = Math.abs(Math.trunc(finiteNumber(patient.color))) % palette.length;
      const [background, foreground] = palette[colorIndex].split("|");
      const content = `<button class="patient-card" data-patient="${escapeHtml(patient.id)}" style="width:100%;text-align:left;color:inherit">
        <span class="patient-avatar" style="background:${background};color:${foreground}">${escapeHtml(initials(patient.name))}</span>
        <span class="patient-copy"><strong>${escapeHtml(patient.name)}</strong><small>${escapeHtml(patient.phone)} · ${escapeHtml(patient.lastVisit)}</small><span class="patient-tags"><i class="tag">${escapeHtml(patient.tag)}</i><i class="tag">${escapeHtml(patient.treatment)}</i></span></span>
        <svg><use href="#i-chevron"/></svg>
      </button>`;
      return swipeDeleteRecord(content, `data-delete-patient="${escapeHtml(patient.id)}"`, `${patient.name} hastasını kaldır`, "entry-row");
    }).join("") : `<div class="empty-state"><strong>Sonuç bulunamadı</strong><br/>Arama veya filtreyi değiştirin.</div>`;
  }

  function renderDateStrip() {
    const month = state.appointmentMonth;
    const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 12));
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    const gridStart = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate() - mondayOffset, 12));
    const dates = Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + index, 12)));
    $("#calendarMonthLabel").textContent = new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE, month: "long", year: "numeric" }).format(first);
    $("#dateStrip").innerHTML = dates.map((date) => {
      const iso = calendarDateKey(date);
      const outside = date.getUTCMonth() !== first.getUTCMonth();
      const hasAppointment = state.appointments.some((item) => item.date === iso);
      return `<button class="date-button ${iso === state.selectedDate ? "active" : ""} ${outside ? "outside" : ""} ${hasAppointment ? "has-appointment" : ""}" data-date="${iso}" aria-label="${new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(date)}"><strong>${date.getUTCDate()}</strong></button>`;
    }).join("");
  }

  function renderTreatmentPlans() {
    $("#treatmentPlanList").innerHTML = treatmentPlans.length ? treatmentPlans.map((plan) => swipeDeleteRecord(`<button class="offline-record clickable-record" data-treatment-plan="${escapeHtml(plan.id)}"><span class="record-icon">🦷</span><span class="patient-copy"><strong>${escapeHtml(plan.patient)}</strong><small>${escapeHtml(plan.treatment)} · ${escapeHtml(plan.doctor || "Hekim belirtilmedi")}</small><span class="record-progress"><i style="width:${finiteNumber(plan.total) > 0 ? Math.max(0, Math.min(100, Math.round(finiteNumber(plan.paid) / finiteNumber(plan.total) * 100))) : 0}%"></i></span></span><span class="record-value">${currency(plan.paid)}<small>${currency(plan.total)} plan</small></span></button>`, `data-delete-record="${escapeHtml(plan.id)}" data-record-kind="treatmentPlans"`, `${plan.patient} tedavi planını kaldır`)).join("") : `<div class="empty-state"><strong>Tedavi planı yok</strong><br/>Yeni plan ekleyerek başlayın.</div>`;
  }

  function renderStocks() {
    const criticalCount = stockItems.filter((item) => Number(item.amount) <= Number(item.minimum)).length;
    const totalValue = stockItems.reduce((sum, item) => sum + Number(item.amount || 0) * Number(item.purchasePrice || 0), 0);
    $("#stockSummary").innerHTML = `<article class="finance-stat"><span>Kritik ürün</span><strong>${criticalCount}</strong><small>${stockItems.length} ürün kayıtlı</small></article><article class="finance-stat"><span>Stok değeri</span><strong>${currency(totalValue)}</strong><small>Alış fiyatlarına göre</small></article>`;
    $("#stockList").innerHTML = stockItems.length ? stockItems.map((item) => {
      const critical = Number(item.amount) <= Number(item.minimum);
      const content = `<button class="offline-record clickable-record" data-stock-item="${escapeHtml(item.id)}"><span class="transaction-icon ${critical ? "expense" : ""}">${critical ? "!" : "✓"}</span><span class="patient-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || "Kategorisiz")} · Min. ${displayNumber(item.minimum)} ${escapeHtml(item.unit)}</small></span><span class="record-value ${critical ? "critical" : ""}">${displayNumber(item.amount)}<small>${escapeHtml(item.unit)}</small></span></button>`;
      return canManageTrash() ? swipeDeleteRecord(content, `data-delete-record="${escapeHtml(item.id)}" data-record-kind="stockItems"`, `${item.name} stok kaydını kaldır`) : content;
    }).join("") : `<div class="empty-state"><strong>Stok ürünü yok</strong><br/>Yeni ürün ekleyerek başlayın.</div>`;
    $("#stockRecipeList").innerHTML = stockRecipes.length ? stockRecipes.map((recipe) => {
      const item = stockItems.find((entry) => Number(entry.id) === Number(recipe.itemId));
      return swipeDeleteRecord(`<article class="offline-record"><span class="record-icon">⚙️</span><span class="patient-copy"><strong>${escapeHtml(recipe.treatmentType)}</strong><small>${escapeHtml(item?.name || "Silinmiş ürün")} · ${displayNumber(recipe.quantity)} ${escapeHtml(item?.unit || "adet")}</small></span></article>`, `data-delete-stock-recipe="${escapeHtml(recipe.id)}"`, `${recipe.treatmentType} reçetesini kaldır`);
    }).join("") : `<div class="empty-state"><strong>Tedavi reçetesi yok</strong><br/>Bir tedavi tamamlandığında düşecek malzemeleri tanımlayın.</div>`;
  }

  function renderAppointments() {
    renderDateStrip();
    const appointments = state.appointments.filter((item) => item.date === state.selectedDate).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
    $("#appointmentTotal").textContent = appointments.length;
    $("#appointmentList").innerHTML = appointments.length ? appointments.map((appointment) => {
      const patient = patientById(appointment.patientId);
      const content = `<button class="appointment-card" data-appointment="${escapeHtml(appointment.id)}" style="width:100%;text-align:left;color:inherit">
        <span class="appointment-clock"><strong>${escapeHtml(appointment.time)}</strong><small>${displayNumber(appointment.duration)} dk</small></span>
        <span class="appointment-main"><span class="row"><strong>${escapeHtml(patient?.name || "Hasta")}</strong><i class="status-pill ${safeAppointmentStatus(appointment.status)}">${escapeHtml(statusLabel(appointment.status))}</i></span><p>${escapeHtml(appointment.treatment)} · ${escapeHtml(appointment.room)}</p><footer><i class="doctor-chip">${escapeHtml(initials(String(appointment.doctor || "").replace("Dr. ", "")))}</i>${escapeHtml(appointment.doctor)}</footer></span>
      </button>`;
      return swipeDeleteRecord(content, `data-delete-appointment="${escapeHtml(appointment.id)}"`, `${patient?.name || "Hasta"} randevusunu kaldır`, "entry-row");
    }).join("") : `<div class="empty-state"><strong>Bu gün boş</strong><br/>Yeni bir randevu oluşturarak planlamaya başlayın.</div>`;
  }

  function renderFinance() {
    const collected = monthlyPaidTransactions().reduce((sum, item) => sum + finiteNumber(item.amount), 0);
    const billed = state.transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.totalAmount || item.amount || 0), 0);
    const expense = state.transactions.filter((item) => item.type === "expense" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pending = state.transactions.filter(hasOpenBalance);
    const visibleTransactions = state.transactions.filter((item) => {
      if (state.transactionFilter === "ALL") return true;
      if (state.transactionFilter === "EXPENSE") return item.type === "expense";
      if (state.transactionFilter === "PENDING") return hasOpenBalance(item);
      return item.status === state.transactionFilter;
    });
    $("#financePeriod").textContent = new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE, month: "long", year: "numeric" }).format(today);
    $("#monthlyRevenue").textContent = currency(collected);
    $("#financeStats").innerHTML = [
      ["Kesilen toplam", currency(billed), `${state.transactions.filter((item) => item.type === "income").length} gelir kaydı`],
      ["Bekleyen tahsilat", currency(pending.reduce((sum, item) => sum + outstandingAmount(item), 0)), `${pending.length} ödeme planı`],
      ["Toplam gider", currency(expense), `${state.transactions.filter((item) => item.type === "expense").length} gider kaydı`],
      ["Net nakit akışı", currency(collected - expense), "Tahsilat − gider"]
    ].map(([label, value, detail]) => `<article class="finance-stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
    $$("#financeFilterChips button").forEach((button) => button.classList.toggle("active", button.dataset.financeFilter === state.transactionFilter));
    $("#transactionFilterButton").textContent = ({ ALL: "Filtrele", PAID: "Ödenenler", PENDING: "Gecikenler", EXPENSE: "Giderler" })[state.transactionFilter];
    $("#pendingPaymentList").innerHTML = pending.length ? pending.map((item) => {
      const count = Math.max(1, Math.trunc(finiteNumber(item.installmentCount, 1)));
      const paidCount = Math.max(0, Math.min(count, Math.trunc(finiteNumber(item.paidInstallments))));
      const content = `<button class="offline-record clickable-record installment-card" data-finance-transaction="${escapeHtml(item.id)}"><span class="transaction-icon pending">!</span><span class="patient-copy"><strong>${escapeHtml(item.name)}</strong><small>${displayNumber(count)} taksitten ${displayNumber(paidCount)} ödendi · ${displayNumber(Math.max(0, count - paidCount))} taksit kaldı</small><span class="installment-totals"><b>${installmentCurrency(finiteNumber(item.totalAmount, finiteNumber(item.amount)))} plan</b><b>${installmentCurrency(Math.max(0, finiteNumber(item.totalAmount, finiteNumber(item.amount)) - outstandingAmount(item)))} ödendi</b></span><span class="record-progress" aria-label="Planın yüzde ${paymentProgressPercent(item)} kadarı ödendi"><i style="width:${paymentProgressPercent(item)}%"></i></span></span><span class="record-value critical">${installmentCurrency(outstandingAmount(item))}<small>kalan bakiye</small></span></button>`;
      return swipeDeleteRecord(content, `data-delete-transaction="${escapeHtml(item.id)}"`, `${item.name} ödeme planını kaldır`);
    }).join("") : `<div class="empty-state"><strong>Bekleyen bakiye yok</strong><br/>Tüm tahsilatlar tamamlanmış görünüyor.</div>`;
    $("#transactionList").innerHTML = visibleTransactions.length ? visibleTransactions.map((item) => swipeDeleteRecord(`<article class="transaction-card"><button class="transaction-main" data-finance-transaction="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)} finans ayrıntısı">
      <span class="transaction-icon ${item.type === "expense" ? "expense" : hasOpenBalance(item) ? "pending" : ""}">${item.type === "expense" ? "−" : hasOpenBalance(item) ? "!" : "+"}</span>
      <span class="transaction-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)} · ${escapeHtml(item.date)}${item.isDeposit ? " · Peşinat" : ""}</small>${Array.isArray(item.components) && item.components.length ? `<span class="transaction-lines">${item.components.map((line) => `${escapeHtml(line.name)} ${currency(line.amount)}`).join(" · ")}</span>` : ""}${outstandingAmount(item) > 0 ? `<span class="installment-note">${displayNumber(item.installmentCount, 1)} taksitten ${displayNumber(item.paidInstallments)} ödendi · ${currency(outstandingAmount(item))} kaldı</span>` : ""}</span>
      <span class="transaction-amount ${item.type === "expense" ? "expense" : outstandingAmount(item) > 0 ? "pending" : ""}">${item.type === "expense" ? "−" : "+"}${currency(item.amount)}<small>${item.type === "expense" ? "Gider" : outstandingAmount(item) > 0 ? "Kısmi ödendi" : "Ödendi"}</small></span>
      </button></article>`, `data-delete-transaction="${escapeHtml(item.id)}"`, `${item.name} finans kaydını kaldır`)).join("") : `<div class="empty-state"><strong>İşlem bulunamadı</strong><br/>Filtreyi değiştirerek diğer hareketleri görüntüleyin.</div>`;
  }

  function renderConsents() {
    const signed = consentRecords.filter((item) => item.status === "İmzalandı").length;
    const pending = consentRecords.filter((item) => item.status === "İmza bekliyor").length;
    const drafts = consentRecords.filter((item) => item.status === "Taslak").length;
    const visible = consentRecords.filter((item) => state.consentFilter === "ALL" || item.status === state.consentFilter);
    $("#consentStats").innerHTML = [
      ["İmzalı", signed, "Tamamlanan onam"], ["Bekleyen", pending, "Hasta aksiyonu"], ["Taslak", drafts, "Gönderilmeyi bekliyor"], ["Toplam", consentRecords.length, "Onam kaydı"]
    ].map(([label, value, detail]) => `<article class="finance-stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
    $$("#consentFilterChips button").forEach((button) => button.classList.toggle("active", button.dataset.consentFilter === state.consentFilter));
    $("#consentList").innerHTML = visible.length ? visible.map((item) => swipeDeleteRecord(`<article class="offline-record"><button class="consent-main" data-consent="${escapeHtml(item.id)}"><span class="transaction-icon ${item.status === "İmzalandı" ? "" : ["Taslak", "İptal edildi"].includes(item.status) ? "expense" : "pending"}">${item.status === "İmzalandı" ? "✓" : item.status === "Taslak" ? "…" : item.status === "İptal edildi" ? "×" : "!"}</span><span class="patient-copy"><strong>${escapeHtml(item.patient)}</strong><small>${escapeHtml(item.form)} · ${escapeHtml(item.language || "Türkçe")}</small><span class="installment-note">${escapeHtml(item.channel || "Klinikte")} · ${escapeHtml(item.date)}</span></span><span class="record-state">${escapeHtml(item.status)}</span></button></article>`, `data-delete-record="${escapeHtml(item.id)}" data-record-kind="consentRecords"`, `${item.patient} onam kaydını kaldır`)).join("") : `<div class="empty-state"><strong>Onam bulunamadı</strong><br/>Filtreyi değiştirin veya yeni bir onam oluşturun.</div>`;
  }

  function renderModules() {
    const modulePermission = { Finans: "finance", "Gerçekleşen tedaviler": "treatments", Personel: "staff", Raporlar: "reports", "Dijital onam": "consents", "Çöp Kutusu": "trash" };
    const visibleModules = modules.filter((module) => !serverPermissions || !modulePermission[module.name] || serverPermissions[modulePermission[module.name]] !== false);
    $("#moduleGrid").innerHTML = visibleModules.map((module) => `<button class="module-card" data-module="${escapeHtml(module.name)}" style="--module-color:${module.color}"><span class="module-icon"><svg><use href="#${module.icon}"/></svg></span><strong>${escapeHtml(module.name)}</strong><small>${escapeHtml(module.detail)}</small></button>`).join("");
    const navPermission = { patients: "patients", appointments: "appointments", "treatment-plans": "treatments", stocks: "stocks", finance: "finance", consents: "consents" };
    $$(".bottom-nav [data-go]").forEach((button) => { button.hidden = Boolean(serverPermissions && navPermission[button.dataset.go] && serverPermissions[navPermission[button.dataset.go]] === false); });
  }

  function renderAll() {
    renderDashboard();
    renderPatients();
    renderAppointments();
    renderFinance();
    renderConsents();
    renderTreatmentPlans();
    renderStocks();
    renderModules();
  }

  function navigate(view) {
    const required = { patients: "patients", appointments: "appointments", "treatment-plans": "treatments", stocks: "stocks", finance: "finance", consents: "consents" }[view];
    if (serverPermissions && required && serverPermissions[required] === false) return showToast("Bu modül için sunucu yetkiniz yok.");
    state.activeView = view;
    $$(".view").forEach((section) => section.classList.toggle("active", section.dataset.view === view));
    $$(".bottom-nav [data-go]").forEach((button) => {
      const active = button.dataset.go === view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "patients") renderPatients();
    if (view === "appointments") renderAppointments();
    if (view === "finance") renderFinance();
    if (view === "consents") renderConsents();
    if (view === "treatment-plans") renderTreatmentPlans();
    if (view === "stocks") renderStocks();
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  let modalOpener = null;
  function openModal(eyebrow, title, content) {
    if (!$("#modalBackdrop").hidden && $("#modalBody input[type='file']")) cleanupNativeCameraCaptures();
    modalOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    $("#modalEyebrow").textContent = eyebrow;
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = content;
    applyFormTextLimits($("#modalBody"));
    $("#modalBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      if ($("#modalBackdrop").hidden) return;
      if (document.activeElement !== modalOpener && document.activeElement !== document.body) return;
      ($("#modalBody input, #modalBody select, #modalBody button") || $("#modalClose"))?.focus();
    }, 80);
  }
  function closeModal() {
    if ($("#modalBackdrop").hidden) return;
    cleanupNativeCameraCaptures();
    $("#modalBackdrop").hidden = true;
    document.body.style.overflow = "";
    if (modalOpener?.isConnected) modalOpener.focus();
    modalOpener = null;
  }

  function openAddPatient() {
    openModal("YENİ KAYIT", "Hasta ekle", `<form id="patientForm" class="modal-grid">
      <div class="modal-grid two"><label class="field">Ad soyad<input name="name" autocomplete="name" required placeholder="Örn. Deniz Arslan" /></label><label class="field">Telefon<input name="phone" type="tel" required placeholder="+90 5xx xxx xx xx" /></label></div>
      <div class="modal-grid two"><label class="field">E-posta<input name="email" type="email" autocomplete="email" placeholder="hasta@mail.com" /></label><label class="field">TC / kimlik no<input name="nationalId" inputmode="numeric" /></label></div>
      <div class="modal-grid two"><label class="field">Doğum tarihi<input name="birthDate" type="date" /></label><label class="field">Cinsiyet<select name="gender"><option value="UNSPECIFIED">Belirtilmedi</option><option value="FEMALE">Kadın</option><option value="MALE">Erkek</option><option value="OTHER">Diğer</option></select></label></div>
      <label class="field">Adres<textarea name="address"></textarea></label>
      <div class="modal-grid two"><label class="field">Alerjiler<textarea name="allergies"></textarea></label><label class="field">Kronik hastalıklar<textarea name="chronicDiseases"></textarea></label></div>
      <label class="field">Kullandığı ilaçlar<textarea name="medications"></textarea></label>
      <div class="modal-grid two"><label class="field">Etiket<select name="tag"><option value="NEW">Yeni</option><option value="ACTIVE">Aktif</option><option value="VIP">VIP</option></select></label><label class="field">İlgilendiği tedavi<input name="treatment" placeholder="Muayene" /></label></div>
      <label class="field">Not<textarea name="note" placeholder="Alerji, iletişim tercihi veya ilk görüşme notu"></textarea></label>
      <p class="modal-note">Kayıt hemen bu cihazda saklanır; sunucu bağlandığında otomatik eşitleme kuyruğuna alınır.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Hastayı kaydet</button></div>
    </form>`);
  }

  function openEditPatient(id) {
    const patient = patientById(id); if (!patient) return;
    openModal("HASTA PROFİLİ", "Bilgileri düzenle", `<form id="patientEditForm" class="modal-grid"><input type="hidden" name="patientId" value="${escapeHtml(patient.id)}" />
      <div class="modal-grid two"><label class="field">Ad soyad<input name="name" value="${escapeHtml(patient.name)}" required /></label><label class="field">Telefon<input name="phone" type="tel" value="${escapeHtml(patient.phone)}" required /></label></div>
      <div class="modal-grid two"><label class="field">E-posta<input name="email" type="email" value="${escapeHtml(patient.email || "")}" /></label><label class="field">TC / kimlik no<input name="nationalId" value="${escapeHtml(patient.nationalId || "")}" /></label></div>
      <div class="modal-grid two"><label class="field">Doğum tarihi<input name="birthDate" type="date" value="${escapeHtml(patient.birthDate || "")}" /></label><label class="field">Cinsiyet<select name="gender">${[["UNSPECIFIED","Belirtilmedi"],["FEMALE","Kadın"],["MALE","Erkek"],["OTHER","Diğer"]].map(([value,label]) => `<option value="${value}" ${patient.gender === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
      <label class="field">Adres<textarea name="address">${escapeHtml(patient.address || "")}</textarea></label><div class="modal-grid two"><label class="field">Alerjiler<textarea name="allergies">${escapeHtml(patient.allergies || "")}</textarea></label><label class="field">Kronik hastalıklar<textarea name="chronicDiseases">${escapeHtml(patient.chronicDiseases || "")}</textarea></label></div><label class="field">Kullandığı ilaçlar<textarea name="medications">${escapeHtml(patient.medications || "")}</textarea></label>
      <div class="modal-grid two"><label class="field">Etiket<select name="tag">${["NEW","ACTIVE","PASSIVE","RISKY","VIP"].map((tag) => `<option ${patient.tag === tag ? "selected" : ""}>${tag}</option>`).join("")}</select></label><label class="field">İlgilendiği tedavi<input name="treatment" value="${escapeHtml(patient.treatment || "")}" /></label></div><label class="field">Not<textarea name="note">${escapeHtml(patient.note || "")}</textarea></label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-patient="${escapeHtml(patient.id)}">Vazgeç</button><button class="button button-primary">Değişiklikleri kaydet</button></div></form>`);
  }

  function openAddAppointment(preferredPatientId) {
    if (!clinicDoctors.length) return showToast("Önce Klinik yönetimi bölümünden doktor ekleyin.");
    if (!clinicChairs.length) return showToast("Önce Klinik yönetimi bölümünden koltuk ekleyin.");
    const selectedPatientId = Number(preferredPatientId);
    const patientOptions = state.patients.map((patient) => `<option value="${escapeHtml(patient.id)}" ${patient.id === selectedPatientId ? "selected" : ""}>${escapeHtml(patient.name)}</option>`).join("");
    openModal("PLANLAMA", "Randevu oluştur", `<form id="appointmentForm" class="modal-grid">
      <label class="field">Hasta<select name="patientId" required>${patientOptions}</select></label>
      <div class="modal-grid two"><label class="field">Tarih<input name="date" type="date" value="${state.selectedDate}" required /></label><label class="field">Saat<input name="time" type="time" value="10:00" required /></label></div>
      <div class="modal-grid two"><label class="field">Tedavi<input name="treatment" value="Muayene" required /></label><label class="field">Süre<select name="duration"><option value="30">30 dakika</option><option value="45">45 dakika</option><option value="60">60 dakika</option><option value="90">90 dakika</option></select></label></div>
      <div class="modal-grid two"><label class="field">Hekim<select name="doctor">${clinicDoctors.map((doctor) => `<option>${escapeHtml(doctor.name)}</option>`).join("")}</select></label><label class="field">Koltuk<select name="room">${clinicChairs.map((chair) => `<option>${escapeHtml(chair)}</option>`).join("")}</select></label></div>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Randevuyu kaydet</button></div>
    </form>`);
  }

  function openAddPayment(preferredPatientId) {
    const selectedPatientId = Number(preferredPatientId);
    const patientOptions = state.patients.map((patient) => `<option value="${escapeHtml(patient.id)}" ${patient.id === selectedPatientId ? "selected" : ""}>${escapeHtml(patient.name)}</option>`).join("");
    openModal("TAHSİLAT", "Ödeme al", `<form id="paymentForm" class="modal-grid">
      <label class="field">Hasta<select name="patientId" required>${patientOptions}</select></label>
      <div class="line-item-grid"><label class="field">İşlem 1<input name="itemName1" value="İmplant" required /></label><label class="field">Bedeli<input name="itemAmount1" type="number" inputmode="decimal" min="0" step="1" value="30000" required /></label><label class="field">İşlem 2<input name="itemName2" value="Protez üst yapı" /></label><label class="field">Bedeli<input name="itemAmount2" type="number" inputmode="decimal" min="0" step="1" value="12000" /></label></div>
      <div class="modal-grid two"><label class="field">Şimdi alınan<input name="amount" type="number" inputmode="decimal" min="1" step="1" value="18000" required /></label><label class="field">Ödeme yöntemi<select name="method"><option>Kart</option><option>Nakit</option><option>Transfer</option><option>Online</option></select></label></div>
      <div class="modal-grid two"><label class="field">Kalan bakiye kaç taksit?<select name="installmentCount"><option value="1">Tek ödeme</option><option value="2">2 taksit</option><option value="3">3 taksit</option><option value="4" selected>4 taksit</option><option value="6">6 taksit</option><option value="9">9 taksit</option><option value="12">12 taksit</option></select></label><label class="field">İlk taksit tarihi<input name="firstInstallmentDate" type="date" value="${todayIso}" /></label></div>
      <label class="field checkbox-field"><input name="isDeposit" type="checkbox" /> Şimdi alınan tutar peşinattır</label>
      <label class="field">Not<input name="description" value="Tedavi planı tahsilatı" required /></label>
      <p class="modal-note">Toplam bedelden şimdi alınan tutar düşülür; kalan bakiye seçtiğiniz sayıda ve tarihten başlayarak aylık taksitlere bölünür.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Ödemeyi kaydet</button></div>
    </form>`);
  }

  function openAddExpense() {
    openModal("FİNANS", "Gider ekle", `<form id="expenseForm" class="modal-grid">
      <div class="modal-grid two"><label class="field">Gider başlığı<input name="name" required placeholder="Örn. Dental depo" /></label><label class="field">Kategori<select name="category"><option>Sarf malzeme</option><option>Laboratuvar</option><option>Kira</option><option>Personel</option><option>Reklam</option><option>Vergi</option><option>Diğer</option></select></label></div>
      <div class="modal-grid two"><label class="field">Tutar<input name="amount" type="number" min="0.01" step="0.01" required /></label><label class="field">Ödeme yöntemi<select name="method"><option>Kart</option><option>Nakit</option><option>Transfer</option><option>Otomatik ödeme</option></select></label></div>
      <label class="field">Açıklama<input name="description" placeholder="Fatura veya gider açıklaması" /></label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Gideri kaydet</button></div>
    </form>`);
  }

  function openAddConsent() {
    if (!state.patients.length) return showToast("Önce bir hasta ekleyin.");
    const options = state.patients.map((patient) => `<option value="${escapeHtml(patient.id)}">${escapeHtml(patient.name)}</option>`).join("");
    openModal("DİJİTAL ONAM", "Yeni onam oluştur", `<form id="consentForm" class="modal-grid">
      <label class="field">Hasta<select name="patientId" required>${options}</select></label>
      <div class="modal-grid two"><label class="field">Onam türü<select name="form"><option>İmplant aydınlatılmış onamı</option><option>Kanal tedavisi onamı</option><option>Cerrahi işlem onamı</option><option>Ortodonti onamı</option><option>Kişisel veri ve görüntü kullanım onamı</option><option>Genel tedavi onamı</option></select></label><label class="field">Tedavi<input name="treatment" value="Genel tedavi" required /></label></div>
      <div class="modal-grid two"><label class="field">Dil<select name="language"><option>Türkçe</option><option>English</option><option>Deutsch</option><option>العربية</option></select></label><label class="field">İmza yöntemi<select name="channel"><option>Klinikte tablet</option><option>SMS bağlantısı</option><option>E-posta bağlantısı</option><option>Basılı belge</option></select></label></div>
      <label class="field">Durum<select name="status"><option>Taslak</option><option>İmza bekliyor</option><option>İmzalandı</option></select></label>
      <label class="field">Not<textarea name="note" placeholder="Hasta bilgilendirme, tercüman veya özel koşul notu"></textarea></label>
      <p class="modal-note">Çevrimdışı kayıtta taslak ve klinikte alınan imza durumu saklanır. Uzak imza bağlantısı ve yasal zaman damgası için yetkili ClinicNova sunucusu gerekir.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Onamı kaydet</button></div>
    </form>`);
  }

  function openFinanceDetail(id) {
    const item = state.transactions.find((entry) => Number(entry.id) === Number(id));
    if (!item) return;
    const remaining = outstandingAmount(item);
    const installmentRows = item.type === "income" ? paymentInstallmentRows(item) : [];
    openModal(item.type === "expense" ? "GİDER DETAYI" : "TAHSİLAT DETAYI", item.name, `<div class="modal-grid">
      <div class="finance-stats"><article class="finance-stat"><span>${item.type === "expense" ? "Gider" : "Tahsil edilen"}</span><strong>${item.type === "expense" ? currency(item.amount) : installmentCurrency(item.amount)}</strong><small>${escapeHtml(item.date)}</small></article><article class="finance-stat"><span>${item.type === "expense" ? "Kategori" : "Kalan bakiye"}</span><strong>${item.type === "expense" ? escapeHtml(item.category || "Diğer") : installmentCurrency(remaining)}</strong><small>${item.type === "expense" ? escapeHtml(item.method || "Belirtilmedi") : `${displayNumber(item.installmentCount, 1)} taksitten ${displayNumber(item.paidInstallments)} ödendi`}</small></article></div>
      <p class="modal-note"><strong>${escapeHtml(item.detail)}</strong>${item.isDeposit ? "<br/>Peşinat olarak işlendi." : ""}</p>
      ${Array.isArray(item.components) && item.components.length ? `<section class="patient-section"><div class="patient-section-title"><strong>İşlem kalemleri</strong><span>${item.components.length}</span></div><div class="history-list">${item.components.map((line) => `<article><i>₺</i><span><strong>${escapeHtml(line.name)}</strong><small>${currency(line.amount)}</small></span></article>`).join("")}</div></section>` : ""}
      ${installmentRows.length > 1 || remaining > 0 ? `<section class="patient-section"><div class="patient-section-title"><strong>Taksit çizelgesi</strong><span>${installmentRows.length}</span></div><div class="installment-schedule">${installmentRows.map((row) => `<article class="installment-row ${row.state === "Ödendi" ? "paid" : ""}" data-installment-amount-cents="${Math.round(finiteNumber(row.amount) * 100)}" data-installment-state="${escapeHtml(row.state)}"><i>${displayNumber(row.number)}</i><span><strong>${installmentCurrency(row.amount)}</strong><small>${row.dueDate ? escapeHtml(formattedInstallmentDate(row.dueDate)) : "Vade tarihi belirtilmedi"}</small></span><span>${row.state}</span></article>`).join("")}</div></section>` : ""}
      ${Array.isArray(item.paymentHistory) && item.paymentHistory.length ? `<section class="patient-section"><div class="patient-section-title"><strong>Tahsilat geçmişi</strong><span>${item.paymentHistory.length}</span></div><div class="history-list">${item.paymentHistory.map((entry) => `<article><i>₺</i><span><strong>${currency(entry.amount)} · ${escapeHtml(entry.method)}</strong><small>${escapeHtml(entry.date)}</small><p>${escapeHtml(entry.note)}</p></span></article>`).join("")}</div></section>` : ""}
      ${remaining > 0 ? `<div class="finance-progress" aria-label="Planın yüzde ${paymentProgressPercent(item)} kadarı ödendi"><span style="width:${paymentProgressPercent(item)}%"></span></div><button class="button button-primary" data-pay-balance="${escapeHtml(item.id)}">Bu plana tahsilat işle</button>` : ""}
    </div>`);
  }

  function openBalancePayment(id) {
    const item = state.transactions.find((entry) => Number(entry.id) === Number(id));
    const remaining = item ? outstandingAmount(item) : 0;
    if (!item || item.type === "expense" || remaining <= 0) return showToast("Açık ödeme planı bulunamadı.");
    const unpaidInstallments = Math.max(1, Number(item.installmentCount || 1) - Number(item.paidInstallments || 0));
    const nextInstallment = ensurePaymentInstallments(item).find((installment) => !installment.legacyPaid && finiteNumber(installment.paidAmount) < finiteNumber(installment.amount));
    const suggested = Math.min(remaining, Math.max(0.01, Math.round((finiteNumber(nextInstallment?.amount, remaining / unpaidInstallments) - finiteNumber(nextInstallment?.paidAmount)) * 100) / 100));
    openModal("TAKSİT TAHSİLATI", item.name, `<form id="balancePaymentForm" class="modal-grid"><input type="hidden" name="transactionId" value="${escapeHtml(item.id)}" />
      <div class="finance-stats"><article class="finance-stat"><span>Kalan bakiye</span><strong>${installmentCurrency(remaining)}</strong><small>${displayNumber(item.installmentCount, 1)} taksitten ${displayNumber(item.paidInstallments)} ödendi</small></article><article class="finance-stat"><span>Sıradaki taksit</span><strong>${installmentCurrency(suggested)}</strong><small>${displayNumber(unpaidInstallments)} taksit kaldı${nextInstallment?.dueDate ? ` · ${escapeHtml(formattedInstallmentDate(nextInstallment.dueDate))}` : ""}</small></article></div>
      <div class="modal-grid two"><label class="field">Alınan tutar<input name="amount" type="number" inputmode="decimal" min="0.01" max="${displayNumber(remaining)}" step="0.01" value="${displayNumber(suggested)}" required /></label><label class="field">Ödeme yöntemi<select name="method"><option>Kart</option><option>Nakit</option><option>Transfer</option><option>Online</option></select></label></div>
      <label class="field">Açıklama<input name="note" value="Taksit tahsilatı" required /></label>
      <p class="modal-note">Bu ödeme mevcut plana işlenir; yeni ve bağımsız bir borç kaydı oluşturmaz.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-finance-transaction="${escapeHtml(item.id)}">Vazgeç</button><button type="submit" class="button button-primary">Tahsilatı kaydet</button></div>
    </form>`);
  }

  function openConsentDetail(id) {
    const item = consentRecords.find((entry) => Number(entry.id) === Number(id));
    if (!item) return;
    const history = Array.isArray(item.history) && item.history.length ? item.history : [{ status: item.status, date: item.date, note: "Onam kaydı oluşturuldu." }];
    openModal("ONAM DETAYI", item.patient, `<div class="modal-grid">
      <div class="finance-stats"><article class="finance-stat"><span>Durum</span><strong>${escapeHtml(item.status)}</strong><small>${escapeHtml(item.date)}</small></article><article class="finance-stat"><span>Belge sürümü</span><strong>${escapeHtml(item.version || "v1")}</strong><small>${escapeHtml(item.language || "Türkçe")}</small></article></div>
      <p class="modal-note"><strong>${escapeHtml(item.form)}</strong><br/>Tedavi: ${escapeHtml(item.treatment || "Genel")}<br/>İmza yöntemi: ${escapeHtml(item.channel || "Klinikte")}</p>
      <p class="modal-note"><strong>İmza bilgisi</strong><br/>${item.status === "İmzalandı" ? `${escapeHtml(item.signer || item.patient)} · ${escapeHtml(item.signedAt || item.date)}` : "Hasta imzası henüz tamamlanmadı."}</p>
      <p class="modal-note"><strong>Klinik notu</strong><br/>${escapeHtml(item.note || "Not eklenmemiş.")}</p>
      <section class="patient-section"><div class="patient-section-title"><strong>Durum geçmişi</strong><span>${history.length}</span></div><div class="history-list">${history.map((entry) => `<article><i>${entry.status === "İmzalandı" ? "✓" : entry.status === "İptal edildi" ? "×" : "•"}</i><span><strong>${escapeHtml(entry.status)}</strong><small>${escapeHtml(entry.date || "Şimdi")}</small>${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}</span></article>`).join("")}</div></section>
      ${item.status !== "İptal edildi" ? `<button class="button button-primary" data-edit-consent-status="${escapeHtml(item.id)}">Durumu değiştir</button>` : `<p class="modal-note">İptal edilen onam yeniden etkinleştirilmez. Yeni belge sürümü oluşturun.</p>`}
    </div>`);
  }

  function openConsentStatusEditor(id) {
    const item = consentRecords.find((entry) => Number(entry.id) === Number(id));
    if (!item) return;
    const options = item.status === "İmzalandı" ? ["İmzalandı", "İptal edildi"] : ["Taslak", "İmza bekliyor", "İmzalandı", "İptal edildi"];
    openModal("ONAM DURUMU", item.patient, `<form id="consentStatusForm" class="modal-grid"><input type="hidden" name="consentId" value="${escapeHtml(item.id)}" />
      <p class="modal-note"><strong>${escapeHtml(item.form)}</strong><br/>Mevcut durum: ${escapeHtml(item.status)}. İmzalı belge yalnızca iptal edilebilir; eski imza kaydı korunur.</p>
      <label class="field">Yeni durum<select name="status">${options.map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
      <label class="field">İmzalayan / işlem yapan<input name="actor" value="${escapeHtml(item.signer || item.patient)}" required /></label>
      <label class="field">Açıklama<textarea name="note" required placeholder="Durum değişikliği nedeni veya imza notu"></textarea></label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-consent="${escapeHtml(item.id)}">Vazgeç</button><button type="submit" class="button button-primary">Durumu kaydet</button></div>
    </form>`);
  }

  function openAddStockItem() {
    openModal("STOK", "Yeni ürün ekle", `<form id="stockItemForm" class="modal-grid">
      <div class="modal-grid two"><label class="field">Ürün / malzeme adı<input name="name" required placeholder="Örn. Anestezi kartuşu" /></label><label class="field">Kategori<input name="category" required placeholder="Sarf, cerrahi..." /></label></div>
      <div class="modal-grid two"><label class="field">Başlangıç miktarı<input name="amount" type="number" min="0" step="1" value="0" required /></label><label class="field">Minimum seviye<input name="minimum" type="number" min="0" step="1" value="0" required /></label></div>
      <div class="modal-grid two"><label class="field">Birim<input name="unit" required value="adet" placeholder="adet, kutu, tüp" /></label><label class="field">Alış fiyatı<input name="purchasePrice" type="number" min="0" step="0.01" value="0" /></label></div>
      <label class="field">Tedarikçi<input name="supplier" placeholder="Firma adı" /></label>
      <p class="modal-note">Ürün ve açılış miktarı cihazda kalıcı saklanır. Sunucu bağlantısında canlı stok panelinden merkezi yönetilebilir.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Ürünü kaydet</button></div>
    </form>`);
  }

  function openAddTreatmentHistory(patientId) {
    const patient = patientById(patientId);
    if (!patient) return showToast("Hasta kaydı bulunamadı.");
    const doctorOptions = clinicDoctors.map((doctor) => `<option>${escapeHtml(doctor.name)}</option>`).join("");
    if (!doctorOptions) return showToast("Önce Klinik yönetimi bölümünden doktor ekleyin.");
    openModal("TEDAVİ GEÇMİŞİ", `${patient.name} için kayıt`, `<form id="treatmentHistoryForm" class="modal-grid"><input type="hidden" name="patientId" value="${escapeHtml(patient.id)}" />
      <div class="modal-grid two"><label class="field">Tedavi<input name="treatment" required placeholder="Dolgu, kontrol, ölçü..." /></label><label class="field">Tarih<input name="date" type="date" value="${todayIso}" required /></label></div>
      <label class="field">Hekim<select name="doctor" required>${doctorOptions}</select></label>
      <label class="field">Klinik notu<textarea name="note" required minlength="3" placeholder="Uygulanan işlem, kullanılan malzeme ve takip notu"></textarea></label>
      <p class="modal-note">Bu alan geçmişten gelen veya randevu dışında tamamlanan klinik işlemler içindir. Randevuyu “Tamamlandı” yapmak tedavi geçmişini zaten otomatik oluşturur.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-patient="${escapeHtml(patient.id)}">Vazgeç</button><button type="submit" class="button button-primary">Tedavi kaydını ekle</button></div>
    </form>`);
  }

  function openAddCommunication() {
    const recipients = state.patients.map((item) => item.name);
    openModal("İLETİŞİM", "İletişim kaydı ekle", `<form id="communicationForm" class="modal-grid">
      <label class="field">Hasta / kişi<input name="patient" list="communicationRecipients" required /><datalist id="communicationRecipients">${recipients.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist></label>
      <div class="modal-grid two"><label class="field">Kanal<select name="channel"><option>WhatsApp</option><option>SMS</option><option>E-posta</option><option>Telefon</option><option>Klinik içi not</option></select></label><label class="field">Durum<select name="status"><option>Yerel taslak</option><option>Arandı</option><option>Yanıt bekleniyor</option><option>Teslim edildi</option></select></label></div>
      <label class="field">Mesaj / görüşme notu<textarea name="message" required minlength="3"></textarea></label>
      <p class="modal-note">Bu kayıt cihazda saklanır. WhatsApp, SMS veya e-posta gönderimi yapmaz; gönderim için bağlı canlı panel kullanılmalıdır.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-module="İletişim">Vazgeç</button><button type="submit" class="button button-primary">Kaydı ekle</button></div>
    </form>`);
  }

  function openAddTreatment() {
    if (!state.patients.length || !clinicDoctors.length) return showToast("Tedavi kaydı için hasta ve doktor gereklidir.");
    openModal("GERÇEKLEŞEN TEDAVİ", "Klinik işlem ekle", `<form id="treatmentForm" class="modal-grid">
      <div class="modal-grid two"><label class="field">Hasta<select name="patientId">${state.patients.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</select></label><label class="field">Hekim<select name="doctor">${clinicDoctors.map((item) => `<option>${escapeHtml(item.name)}</option>`).join("")}</select></label></div>
      <div class="modal-grid two"><label class="field">Tedavi<input name="treatment" required placeholder="İmplant, dolgu..." /></label><label class="field">Diş / bölge<input name="tooth" placeholder="36 veya tüm ağız" /></label></div>
      <div class="modal-grid two"><label class="field">Tarih<input name="date" type="date" value="${todayIso}" required /></label><label class="field">Başlangıç durumu<select name="status"><option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED" selected>Başladı</option><option value="COMPLETED">Doğrudan tamamlandı</option><option value="CANCELLED">İptal</option></select></label></div>
      <label class="field">Ücret<input name="fee" type="number" min="0" step="0.01" value="0" required /></label><label class="field">Klinik açıklaması<textarea name="description"></textarea></label>
      <div class="modal-grid two"><label class="field">Before fotoğraf<input name="beforePhoto" type="file" accept="image/*" capture="environment" /></label><label class="field">After fotoğraf<input name="afterPhoto" type="file" accept="image/*" capture="environment" /></label></div>
      <p class="modal-note">Başlayan tedaviye daha sonra ilerleme notu ekleyebilir ve “Tedaviyi bitir” ile kapatabilirsiniz. Bitirilen kayıt hasta geçmişine ve kişi raporuna otomatik eklenir.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-module="Gerçekleşen tedaviler">Vazgeç</button><button class="button button-primary">Kaydet</button></div>
    </form>`);
  }

  function openAddStaff() {
    openModal("PERSONEL", "Ekip üyesi ekle", `<form id="staffForm" class="modal-grid">
      <div class="modal-grid two"><label class="field">Ad soyad<input name="fullName" required /></label><label class="field">Görev<input name="roleLabel" required placeholder="Asistan, sekreter..." /></label></div>
      <div class="modal-grid two"><label class="field">Telefon<input name="phone" type="tel" /></label><label class="field">E-posta<input name="email" type="email" /></label></div>
      <div class="modal-grid two"><label class="field">Çalışma saatleri<input name="workingHours" placeholder="Pzt-Cum 09:00-18:00" /></label><label class="field">Ücret / hakediş<input name="compensation" placeholder="Aylık veya prim notu" /></label></div>
      <label class="field checkbox-field"><input name="active" type="checkbox" checked /> Aktif personel</label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-module="Personel">Vazgeç</button><button class="button button-primary">Kaydet</button></div>
    </form>`);
  }

  function openAddTreatmentPlan() {
    if (!state.patients.length) return showToast("Önce bir hasta ekleyin.");
    if (!clinicDoctors.length) return showToast("Önce Klinik yönetimi bölümünden doktor ekleyin.");
    const patientOptions = state.patients.map((patient) => `<option value="${escapeHtml(patient.id)}">${escapeHtml(patient.name)}</option>`).join("");
    openModal("TEDAVİ PLANLAMA", "Yeni tedavi planı", `<form id="treatmentPlanForm" class="modal-grid">
      <label class="field">Hasta<select name="patientId" required>${patientOptions}</select></label>
      <div class="modal-grid two"><label class="field">Tedavi türü<input name="treatment" required placeholder="İmplant, kanal tedavisi..." /></label><label class="field">Diş / bölge<input name="tooth" placeholder="Örn. 36 veya tüm ağız" /></label></div>
      <div class="modal-grid two"><label class="field">Hekim<select name="doctor" required>${clinicDoctors.map((doctor) => `<option>${escapeHtml(doctor.name)}</option>`).join("")}</select></label><label class="field">Şube<input name="branch" value="${escapeHtml(currentClinicName())}" required /></label></div>
      <div class="modal-grid two"><label class="field">Plan tarihi<input name="date" type="date" value="${todayIso}" required /></label><label class="field">Durum<select name="status"><option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED">Başladı</option><option value="COMPLETED">Tamamlandı</option><option value="CANCELLED">İptal</option></select></label></div>
      <div class="modal-grid two"><label class="field">Toplam ücret<input name="total" type="number" min="0" step="1" value="0" required /></label><label class="field">Alınan peşinat / ödeme<input name="paid" type="number" min="0" step="1" value="0" required /></label></div>
      <div class="modal-grid two"><label class="field">Taksit sayısı<select name="installmentCount"><option value="1">Tek çekim</option><option value="2">2 taksit</option><option value="3">3 taksit</option><option value="4">4 taksit</option><option value="6">6 taksit</option><option value="9">9 taksit</option><option value="12">12 taksit</option><option value="18">18 taksit</option><option value="24">24 taksit</option></select></label><label class="field">İlk taksit tarihi<input name="firstInstallmentDate" type="date" value="${todayIso}" /></label></div>
      <label class="field">Taksit notu<input name="paymentPlanNote" placeholder="Örn. Her ayın 15'inde kartla" /></label>
      <label class="field">Klinik notu<textarea name="note" placeholder="Uygulama aşamaları, malzeme, kontrol ve hasta bilgilendirme notları"></textarea></label>
      <p class="modal-note">Plan cihazda kalıcı kaydedilir. Girilen ödeme ayrıca peşinat olarak finans kaydına eklenir. Sunucu bağlandığında plan ve ödeme merkezi kliniğe eşitlenir.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Tedavi planını kaydet</button></div>
    </form>`);
  }

  function openStockMovement(preferredItemId) {
    const options = stockItems.map((item) => `<option value="${escapeHtml(item.id)}" ${Number(preferredItemId) === Number(item.id) ? "selected" : ""}>${escapeHtml(item.name)} · ${displayNumber(item.amount)} ${escapeHtml(item.unit)}</option>`).join("");
    if (!options) return showToast("Önce bir stok ürünü ekleyin.");
    openModal("STOK HAREKETİ", "Adet ekle / çıkar", `<form id="stockMovementForm" class="modal-grid">
      <label class="field">Ürün<select name="itemId" required>${options}</select></label>
      <div class="modal-grid two"><label class="field">İşlem<select name="type"><option value="IN">Stok girişi</option><option value="OUT">Stok çıkışı</option><option value="ADJUSTMENT">Sayım düzeltmesi</option></select></label><label class="field">Miktar / yeni seviye<input name="quantity" type="number" min="0" step="1" value="1" required /></label></div>
      <label class="field">Not<input name="note" placeholder="Fatura, kullanım veya sayım açıklaması" /></label>
      <p class="modal-note">Çıkışta mevcut miktardan fazla ürün düşülemez. Sayım düzeltmesinde yazdığınız sayı doğrudan yeni stok seviyesi olur.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Hareketi kaydet</button></div>
    </form>`);
  }

  function openAddStockRecipe() {
    if (!stockItems.length) return showToast("Önce bir stok ürünü ekleyin.");
    const options = stockItems.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${displayNumber(item.amount)} ${escapeHtml(item.unit)}</option>`).join("");
    openModal("OTOMATİK SARF", "Tedavi malzeme reçetesi", `<form id="stockRecipeForm" class="modal-grid">
      <label class="field">Tedavi adı<input name="treatmentType" required placeholder="Örn. Kompozit dolgu" /></label>
      <label class="field">Kullanılan malzeme<select name="itemId" required>${options}</select></label>
      <label class="field">Her tedavide kullanılan miktar<input name="quantity" type="number" min="1" step="1" value="1" required /></label>
      <p class="modal-note">Randevu “Tamamlandı” yapıldığında bu miktar stoktan otomatik düşer. İşlem geri alınırsa miktar stoğa iade edilir.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Reçeteyi kaydet</button></div>
    </form>`);
  }

  function openTreatmentPlanDetail(id) {
    const plan = treatmentPlans.find((item) => Number(item.id) === Number(id));
    if (!plan) return;
    const paymentPlan = plan.paymentPlan && typeof plan.paymentPlan === "object" ? plan.paymentPlan : null;
    const installments = Array.isArray(paymentPlan?.installments) ? paymentPlan.installments.slice(0, 24) : [];
    const linkedPayment = state.transactions.find((item) => Number(item.treatmentPlanId) === Number(plan.id));
    const paid = linkedPayment ? Math.max(0, finiteNumber(linkedPayment.amount)) : Math.max(0, finiteNumber(plan.paid));
    const remaining = Math.max(0, finiteNumber(plan.total) - paid);
    let paidTowardInstallments = Math.max(0, paid - finiteNumber(paymentPlan?.downPayment));
    const schedule = installments.map((item) => {
      const amount = finiteNumber(item.amount); const explicitPaid = finiteNumber(item.paidAmount);
      const paidAmount = explicitPaid > 0 ? Math.min(amount, explicitPaid) : Math.min(amount, paidTowardInstallments);
      paidTowardInstallments = Math.max(0, paidTowardInstallments - paidAmount);
      return { ...item, amount, paidAmount, state: paidAmount >= amount ? "Ödendi" : paidAmount > 0 ? "Kısmi ödendi" : "Bekliyor" };
    });
    openModal("TEDAVİ PLANI DETAYI", plan.patient, `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(plan.treatment)}</strong><br/>Durum: ${escapeHtml(plan.status)} · Plan tarihi: ${escapeHtml(plan.plannedAt || "Belirtilmedi")}</p>
      <div class="finance-stats"><article class="finance-stat"><span>Toplam plan</span><strong>${currency(plan.total || 0)}</strong><small>${currency(paid)} tahsil edildi</small></article><article class="finance-stat"><span>Kalan bakiye</span><strong>${currency(remaining)}</strong><small>Planın %${finiteNumber(plan.total) > 0 ? Math.round(paid / finiteNumber(plan.total) * 100) : 0}'i ödendi</small></article></div>
      <div class="history-list"><article><i>🦷</i><span><strong>Diş / bölge</strong><small>${escapeHtml(plan.tooth || "Belirtilmedi")}</small></span></article><article><i>👨‍⚕️</i><span><strong>Hekim</strong><small>${escapeHtml(plan.doctor || "Belirtilmedi")}</small></span></article><article><i>⌂</i><span><strong>Şube</strong><small>${escapeHtml(plan.branch || "Belirtilmedi")}</small></span></article></div>
      ${paymentPlan ? `<section class="patient-section"><div class="patient-section-title"><strong>Taksit planı</strong><span>${displayNumber(paymentPlan.installmentCount, schedule.length || 1)}</span></div><p class="modal-note"><strong>${installmentCurrency(paymentPlan.downPayment)} peşinat</strong>${paymentPlan.note ? `<br/>${escapeHtml(paymentPlan.note)}` : ""}</p><div class="installment-schedule">${schedule.map((item) => `<article class="installment-row ${item.state === "Ödendi" ? "paid" : ""}"><i>${displayNumber(item.number)}</i><span><strong>${installmentCurrency(item.amount)}</strong><small>${escapeHtml(formattedInstallmentDate(item.dueDate))}${item.paidAmount > 0 && item.paidAmount < item.amount ? ` · ${installmentCurrency(item.paidAmount)} ödendi` : ""}</small></span><span>${item.state}</span></article>`).join("") || `<p class="empty-inline">Taksit çizelgesi oluşturulmamış.</p>`}</div></section>` : `<p class="modal-note">Taksit planı tanımlanmadı.</p>`}
      <p class="modal-note"><strong>Klinik notu</strong><br/>${escapeHtml(plan.note || "Not eklenmemiş.")}</p>
    </div>`);
  }

  function openClinicManagement() {
    const meshConflicts = storage.get("clinicnova.meshConflicts", []).length;
    openModal("KLİNİK AYARLARI", "Klinik yönetimi", `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(currentClinicName())}</strong><br/>Randevu ve tedavi formlarındaki doktor ile koltuk seçeneklerini buradan yönetin.</p>
      <button class="button button-secondary" data-action="rename-clinic">Klinik adını değiştir</button>
      <button class="button button-secondary" data-action="mesh-sync">Cihaz eşitleme${meshConflicts ? ` · ${meshConflicts} çakışma` : ""}</button>
      <div class="section-heading"><div><span class="eyebrow">HEKİMLER</span><h3>Doktorlar</h3></div><button class="text-button" data-action="add-doctor">Doktor ekle</button></div>
      <div class="list-stack">${clinicDoctors.map((doctor) => swipeDeleteRecord(`<article class="offline-record"><span class="record-icon">👨‍⚕️</span><span class="patient-copy"><strong>${escapeHtml(doctor.name)}</strong><small>${escapeHtml(doctor.specialty || "Diş hekimi")} · ${escapeHtml(doctor.email || "")}</small></span></article>`, `data-delete-doctor="${escapeHtml(doctor.id)}"`, `${doctor.name} doktorunu kaldır`)).join("") || `<div class="empty-state">Doktor eklenmedi.</div>`}</div>
      <div class="section-heading"><div><span class="eyebrow">PLANLAMA</span><h3>Koltuklar</h3></div><button class="text-button" data-action="add-chair">Koltuk ekle</button></div>
      <div class="list-stack">${clinicChairs.map((chair) => swipeDeleteRecord(`<article class="offline-record"><span class="record-icon">🪑</span><span class="patient-copy"><strong>${escapeHtml(chair)}</strong><small>Randevu planlamasında kullanılabilir</small></span></article>`, `data-delete-chair="${escapeHtml(chair)}"`, `${chair} koltuğunu kaldır`)).join("") || `<div class="empty-state">Koltuk eklenmedi.</div>`}</div>
    </div>`);
  }

  function openMeshSync() {
    if (previewMode) return showToast("Cihaz eşitleme inceleme modunda kapalıdır.");
    const conflicts = storage.get("clinicnova.meshConflicts", []);
    if (!meshConfig) {
      openModal("YEREL CİHAZ AĞI", "Cihaz eşitleme", `<div class="modal-grid">
        <p class="modal-note">Merkezi sunucu kullanılmaz. Aynı klinik koduna sahip telefon ve bilgisayarlar aynı Wi‑Fi/LAN üzerinde şifreli olarak eşitlenir.</p>
        <button class="button button-primary" data-action="mesh-create">Bu cihazda klinik ağı oluştur</button>
        <form id="meshJoinForm" class="modal-grid"><label class="field">Diğer cihazdaki eşleştirme kodu<textarea name="code" rows="4" required placeholder="CN1..."></textarea></label><button class="button button-secondary" type="submit">Mevcut klinik ağına katıl</button></form>
      </div>`);
      return;
    }
    const code = meshPairingCode(meshConfig);
    openModal("YEREL CİHAZ AĞI", "Cihaz eşitleme", `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(meshStatus)}</strong><br/>Cihaz: ${escapeHtml(meshConfig.deviceName)}${meshLastPeer ? `<br/>Son eş: ${escapeHtml(meshLastPeer)}` : ""}<br/>İşlem günlüğü: ${meshEngine?.export().operations.length || 0} · Çakışma: ${conflicts.length}</p>
      <label class="field">Yeni cihazı ekleme kodu<textarea id="meshPairingCode" rows="5" readonly>${escapeHtml(code)}</textarea></label>
      <p class="modal-note">Bu kod klinik verilerinin şifreleme anahtarını içerir. Yalnızca kliniğe ait güvenilir cihaza aktarın.</p>
      <div class="modal-actions"><button class="button button-primary" data-action="mesh-sync-now">Şimdi eşitle</button><button class="button button-secondary" data-action="clinic-management">Geri</button></div>
      ${conflicts.length ? `<div class="history-list">${conflicts.slice(0, 20).map((item) => `<article><i>!</i><span><strong>${escapeHtml(item.key)}</strong><small>${item.variants.length} eşzamanlı değişiklik saklandı; doğru sürümü seçin.</small>${item.variants.map((variant) => `<button class="text-button" data-action="mesh-resolve" data-conflict-key="${escapeHtml(item.key)}" data-operation-id="${escapeHtml(variant.operationId)}">${escapeHtml(variant.action === "DELETE" ? "Silinmiş sürümü seç" : `${variant.payload?.name || variant.payload?.title || variant.payload?.patient || "Kayıt"} · ${variant.deviceId.slice(-6)}`)}</button>`).join("")}</span></article>`).join("")}</div>` : ""}
      ${swipeDeleteRecord(`<div class="swipe-danger-copy"><strong>Bu cihazı klinik ağından çıkar</strong><small>Yerel kayıtlar korunur. İşlemi onaylamak için sola kaydırın.</small></div>`, `data-action="mesh-disable"`, "Bu cihazı klinik ağından çıkar")}
    </div>`);
  }

  function openAddDoctor() {
    openModal("KLİNİK AYARLARI", "Doktor ekle", `<form id="doctorForm" class="modal-grid"><label class="field">Ad soyad<input name="name" required placeholder="Dr. Ad Soyad" /></label><label class="field">E-posta<input name="email" type="email" required /></label><label class="field">Uzmanlık<input name="specialty" placeholder="Genel diş hekimliği" /></label><div class="modal-actions"><button type="button" class="button button-secondary" data-action="clinic-management">Vazgeç</button><button type="submit" class="button button-primary">Doktoru kaydet</button></div></form>`);
  }

  function openAddChair() {
    openModal("KLİNİK AYARLARI", "Koltuk ekle", `<form id="chairForm" class="modal-grid"><label class="field">Koltuk adı<input name="name" required placeholder="Örn. Koltuk 4" /></label><div class="modal-actions"><button type="button" class="button button-secondary" data-action="clinic-management">Vazgeç</button><button type="submit" class="button button-primary">Koltuğu kaydet</button></div></form>`);
  }

  function openRenameClinic() {
    openModal("KLİNİK AYARLARI", "Klinik adını değiştir", `<form id="clinicNameForm" class="modal-grid"><label class="field">Klinik adı<input name="name" value="${escapeHtml(previewMode ? previewClinicName : localAccount()?.clinicName || "ClinicNova")}" required maxlength="120" /></label><div class="modal-actions"><button type="button" class="button button-secondary" data-action="clinic-management">Vazgeç</button><button type="submit" class="button button-primary">Adı güncelle</button></div></form>`);
  }

  function openAddManualTodo() {
    const iconOptions = MANUAL_TODO_ICONS.map((icon, index) => `<label class="icon-choice"><input type="radio" name="icon" value="${escapeHtml(icon)}" ${index === 0 ? "checked" : ""} /><span>${escapeHtml(icon)}</span></label>`).join("");
    openModal("GÜNLÜK KONTROL", "Yapılacak ekle", `<form id="manualTodoForm" class="modal-grid"><label class="field">Yapılacak madde<input name="title" required maxlength="200" placeholder="Örn. Kompresörü kontrol et" autocomplete="off" /></label><label class="field">Detay (opsiyonel)<input name="detail" maxlength="200" placeholder="Kısa açıklama" autocomplete="off" /></label><div class="field"><span class="field-label">İkon</span><div class="icon-picker">${iconOptions}</div></div><p class="modal-note">Madde bugünün yapılacaklar listesine otomatik görevler gibi ikonuyla eklenir. “Yapıldı” dediğinde silinmez; tik ile tamamlandı görünür. Tüm klinik cihazlarıyla eşitlenir.</p><div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Ekle</button></div></form>`);
    setTimeout(() => $("#manualTodoForm [name='title']")?.focus(), 60);
  }

  function openAddCalendarNote(prefillDate) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(prefillDate || "")) ? prefillDate : (state.organizerDate || todayIso);
    const doctorOptions = [`<option value="">Genel not</option>`, ...clinicDoctors.map((doctor) => `<option value="${escapeHtml(doctor.name)}">${escapeHtml(doctor.name)}</option>`)].join("");
    openModal("AJANDA", "Güne not ekle", `<form id="calendarNoteForm" class="modal-grid"><label class="field">Tarih<input name="date" type="date" value="${escapeHtml(date)}" required /></label><label class="field">İlgili hekim (opsiyonel)<select name="doctor">${doctorOptions}</select></label><label class="field">Not<textarea name="text" rows="3" required maxlength="500" placeholder="Örn. Dr. Lara Er bugün İzmir şubesinde 10:00-16:00 arası çalışıyor"></textarea></label><p class="modal-note">Not seçilen güne kaydedilir ve tüm klinik cihazlarında ajanda takviminde görünür.</p><div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Notu kaydet</button></div></form>`);
    setTimeout(() => $("#calendarNoteForm [name='text']")?.focus(), 60);
  }

  function openStockDetail(id) {
    const item = stockItems.find((entry) => Number(entry.id) === Number(id));
    if (!item) return;
    const offers = Array.isArray(item.offers) ? [...item.offers].filter((offer) => offer.inStock !== false).sort((a, b) => (Number(a.unitPrice) + Number(a.shippingPrice || 0)) - (Number(b.unitPrice) + Number(b.shippingPrice || 0))) : [];
    const serverUrl = previewMode ? "" : storage.get("clinicnova.serverUrl", "");
    openModal("STOK DETAYI", item.name, `<div class="modal-grid">
      <div class="finance-stats"><article class="finance-stat"><span>Mevcut</span><strong>${displayNumber(item.amount)} ${escapeHtml(item.unit)}</strong><small>Minimum ${displayNumber(item.minimum)}</small></article><article class="finance-stat"><span>Stok değeri</span><strong>${currency(finiteNumber(item.amount) * finiteNumber(item.purchasePrice))}</strong><small>${currency(item.purchasePrice)} / ${escapeHtml(item.unit)}</small></article></div>
      <p class="modal-note"><strong>${escapeHtml(item.category || "Kategorisiz")}</strong><br/>Tedarikçi: ${escapeHtml(item.supplier || "Belirtilmedi")}<br/>Son hareket: ${escapeHtml(item.movements?.[0]?.note || "Henüz hareket yok")}</p>
      <div class="stock-actions"><button class="button button-primary" data-action="add-stock-offer" data-stock-prefill="${escapeHtml(item.id)}" ${productSearchInFlight ? "disabled" : ""}>${productSearchInFlight ? "Fiyat okunuyor…" : "Satın alma sayfası ekle"}</button><button class="button button-secondary" data-action="stock-movement" data-stock-prefill="${escapeHtml(item.id)}">Adet ekle / çıkar</button></div>
      <section class="patient-section"><div class="patient-section-title"><strong>Satın alma sayfaları</strong><span>${offers.length}</span></div><div class="purchase-list">${offers.length ? offers.map((offer) => { const total = finiteNumber(offer.unitPrice) + finiteNumber(offer.shippingPrice); const checkedDate = offer.checkedAt ? new Date(offer.checkedAt) : null; const checked = checkedDate && !Number.isNaN(checkedDate.getTime()) ? checkedDate.toLocaleString("tr-TR", { timeZone: CLINIC_TIME_ZONE }) : "Kayıtlı fiyat"; const productURL = safeHttpsURL(offer.productUrl); return swipeDeleteRecord(`<div class="purchase-row"><span><strong>${escapeHtml(offer.seller)}</strong><small>Ürün ${currency(offer.unitPrice)} + kargo ${currency(offer.shippingPrice)} · ${escapeHtml(checked)}</small></span><span class="purchase-actions">${productURL ? `<a class="mini-action" href="${escapeHtml(productURL)}" target="_blank" rel="noopener noreferrer">${currency(total)} · Satın al</a>` : `<span class="mini-action" aria-disabled="true">Bağlantı geçersiz</span>`}</span></div>`, `data-delete-stock-offer="${escapeHtml(offer.id)}" data-stock-id="${escapeHtml(item.id)}"`, `${offer.seller} satın alma fiyatını kaldır`); }).join("") : `<p class="empty-inline">Henüz sayfa eklenmedi. Mağazadaki ürün bağlantısını girerek güncel fiyatı görebilirsiniz.</p>`}</div></section>
      ${serverUrl ? `<p class="modal-note">Ürün sayfasını yapıştırın; ClinicNova fiyatı okuyup “Satın al” bağlantısını hazırlar.</p>` : `<p class="modal-note">Sayfadaki fiyatı okumak için ClinicNova sunucunuzu bağlayın.</p>`}
    </div>`);
  }

  function openAddStockOffer(preferredItemId) {
    const item = stockItems.find((entry) => Number(entry.id) === Number(preferredItemId));
    if (!item) return;
    openModal("SATIN ALMA", `${item.name} fiyatı`, `<form id="stockOfferForm" class="modal-grid"><input type="hidden" name="itemId" value="${escapeHtml(item.id)}" />
      <p class="modal-note">Mağazadaki ürünün satın alma sayfasını yapıştırın. Güncel fiyat ve satıcı bilgisi otomatik okunacaktır.</p>
      <label class="field">Satın alma sayfası<input name="productUrl" type="url" pattern="https://.*" placeholder="https://magaza.com/urun/..." required /></label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Fiyatı getir</button></div></form>`);
  }

  function refreshOnlineOffers(preferredItemId, productUrl) {
    const item = stockItems.find((entry) => Number(entry.id) === Number(preferredItemId));
    if (!item) return showToast("Stok ürünü bulunamadı.");
    const serverUrl = previewMode ? "" : storage.get("clinicnova.serverUrl", "");
    if (!serverUrl || typeof window.ClinicNovaNative?.productSearch !== "function") return showToast("İnternet fiyatları için önce ClinicNova sunucusuna bağlanın.");
    if (!navigator.onLine) return showToast("İnternet bağlantısı yok; kayıtlı fiyatlar gösteriliyor.");
    if (productSearchInFlight) return showToast("Ürün fiyatı araması devam ediyor.");
    productSearchInFlight = true;
    openStockDetail(item.id);
    window.ClinicNovaNative.productSearch(serverUrl, productUrl, String(item.id));
  }

  function openPatientDetail(id) {
    const patient = patientById(id);
    if (!patient) return;
    const appointments = state.appointments.filter((item) => item.patientId === patient.id);
    const history = state.treatmentHistory[patient.id] || [];
    const payments = state.transactions.filter((item) => item.patientId === patient.id && item.type === "income");
    const media = state.patientMedia[patient.id] || [];
    const totalPaid = payments.filter((item) => item.status === "PAID").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalRemaining = payments.reduce((sum, item) => sum + outstandingAmount(item), 0);
    openModal("HASTA PROFİLİ", patient.name, `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(patient.phone)}</strong><br/>${escapeHtml(patient.email || "E-posta belirtilmedi")}<br/>Kimlik: ${escapeHtml(patient.nationalId || "Belirtilmedi")} · Doğum: ${escapeHtml(patient.birthDate || "Belirtilmedi")}<br/>Adres: ${escapeHtml(patient.address || "Belirtilmedi")}<br/>Son ziyaret: ${escapeHtml(patient.lastVisit)}</p>
      <p class="modal-note"><strong>Sağlık özeti</strong><br/>Alerji: ${escapeHtml(patient.allergies || "Yok / belirtilmedi")}<br/>Kronik hastalık: ${escapeHtml(patient.chronicDiseases || "Yok / belirtilmedi")}<br/>İlaçlar: ${escapeHtml(patient.medications || "Yok / belirtilmedi")}</p>
      <div class="finance-stats"><article class="finance-stat"><span>Tahsil edilen</span><strong>${currency(totalPaid)}</strong><small>${payments.length} ödeme kaydı</small></article><article class="finance-stat"><span>Kalan bakiye</span><strong>${currency(totalRemaining)}</strong><small>${appointments.length} randevu</small></article></div>
      <section class="patient-section"><div class="patient-section-title"><strong>Geçmiş tedaviler</strong><span>${history.length}</span></div><div class="history-list">${history.length ? history.map((item, index) => swipeDeleteRecord(`<article><i>🦷</i><span><strong>${escapeHtml(item.treatment)}</strong><small>${escapeHtml(item.date)} · ${escapeHtml(item.doctor)}</small><p>${escapeHtml(item.note)}</p></span></article>`, `data-delete-treatment="${index}" data-patient-id="${escapeHtml(patient.id)}"`, `${item.treatment} geçmiş kaydını kaldır`)).join("") : `<p class="empty-inline">Tedavi geçmişi yok.</p>`}</div><button class="button button-secondary" data-action="add-treatment-history" data-patient-prefill="${escapeHtml(patient.id)}">Geçmiş tedavi ekle</button></section>
      <section class="patient-section"><div class="patient-section-title"><strong>Ödeme geçmişi</strong><span>${payments.length}</span></div><div class="history-list">${payments.length ? payments.map((item) => swipeDeleteRecord(`<article><i>₺</i><span><strong>${currency(item.amount)} · ${escapeHtml(item.detail)}</strong><small>${escapeHtml(item.date)}${outstandingAmount(item) ? ` · Kalan ${currency(outstandingAmount(item))}` : " · Tamamlandı"}</small>${Array.isArray(item.components) && item.components.length ? `<p>${item.components.map((line) => `${escapeHtml(line.name)}: ${currency(line.amount)}`).join(" · ")}</p>` : ""}</span></article>`, `data-delete-transaction="${escapeHtml(item.id)}" data-patient-id="${escapeHtml(patient.id)}"`, `${item.name} ödeme kaydını kaldır`)).join("") : `<p class="empty-inline">Ödeme geçmişi yok.</p>`}</div></section>
      <section class="patient-section"><div class="patient-section-title"><strong>Before / After fotoğrafları</strong><span>${media.length}</span></div><div class="photo-grid">${media.length ? media.map((item) => { const source = safeImageSource(item.dataUrl); return source ? swipeDeleteRecord(`<figure><img src="${escapeHtml(source)}" alt="${escapeHtml(item.kind)} fotoğrafı"/><figcaption>${escapeHtml(item.kind)} · ${escapeHtml(item.date)}</figcaption></figure>`, `data-delete-media="${escapeHtml(item.id)}" data-patient-id="${escapeHtml(patient.id)}"`, `${item.kind} fotoğrafını kaldır`, "photo-swipe") : ""; }).join("") || `<p class="empty-inline">Geçersiz fotoğraf kayıtları gösterilmedi.</p>` : `<p class="empty-inline">Henüz fotoğraf eklenmedi.</p>`}</div><div class="photo-actions"><label class="button button-secondary">📷 Before çek<input class="visually-hidden" type="file" accept="image/*" capture="environment" data-patient-media="${escapeHtml(patient.id)}" data-media-kind="Before" /></label><label class="button button-secondary">📷 After çek<input class="visually-hidden" type="file" accept="image/*" capture="environment" data-patient-media="${escapeHtml(patient.id)}" data-media-kind="After" /></label><label class="button button-secondary">Dosyalardan yükle<input class="visually-hidden" type="file" accept="image/*" data-patient-media="${escapeHtml(patient.id)}" data-media-kind="Dosya" /></label></div></section>
      <div class="modal-actions"><button class="button button-secondary" data-edit-patient="${escapeHtml(patient.id)}">Bilgileri düzenle</button><button class="button button-secondary" data-action="add-appointment" data-patient-prefill="${escapeHtml(patient.id)}">Yeni randevu oluştur</button><button class="button button-primary" data-action="add-payment" data-patient-prefill="${escapeHtml(patient.id)}">Ödeme ekle</button></div>
    </div>`);
  }

  function openAppointmentDetail(id) {
    const appointment = state.appointments.find((item) => item.id === Number(id));
    if (!appointment) return;
    const patient = patientById(appointment.patientId);
    const appointmentTreatment = treatmentKey(appointment.treatment);
    const signedConsent = consentRecords.find((item) => { const consentTreatment = treatmentKey(item.treatment); return Number(item.patientId) === Number(appointment.patientId) && item.status === "İmzalandı" && (consentTreatment === "genel" || appointmentTreatment.includes(consentTreatment) || consentTreatment.includes(appointmentTreatment)); });
    openModal("RANDEVU DETAYI", `${String(appointment.time || "")} · ${String(patient?.name || "Hasta")}`, `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(appointment.treatment)}</strong><br/>${escapeHtml(appointment.doctor)} · ${escapeHtml(appointment.room)}<br/>${displayNumber(appointment.duration)} dakika · ${escapeHtml(statusLabel(appointment.status))}</p>
      <p class="modal-note"><strong>Onam kontrolü</strong><br/>${signedConsent ? `İmzalı: ${escapeHtml(signedConsent.form)} · ${escapeHtml(signedConsent.signedAt || signedConsent.date)}` : "Bu tedaviyle eşleşen imzalı onam bulunamadı. İşlem öncesi Onam bölümünü kontrol edin."}</p>
      <label class="field">Durum<select id="appointmentStatus"><option value="PLANNED" ${appointment.status === "PLANNED" ? "selected" : ""}>Planlandı</option><option value="ARRIVED" ${appointment.status === "ARRIVED" ? "selected" : ""}>Geldi</option><option value="COMPLETED" ${appointment.status === "COMPLETED" ? "selected" : ""}>Tamamlandı</option><option value="PENDING_CONFIRMATION" ${appointment.status === "PENDING_CONFIRMATION" ? "selected" : ""}>Onay bekliyor</option><option value="NO_SHOW" ${appointment.status === "NO_SHOW" ? "selected" : ""}>Gelmedi</option><option value="CANCELLED" ${appointment.status === "CANCELLED" ? "selected" : ""}>İptal edildi</option></select></label>
      <button class="button button-primary" data-save-appointment="${escapeHtml(appointment.id)}">Durumu güncelle</button>
    </div>`);
  }

  function openConnection() {
    if (previewMode) {
      openModal("İNCELEME MODU", "Sunucu bağlantısı kapalı", `<div class="modal-grid"><p class="modal-note">İnceleme verileri örnektir ve gerçek klinik hesabına gönderilmez. Sunucu eşitlemesini kullanmak için incelemeden çıkıp yerel veya sunucu hesabınızla giriş yapın.</p><button class="button button-primary" data-close-modal>Anladım</button></div>`);
      return;
    }
    const saved = storage.get("clinicnova.serverUrl", "");
    openModal("SENKRONİZASYON", "Sunucuya bağlan", `<form id="connectionForm" class="modal-grid">
      <p class="modal-note">Veriler önce bu cihazda kaydedilir. HTTPS sunucunuzu bağladıktan sonra bekleyen ${syncQueue.length} işlem klinik hesabınıza gönderilir; tekrar denemeler çift kayıt oluşturmaz.</p>
      <label class="field">Sunucu adresi<input name="url" type="url" value="${escapeHtml(saved)}" placeholder="https://clinic.example.com" required /></label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Giriş yap ve eşitle</button></div>
    </form>`);
  }

  function openSecurity() {
    if (previewMode) {
      openModal("İNCELEME MODU", "Örnek veriler korumalı", `<div class="modal-grid">
        <p class="modal-note"><strong>Gerçek verilerden ayrı</strong><br/>Bu oturumdaki hasta, randevu, stok ve finans kayıtları yalnızca sürümü denemeniz içindir.</p>
        <p class="modal-note"><strong>Kaydedilmez ve eşitlenmez</strong><br/>Yaptığınız denemeler uygulamadan çıktığınızda silinir; mevcut klinik hesabınız ve kayıtlarınız değişmez.</p>
        <button class="button button-secondary" data-reset-demo>Örnek verileri sıfırla</button>
      </div>`);
      return;
    }
    openModal("GÜVENLİK", "Veri ve uygulama", `<div class="modal-grid">
      <p class="modal-note"><strong>Yerel çalışma</strong><br/>Hasta, randevu ve tahsilat kayıtları bağlantı olmasa da cihazın uygulama alanında kalıcı saklanır. Bekleyen işlem: ${syncQueue.length}.</p>
      <p class="modal-note"><strong>Sunucu eşitlemesi</strong><br/>Yalnızca bağladığınız HTTPS ClinicNova sunucusuna, giriş yaptığınız klinik hesabı kapsamında gönderilir.</p>
      ${swipeDeleteRecord(`<div class="swipe-danger-copy"><strong>Yerel verileri temizle</strong><small>Tüm klinik kayıtlarını ve bekleyen eşitlemeleri kaldırmak için sola kaydırın.</small></div>`, "data-clear-local", "Bu cihazdaki tüm yerel verileri temizle")}
    </div>`);
  }

  function openProfile() {
    const account = previewMode ? { adminName: "Sürüm İnceleme", email: "Örnek veriler", clinicName: previewClinicName } : localAccount() || storage.get("clinicnova.session", {}) || {};
    openModal("PROFİL", account.adminName || "ClinicNova Yöneticisi", `<div class="modal-grid">
      <p class="modal-note"><strong>Yerel yönetici</strong><br/>${escapeHtml(account.email || "E-posta belirtilmedi")}<br/>${escapeHtml(account.clinicName || "ClinicNova")}</p>
      <div class="finance-stats"><article class="finance-stat"><span>Aktif hasta</span><strong>${state.patients.length}</strong><small>Cihazdaki kayıtlar</small></article><article class="finance-stat"><span>Bugünkü randevu</span><strong>${state.appointments.filter((item) => item.date === todayIso).length}</strong><small>Günlük plan</small></article></div>
      <button class="button button-secondary" data-go="more">Ayarları aç</button>
    </div>`);
  }

  function openFinanceReport() {
    const paidIncome = monthlyPaidTransactions().reduce((sum, item) => sum + finiteNumber(item.amount), 0);
    const expenses = state.transactions.filter((item) => item.type === "expense" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pending = state.transactions.filter(hasOpenBalance).reduce((sum, item) => sum + outstandingAmount(item), 0);
    openModal("FİNANS RAPORU", "Aylık özet", `<div class="modal-grid">
      <div class="finance-stats"><article class="finance-stat"><span>Tahsil edilen</span><strong>${currency(paidIncome)}</strong><small>Ödenmiş işlemler</small></article><article class="finance-stat"><span>Net akış</span><strong>${currency(paidIncome - expenses)}</strong><small>Gelir − gider</small></article></div>
      <div class="finance-stats"><article class="finance-stat"><span>Bekleyen</span><strong>${currency(pending)}</strong><small>Geciken tahsilatlar</small></article><article class="finance-stat"><span>Gider</span><strong>${currency(expenses)}</strong><small>Kaydedilmiş giderler</small></article></div>
      <button class="button button-primary" data-go="finance">Finans merkezini aç</button>
    </div>`);
  }

  function openDashboardSummary(kind) {
    if (kind === "appointments") {
      const items = state.appointments.filter((item) => item.date === todayIso).sort((left, right) => String(left.time || "").localeCompare(String(right.time || "")));
      const completed = items.filter((item) => item.status === "COMPLETED").length;
      openModal("BUGÜNÜN ÖZETİ", "Randevu akışı", `<div class="modal-grid"><div class="finance-stats"><article class="finance-stat"><span>Toplam</span><strong>${items.length}</strong><small>${completed} tamamlandı</small></article><article class="finance-stat"><span>Bekleyen</span><strong>${items.filter((item) => !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status)).length}</strong><small>${items.filter((item) => item.status === "PENDING_CONFIRMATION").length} onay bekliyor</small></article></div><div class="history-list">${items.map((appointment) => `<button class="summary-row" data-appointment="${escapeHtml(appointment.id)}"><i>${escapeHtml(appointment.time)}</i><span><strong>${escapeHtml(patientById(appointment.patientId)?.name || "Hasta")}</strong><small>${escapeHtml(appointment.treatment)} · ${escapeHtml(statusLabel(appointment.status))}</small></span></button>`).join("") || `<p class="empty-inline">Bugün randevu yok.</p>`}</div><button class="button button-primary" data-go="appointments">Randevulara git</button></div>`);
      return;
    }
    if (kind === "revenue") {
      const items = monthlyPaidTransactions();
      const total = items.reduce((sum, item) => sum + finiteNumber(item.amount), 0);
      openModal("AYLIK TAHSİLAT", "Tahsilat özeti", `<div class="modal-grid"><div class="finance-stats"><article class="finance-stat"><span>Toplam tahsilat</span><strong>${currency(total)}</strong><small>${items.length} ödenmiş işlem</small></article><article class="finance-stat"><span>Ortalama işlem</span><strong>${currency(items.length ? total / items.length : 0)}</strong><small>${escapeHtml(todayIso.slice(0, 7))} dönemi</small></article></div><div class="history-list">${items.slice(0, 8).map((item) => `<button class="summary-row" data-finance-transaction="${escapeHtml(item.id)}"><i>₺</i><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)} · ${currency(item.amount)}</small></span></button>`).join("") || `<p class="empty-inline">Bu ay tahsilat kaydı yok.</p>`}</div><button class="button button-primary" data-go="finance">Finans merkezine git</button></div>`);
      return;
    }
    if (kind === "patients") {
      const active = state.patients.filter((item) => item.tag !== "PASSIVE");
      const tagCounts = countLabels(active, "tag");
      openModal("HASTA ÖZETİ", "Aktif hastalar", `<div class="modal-grid"><div class="finance-stats"><article class="finance-stat"><span>Aktif toplam</span><strong>${active.length}</strong><small>${state.patients.length} kayıt içinden</small></article><article class="finance-stat"><span>Yeni</span><strong>${active.filter((item) => item.tag === "NEW").length}</strong><small>İlk görüşme kayıtları</small></article></div><div class="history-list">${tagCounts.map(([tag, count]) => `<article><i>•</i><span><strong>${escapeHtml(tag)}</strong><small>${count} hasta</small></span></article>`).join("") || `<p class="empty-inline">Aktif hasta yok.</p>`}</div><button class="button button-primary" data-go="patients">Hasta listesine git</button></div>`);
      return;
    }
    if (kind === "payments") {
      const items = state.transactions.filter(hasOpenBalance).sort((left, right) => outstandingAmount(right) - outstandingAmount(left));
      const total = items.reduce((sum, item) => sum + outstandingAmount(item), 0);
      openModal("BEKLEYEN ÖDEMELER", "Tahsilat özeti", `<div class="modal-grid"><div class="finance-stats"><article class="finance-stat"><span>Bekleyen toplam</span><strong>${currency(total)}</strong><small>${items.length} ödeme planı</small></article><article class="finance-stat"><span>Ortalama bakiye</span><strong>${currency(items.length ? total / items.length : 0)}</strong><small>Hasta başına</small></article></div><div class="history-list">${items.map((item) => `<button class="summary-row" data-finance-transaction="${escapeHtml(item.id)}"><i>!</i><span><strong>${escapeHtml(item.name)}</strong><small>${currency(outstandingAmount(item))} kaldı · ${displayNumber(item.installmentCount, 1)} taksit</small></span></button>`).join("") || `<p class="empty-inline">Bekleyen ödeme yok.</p>`}</div><button class="button button-primary" data-transaction-filter="PENDING">Bekleyenleri aç</button></div>`);
    }
  }

  function openTransactionFilter() {
    const filters = [["ALL", "Tüm işlemler"], ["PAID", "Ödenenler"], ["PENDING", "Gecikenler"], ["EXPENSE", "Giderler"]];
    openModal("FİLTRE", "Finans hareketleri", `<div class="filter-action-grid">${filters.map(([value, label]) => `<button class="filter-action ${state.transactionFilter === value ? "active" : ""}" data-transaction-filter="${value}"><strong>${label}</strong><small>${value === "PENDING" ? "Aksiyon bekleyen tahsilatlar" : value === "EXPENSE" ? "Klinik giderleri" : value === "PAID" ? "Tamamlanan tahsilatlar" : "Bütün finans hareketleri"}</small></button>`).join("")}</div>`);
  }

  function treatmentRecordCard(item) {
    const before = safeImageSource(item.beforePhoto); const after = safeImageSource(item.afterPhoto);
    const progress = item.status === "COMPLETED" ? 100 : Math.max(0, Math.min(90, finiteNumber(item.progress)));
    const content = `<button class="offline-record clickable-record treatment-photo-record" data-treatment-detail="${escapeHtml(item.id)}"><span class="record-icon">🦷</span><span class="patient-copy"><strong>${escapeHtml(item.patient)}</strong><small>${escapeHtml(item.treatment)} · ${escapeHtml(item.doctor)} · ${escapeHtml(item.date)}</small><span class="record-progress"><i style="width:${progress}%"></i></span>${before || after ? `<span class="treatment-photo-pair">${before ? `<figure><img src="${escapeHtml(before)}" alt="Tedavi öncesi"/><figcaption>Before</figcaption></figure>` : ""}${after ? `<figure><img src="${escapeHtml(after)}" alt="Tedavi sonrası"/><figcaption>After</figcaption></figure>` : ""}</span>` : ""}</span><span class="record-value">%${displayNumber(progress)}<small>${escapeHtml(treatmentStatusLabel(item.status))}</small></span></button>`;
    return swipeDeleteRecord(content, `data-delete-record="${escapeHtml(item.id)}" data-record-kind="treatments"`, `${item.patient} ${item.treatment} tedavisini kaldır`);
  }

  function openPatientReport(id) {
    const patient = patientById(id);
    if (!patient) return;
    const history = safeArray(state.treatmentHistory[patient.id]).filter((item, index, all) => all.findIndex((candidate) => String(candidate.treatmentId ?? candidate.id ?? candidate.appointmentId ?? `${candidate.treatment}:${candidate.date}`) === String(item.treatmentId ?? item.id ?? item.appointmentId ?? `${item.treatment}:${item.date}`)) === index);
    const completed = history.length;
    const totalPaid = state.transactions.filter((item) => Number(item.patientId) === Number(patient.id) && item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + finiteNumber(item.amount), 0);
    openModal("KİŞİ RAPORU", patient.name, `<div class="modal-grid"><div class="finance-stats"><article class="finance-stat"><span>Geçmiş tedavi</span><strong>${completed}</strong><small>Bitirilmiş işlem</small></article><article class="finance-stat"><span>Tahsil edilen</span><strong>${currency(totalPaid)}</strong><small>Kişi toplamı</small></article></div><section class="patient-section"><div class="patient-section-title"><strong>Geçmiş tedaviler</strong><span>${completed}</span></div><div class="history-list">${history.map((item) => `<article><i>🦷</i><span><strong>${escapeHtml(item.treatment)}</strong><small>${escapeHtml(item.date)} · ${escapeHtml(item.doctor)}</small><p>${escapeHtml(item.note || "Tedavi tamamlandı.")}</p></span></article>`).join("") || `<p class="empty-inline">Bitirilmiş tedavi kaydı yok.</p>`}</div></section><button class="button button-primary" data-patient="${escapeHtml(patient.id)}">Hasta profilini aç</button></div>`);
  }

  function openModule(name) {
    if (name === "Finans") return navigate("finance");
    if (name === "Dijital onam") return navigate("consents");
    if (name === "Çöp Kutusu" && !canManageTrash()) return showToast("Çöp Kutusunu yönetme yetkiniz yok.");
    const paidIncome = state.transactions.filter((item) => item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const expenses = state.transactions.filter((item) => item.type === "expense" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pendingTotal = state.transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + outstandingAmount(item), 0);
    const completedAppointments = state.appointments.filter((item) => item.status === "COMPLETED").length;
    const noShowAppointments = state.appointments.filter((item) => item.status === "NO_SHOW").length;
    const stockValue = stockItems.reduce((sum, item) => sum + Number(item.amount || 0) * Number(item.purchasePrice || 0), 0);
    const criticalStock = stockItems.filter((item) => Number(item.amount) <= Number(item.minimum)).length;
    const treatmentCounts = countLabels(state.appointments, "treatment");
    const doctorCounts = countLabels(state.appointments, "doctor");
    const moduleContent = {
      "Tedavi planları": `<div class="list-stack">${treatmentPlans.map((plan) => swipeDeleteRecord(`<button class="offline-record clickable-record" data-treatment-plan="${escapeHtml(plan.id)}"><span class="record-icon">🦷</span><span class="patient-copy"><strong>${escapeHtml(plan.patient)}</strong><small>${escapeHtml(plan.treatment)} · ${escapeHtml(plan.status)}</small><span class="record-progress"><i style="width:${percentage(plan.paid, plan.total)}%"></i></span></span><span class="record-value">${currency(plan.paid)}<small>${currency(plan.total)} plan</small></span></button>`, `data-delete-record="${escapeHtml(plan.id)}" data-record-kind="treatmentPlans"`, `${plan.patient} tedavi planını kaldır`)).join("") || `<p class="empty-inline">Tedavi planı yok.</p>`}</div>`,
      "Gerçekleşen tedaviler": `<div class="modal-grid"><button class="button button-primary" data-action="add-treatment">Tedavi kaydı ekle</button><section class="patient-section"><div class="patient-section-title"><strong>Aktif tedaviler</strong><span>${treatments.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status)).length}</span></div><div class="list-stack">${treatments.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status)).map(treatmentRecordCard).join("") || `<p class="empty-inline">Aktif tedavi yok.</p>`}</div></section><section class="patient-section"><div class="patient-section-title"><strong>Geçmiş tedaviler</strong><span>${treatments.filter((item) => item.status === "COMPLETED").length}</span></div><div class="list-stack">${treatments.filter((item) => item.status === "COMPLETED").map(treatmentRecordCard).join("") || `<p class="empty-inline">Bitirilmiş tedavi yok.</p>`}</div></section></div>`,
      "Personel": `<div class="modal-grid"><button class="button button-primary" data-action="add-staff">Personel ekle</button><div class="list-stack">${staffRecords.map((item) => { const content = `<article class="offline-record"><span class="record-icon">👤</span><span class="patient-copy"><strong>${escapeHtml(item.fullName)}</strong><small>${escapeHtml(item.roleLabel)} · ${escapeHtml(item.workingHours || "Saat belirtilmedi")}</small></span><span class="record-state">${item.active === false ? "Pasif" : "Aktif"}</span>${item.active === false ? `<button class="mini-action" data-toggle-staff="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.fullName)} personelini yeniden aktifleştir">Yeniden aktifleştir</button>` : ""}</article>`; return item.active === false ? content : swipeDeleteRecord(content, `data-toggle-staff="${escapeHtml(item.id)}"`, `${item.fullName} personelini aktif kadrodan çıkar`); }).join("") || `<p class="empty-inline">Personel kaydı yok.</p>`}</div><p class="modal-note">Aktif personeli sola kaydırarak kadrodan çıkarabilirsiniz; geçmiş kayıtlar korunur.</p></div>`,
      "Stok": `<div class="list-stack">${stockItems.map((item) => { const critical = finiteNumber(item.amount) < finiteNumber(item.minimum); const content = `<button class="offline-record clickable-record" data-stock-item="${escapeHtml(item.id)}"><span class="transaction-icon ${critical ? "expense" : ""}">${critical ? "!" : "✓"}</span><span class="patient-copy"><strong>${escapeHtml(item.name)}</strong><small>Minimum ${displayNumber(item.minimum)} ${escapeHtml(item.unit)}</small></span><span class="record-value ${critical ? "critical" : ""}">${displayNumber(item.amount)}<small>${escapeHtml(item.unit)}</small></span></button>`; return canManageTrash() ? swipeDeleteRecord(content, `data-delete-record="${escapeHtml(item.id)}" data-record-kind="stockItems"`, `${item.name} stok kaydını kaldır`) : content; }).join("") || `<p class="empty-inline">Stok kaydı yok.</p>`}</div>`,
      "Raporlar": `<div class="modal-grid"><div class="finance-stats"><article class="finance-stat"><span>Tahsilat</span><strong>${currency(paidIncome)}</strong><small>Ödenmiş gelir</small></article><article class="finance-stat"><span>Net akış</span><strong>${currency(paidIncome - expenses)}</strong><small>${currency(expenses)} gider</small></article></div><div class="finance-stats"><article class="finance-stat"><span>Bekleyen</span><strong>${currency(pendingTotal)}</strong><small>Tahsil edilecek</small></article><article class="finance-stat"><span>Stok değeri</span><strong>${currency(stockValue)}</strong><small>${criticalStock} kritik ürün</small></article></div><div class="finance-stats"><article class="finance-stat"><span>Hasta</span><strong>${state.patients.length}</strong><small>Yerel kayıt</small></article><article class="finance-stat"><span>Randevu</span><strong>${state.appointments.length}</strong><small>${completedAppointments} tamamlandı · ${noShowAppointments} gelmedi</small></article></div><section class="patient-section"><div class="patient-section-title"><strong>Kişi raporları</strong><span>${state.patients.length}</span></div><div class="history-list">${state.patients.map((patient) => `<button class="summary-row" data-patient-report="${escapeHtml(patient.id)}"><i>${escapeHtml(initials(patient.name))}</i><span><strong>${escapeHtml(patient.name)}</strong><small>${safeArray(state.treatmentHistory[patient.id]).length} geçmiş tedavi · ayrıntılı kişi raporu</small></span></button>`).join("") || `<p class="empty-inline">Hasta kaydı yok.</p>`}</div></section><section class="patient-section"><div class="patient-section-title"><strong>Hekim performansı</strong><span>${doctorCounts.length}</span></div><div class="history-list">${doctorCounts.map(([doctor, count]) => `<article><i>👨‍⚕️</i><span><strong>${escapeHtml(doctor)}</strong><small>${count} randevu</small></span></article>`).join("") || `<p class="empty-inline">Hekim verisi yok.</p>`}</div></section><section class="patient-section"><div class="patient-section-title"><strong>Tedavi dağılımı</strong><span>${treatmentCounts.length}</span></div><div class="history-list">${treatmentCounts.slice(0, 8).map(([treatment, count]) => `<article><i>🦷</i><span><strong>${escapeHtml(treatment)}</strong><small>${count} kayıt</small></span></article>`).join("") || `<p class="empty-inline">Tedavi verisi yok.</p>`}</div></section><button class="button button-primary" data-go="finance">Finans ayrıntısını aç</button></div>`,
      "Dijital onam": `<div class="list-stack">${consentRecords.map((item) => swipeDeleteRecord(`<button class="offline-record clickable-record" data-consent="${escapeHtml(item.id)}"><span class="transaction-icon ${item.status === "İmzalandı" ? "" : "pending"}">${item.status === "İmzalandı" ? "✓" : "!"}</span><span class="patient-copy"><strong>${escapeHtml(item.patient)}</strong><small>${escapeHtml(item.form)} · ${escapeHtml(item.date)}</small></span><span class="record-state">${escapeHtml(item.status)}</span></button>`, `data-delete-record="${escapeHtml(item.id)}" data-record-kind="consentRecords"`, `${item.patient} onam kaydını kaldır`)).join("") || `<p class="empty-inline">Onam kaydı yok.</p>`}<p class="modal-note">Kimlik doğrulamalı imza gönderimi ve yasal sunucu kaydı bağlantı gerektirir.</p></div>`,
      "Çöp Kutusu": `<div class="modal-grid"><p class="modal-note">Hasta, stok, finans ve diğer silinen kayıtlar 30 gün burada saklanır. Süre dolunca otomatik ve kalıcı olarak temizlenir.</p><div class="list-stack">${trashItems.map((item) => swipeDeleteRecord(`<article class="trash-record"><span class="record-icon">♻</span><span class="patient-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(trashKindLabel(item.kind))} · ${displayNumber(trashDaysLeft(item))} gün kaldı</small></span><button class="mini-action" data-restore-trash="${escapeHtml(item.id)}">Geri yükle</button></article>`, `data-purge-trash="${escapeHtml(item.id)}"`, `${item.label} kaydını kalıcı kaldır`)).join("") || `<p class="empty-inline">Çöp Kutusu boş.</p>`}</div>${trashItems.length ? swipeDeleteRecord(`<div class="swipe-danger-copy"><strong>Çöp Kutusunu boşalt</strong><small>Tüm kayıtları kalıcı kaldırmak için sola kaydırın.</small></div>`, "data-empty-trash", "Çöp Kutusundaki tüm kayıtları kalıcı kaldır") : ""}</div>`
    };
    openModal("YEREL ÇALIŞMA", name, `<div class="modal-grid">${moduleContent[name] || `<p class="modal-note">Bu modül kullanılamıyor.</p>`}</div>`);
  }

  function openNotifications() {
    if (!previewMode) storage.set("clinicnova.notificationsRead", true);
    $("#notificationDot").hidden = true;
    const readyCount = reminderDeliveries.filter((item) => item.status === "READY").length;
    openModal("BİLDİRİMLER", readyCount ? `${readyCount} mesaj gönderilmeyi bekliyor` : "Bugün sizden beklenenler", `<div class="list-stack">
      ${reminderActionCards()}
      <button class="patient-card action-card" data-reminder-settings><span class="record-icon">🔔</span><span class="patient-copy"><strong>Randevu hatırlatma ayarları</strong><small>Hasta mesajı zamanlarını ve şablonunu yönetin.</small></span><svg><use href="#i-chevron"/></svg></button>
      <button class="patient-card action-card" data-module="Stok"><span class="transaction-icon expense">!</span><span class="patient-copy"><strong>Stok seviyesi kritik</strong><small>Anestezi kartuşu minimum seviyenin altında.</small></span><svg><use href="#i-chevron"/></svg></button>
      <button class="patient-card action-card" data-transaction-filter="PENDING"><span class="transaction-icon pending">!</span><span class="patient-copy"><strong>Tahsilat gecikmesi</strong><small>2 hastanın ödeme planı bugün aksiyon bekliyor.</small></span><svg><use href="#i-chevron"/></svg></button>
    </div>`);
  }

  function openReminderSettings() {
    const readyCount = reminderDeliveries.filter((item) => item.status === "READY").length;
    openModal("RANDEVU HATIRLATMALARI", "Hasta mesajı ayarları", `<form id="reminderSettingsForm" class="modal-grid">
      <label class="field checkbox-field"><input name="enabled" type="checkbox" ${reminderSettings.enabled ? "checked" : ""} /> Hatırlatma bildirimlerini aç</label>
      <div class="modal-grid two"><label class="field checkbox-field"><input name="weekEnabled" type="checkbox" ${reminderSettings.weekEnabled ? "checked" : ""} /> 1 hafta önce</label><label class="field checkbox-field"><input name="dayEnabled" type="checkbox" ${reminderSettings.dayEnabled ? "checked" : ""} /> 1 gün önce</label></div>
      <label class="field">Mesaj şablonu<textarea name="template" minlength="10" maxlength="1000" required>${escapeHtml(reminderSettings.template)}</textarea></label>
      <p class="modal-note">Kullanılabilir alanlar: {{name}}, {{date}}, {{time}}, {{treatment}} ve {{clinic}}. Mesajlar otomatik gönderilmez; bildirimden kopyalanır veya WhatsApp'ta açılır.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-open-notifications>Bildirimlere dön</button><button class="button button-primary" type="submit">Hatırlatma ayarlarını kaydet</button></div>
      ${readyCount ? `<section class="patient-section"><div class="patient-section-title"><strong>Gönderilmeyi bekleyenler</strong><span>${readyCount}</span></div><div class="list-stack">${reminderActionCards()}</div></section>` : ""}
    </form>`);
  }

  function updateNetworkBadge() {
    const badge = $("#networkBadge");
    if (previewMode) {
      badge.classList.add("offline");
      $("span", badge).textContent = "İnceleme modu";
      return;
    }
    const online = navigator.onLine;
    badge.classList.toggle("offline", !online);
    const connected = Boolean(storage.get("clinicnova.serverUrl", ""));
    $("span", badge).textContent = meshConfig ? meshStatus : syncQueue.length ? `${syncQueue.length} kayıt bekliyor` : connected && online ? "Senkronlandı" : online ? "Yerel kayıt" : "Çevrimdışı hazır";
  }

  function showApp() {
    authenticatedThisRun = true;
    $("#loginScreen").hidden = true;
    $("#appShell").hidden = false;
    applyLocalIdentity();
    renderAll();
    navigate(state.activeView);
    updateNetworkBadge();
  }
  function showLogin() {
    authenticatedThisRun = false;
    $("#appShell").hidden = true;
    $("#loginScreen").hidden = false;
    if (!demoMode) { $("#loginPassword").value = ""; configureEntryMode(); }
  }

  function enterPreviewMode() {
    previewMode = true;
    serverPermissions = null;
    previewClinicName = "İnceleme Kliniği";
    state.patients = JSON.parse(JSON.stringify(defaultPatients));
    state.appointments = JSON.parse(JSON.stringify(defaultAppointments));
    state.transactions = JSON.parse(JSON.stringify(defaultTransactions));
    state.treatmentHistory = JSON.parse(JSON.stringify(defaultTreatmentHistory));
    state.patientMedia = {};
    state.selectedDate = todayIso;
    state.patientFilter = "ALL";
    state.patientQuery = "";
    state.transactionFilter = "ALL";
    state.consentFilter = "ALL";
    state.appointmentMonth = calendarDate(`${todayIso.slice(0, 7)}-01`);
    state.activeView = "home";
    treatmentPlans = JSON.parse(JSON.stringify(defaultTreatmentPlans));
    stockItems = JSON.parse(JSON.stringify(defaultStockItems));
    stockRecipes = JSON.parse(JSON.stringify(defaultStockRecipes));
    clinicDoctors = JSON.parse(JSON.stringify(defaultClinicDoctors));
    clinicChairs = JSON.parse(JSON.stringify(defaultClinicChairs));
    communicationLog = JSON.parse(JSON.stringify(defaultCommunicationLog));
    consentRecords = JSON.parse(JSON.stringify(defaultConsentRecords));
    treatments = []; staffRecords = []; surveys = []; surveyResponses = []; recalls = [];
    trashItems = [];
    dailyTodoCompletions = {};
    syncQueue = [];
    syncMap = {};
    showApp();
    showToast("İnceleme modu açıldı. Parola gerekmez; değişiklikler kaydedilmez.");
  }

  function normalizedServerUrl(value) {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443") || !["", "/"].includes(parsed.pathname)) throw new Error("HTTPS gerekli");
    parsed.port = "";
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  }

  function connectToServer(value) {
    try {
      const serverUrl = normalizedServerUrl(value);
      if (!storage.set("clinicnova.serverUrl", serverUrl)) {
        showToast("Sunucu adresi cihazda saklanamadı; bağlantı başlatılmadı.");
        return false;
      }
      showToast("Sunucu hesabı girişi açılıyor…");
      const platform = encodeURIComponent(mobileConfig.platform || "android");
      setTimeout(() => {
        if (typeof window.ClinicNovaNative?.connect === "function") window.ClinicNovaNative.connect(serverUrl);
        else window.location.href = `${serverUrl}/login?next=%2Fmobile-connect&mobile=${platform}`;
      }, 350);
      return true;
    } catch {
      showToast("Geçerli bir HTTPS ClinicNova adresi girin.");
      return false;
    }
  }

  function syncPending(force = false) {
    if (demoMode || previewMode || syncing || !navigator.onLine) return;
    const serverUrl = storage.get("clinicnova.serverUrl", "");
    if (!serverUrl || !window.ClinicNovaNative?.sync) return;
    const lastPullAt = Number(storage.get("clinicnova.lastPullAt", 0));
    if (!force && !syncQueue.length && Date.now() - lastPullAt < 60_000) return;
    syncing = true;
    updateNetworkBadge();
    const operations = syncQueue.filter((item) => canSyncEntity(item.entityType)).slice(0, 50);
    const attemptedAt = new Date().toISOString();
    operations.forEach((item) => { item.attemptedAt ||= attemptedAt; });
    inFlightOperationIds = new Set(operations.map((item) => item.operationId));
    persistSyncState();
    try {
      clearTimeout(syncRequestTimer);
      syncRequestTimer = setTimeout(() => {
        if (!syncing) return;
        syncing = false; inFlightOperationIds.clear(); updateNetworkBadge();
        showToast("Sunucu yanıt vermedi; kayıtlar cihazda korunuyor ve yeniden denenecek.");
        scheduleSync(30_000);
      }, 55_000);
      window.ClinicNovaNative.sync(serverUrl, JSON.stringify({ deviceId, operations }));
    } catch {
      clearTimeout(syncRequestTimer); syncRequestTimer = null;
      syncing = false;
      inFlightOperationIds.clear();
      updateNetworkBadge();
      scheduleSync(30_000);
    }
  }

  function applyServerSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    if (snapshot.permissions && typeof snapshot.permissions === "object") { serverPermissions = snapshot.permissions; storage.set("clinicnova.serverPermissions", serverPermissions); }
    const deletedStockItems = canManageTrash() && Array.isArray(snapshot.deletedStockItems) ? snapshot.deletedStockItems : [];
    const collections = {
      PATIENT: Array.isArray(snapshot.patients) ? snapshot.patients : [],
      APPOINTMENT: Array.isArray(snapshot.appointments) ? snapshot.appointments : [],
      PAYMENT: Array.isArray(snapshot.transactions) ? snapshot.transactions : [],
      TREATMENT_PLAN: Array.isArray(snapshot.treatmentPlans) ? snapshot.treatmentPlans : [],
      STOCK_ITEM: Array.isArray(snapshot.stockItems) ? snapshot.stockItems : [],
      STOCK_RECIPE: Array.isArray(snapshot.stockRecipes) ? snapshot.stockRecipes : [],
      DOCTOR: Array.isArray(snapshot.doctors) ? snapshot.doctors : [],
      TREATMENT: Array.isArray(snapshot.treatments) ? snapshot.treatments : [],
      STAFF: Array.isArray(snapshot.staff) ? snapshot.staff : [],
      CONSENT: Array.isArray(snapshot.consents) ? snapshot.consents.map((item) => ({ ...item, form: item.templateName, status: consentStatusLabel(item.status) })) : [],
      COMMUNICATION: Array.isArray(snapshot.communication) ? snapshot.communication : []
    };
    const serverIds = Object.fromEntries(Object.entries(collections).map(([type, items]) => [type, new Map(items.map((item) => [String(item.serverId), item.id]))]));
    for (const [type, items] of Object.entries(collections)) {
      for (const item of items) if (item.serverId) syncMap[`${type}:${item.id}`] = String(item.serverId);
    }
    for (const stockItem of collections.STOCK_ITEM) {
      for (const offer of stockItem.offers || []) if (offer.serverId) syncMap[`STOCK_OFFER:${offer.id}`] = String(offer.serverId);
    }
    for (const stockItem of deletedStockItems) if (stockItem.serverId) syncMap[`STOCK_ITEM:${stockItem.id}`] = String(stockItem.serverId);
    const localIdForServer = (type, localId) => {
      const mappedServerId = syncMap[`${type}:${localId}`];
      return mappedServerId ? serverIds[type]?.get(String(mappedServerId)) ?? localId : localId;
    };
    const pendingIds = (type) => new Set(syncQueue.filter((item) => item.entityType === type).map((item) => String(item.clientId)));
    const retainPending = (items, type) => items.filter((item) => pendingIds(type).has(String(item.id)));
    const mergePending = (pending, type, serverItems) => {
      const pendingLocalIds = new Set(pending.map((item) => String(item.id)));
      const pendingServerIds = new Set(pending.map((item) => syncMap[`${type}:${item.id}`]).filter(Boolean).map(String));
      return [...pending, ...serverItems.filter((item) => !pendingLocalIds.has(String(item.id)) && !pendingServerIds.has(String(item.serverId)))];
    };
    const mapPatientReference = (item) => ({ ...item, patientId: localIdForServer("PATIENT", item.patientId) });

    const pendingPatients = retainPending(state.patients, "PATIENT");
    const pendingAppointments = retainPending(state.appointments, "APPOINTMENT").map(mapPatientReference);
    const pendingPayments = retainPending(state.transactions, "PAYMENT").map(mapPatientReference);
    const pendingPlans = retainPending(treatmentPlans, "TREATMENT_PLAN").map(mapPatientReference);
    const pendingStocks = retainPending(stockItems, "STOCK_ITEM");
    const pendingRecipes = retainPending(stockRecipes, "STOCK_RECIPE");
    const pendingDoctors = retainPending(clinicDoctors, "DOCTOR");
    const pendingTreatments = retainPending(treatments, "TREATMENT").map(mapPatientReference);
    const pendingStaff = retainPending(staffRecords, "STAFF");
    const pendingConsents = retainPending(consentRecords, "CONSENT").map(mapPatientReference);
    const pendingCommunication = retainPending(communicationLog, "COMMUNICATION").map(mapPatientReference);

    state.patients = mergePending(pendingPatients, "PATIENT", collections.PATIENT);
    state.appointments = mergePending(pendingAppointments, "APPOINTMENT", collections.APPOINTMENT);
    state.transactions = mergePending(pendingPayments, "PAYMENT", collections.PAYMENT);
    treatmentPlans = mergePending(pendingPlans, "TREATMENT_PLAN", collections.TREATMENT_PLAN);
    stockItems = mergePending(pendingStocks, "STOCK_ITEM", collections.STOCK_ITEM);
    stockRecipes = mergePending(pendingRecipes, "STOCK_RECIPE", collections.STOCK_RECIPE);
    clinicDoctors = mergePending(pendingDoctors, "DOCTOR", collections.DOCTOR);
    treatments = mergePending(pendingTreatments, "TREATMENT", collections.TREATMENT);
    staffRecords = mergePending(pendingStaff, "STAFF", collections.STAFF);
    consentRecords = mergePending(pendingConsents, "CONSENT", collections.CONSENT);
    surveys = [];
    surveyResponses = [];
    communicationLog = mergePending(pendingCommunication, "COMMUNICATION", collections.COMMUNICATION);
    recalls = [];
    if (canManageTrash()) {
      const incomingServerIds = new Set(deletedStockItems.map((item) => String(item.serverId || item.id)));
      const localOnly = trashItems.filter((item) => {
        if (item.kind !== "stockItems") return true;
        const mappedServerId = item.serverId || item.payload?.serverId || syncMap[`STOCK_ITEM:${item.payload?.id}`];
        return !item.serverTrash && !incomingServerIds.has(String(mappedServerId || item.payload?.id));
      });
      const serverTrash = deletedStockItems.map((item) => {
        const deletedAt = Number.isFinite(Number(item.deletedAt)) ? Number(item.deletedAt) : Date.parse(item.deletedAt || "") || Date.now();
        const expiresAt = Number.isFinite(Number(item.purgeAt)) ? Number(item.purgeAt) : Date.parse(item.purgeAt || "") || deletedAt + 30 * 24 * 60 * 60 * 1000;
        const localId = Number.isSafeInteger(Number(item.id)) ? Number(item.id) : nextLocalId();
        const payload = {
          id: localId, serverId: item.serverId || "", name: item.name || "Stok ürünü", category: item.category || "Kategorisiz",
          amount: finiteNumber(item.amount, finiteNumber(item.currentQuantity)), minimum: finiteNumber(item.minimum, finiteNumber(item.minimumQuantity)),
          unit: item.unit || "adet", supplier: item.supplier || "", purchasePrice: finiteNumber(item.purchasePrice), movements: safeArray(item.movements), offers: safeArray(item.offers)
        };
        return { id: localId, serverId: item.serverId || "", serverTrash: true, kind: "stockItems", label: payload.name, payload, deletedAt, expiresAt };
      });
      trashItems = [...serverTrash, ...localOnly].sort((left, right) => finiteNumber(right.deletedAt) - finiteNumber(left.deletedAt));
    } else {
      trashItems = trashItems.filter((item) => item.kind !== "stockItems");
    }
    const syncedTreatmentHistory = Object.create(null);
    for (const item of treatments) {
      if (item.status !== "COMPLETED") continue;
      const patientId = safeRecordKey(item.patientId);
      if (patientId) (syncedTreatmentHistory[patientId] ||= []).push(completedTreatmentHistoryEntry(item));
    }
    for (const [patientId, entries] of Object.entries(state.treatmentHistory)) {
      const localOnly = entries.filter((item) => !item.syncedTreatment && !treatments.some((treatment) => Number(treatment.id) === Number(item.id)));
      if (localOnly.length) (syncedTreatmentHistory[patientId] ||= []).push(...localOnly);
    }
    state.treatmentHistory = syncedTreatmentHistory;
    reconcileCompletedTreatmentHistory();
    if (snapshot.clinicConfig) {
      clinicChairs = Array.isArray(snapshot.clinicConfig.chairs) ? snapshot.clinicConfig.chairs : clinicChairs;
      const account = localAccount() || {};
      if (snapshot.clinicConfig.clinicName) account.clinicName = snapshot.clinicConfig.clinicName;
      if (!persistLocalAccount(account)) showToast("Sunucudan gelen klinik ayarı cihazda saklanamadı.");
      else applyLocalIdentity(account);
    }
    storage.set("clinicnova.lastPullAt", Date.now());
    saveData();
    renderAll();
  }

  window.ClinicNovaSyncResult = (status, responseText) => {
    clearTimeout(syncRequestTimer); syncRequestTimer = null;
    syncing = false;
    inFlightOperationIds.clear();
    let response = {};
    try { response = JSON.parse(responseText || "{}"); } catch { response = {}; }
    if (status === 401 || status === 403) {
      showToast("Sunucu oturumu gerekli. Sunucuya bağlan bölümünden giriş yapın.");
      updateNetworkBadge();
      return;
    }
    if (status === 200 && !Array.isArray(response.results)) {
      showToast("Sunucudan eksik veya bozuk eşitleme yanıtı geldi; kayıtlar cihazda korunuyor.");
      updateNetworkBadge(); scheduleSync(30_000); return;
    }
    if (status < 200 || status >= 300) {
      showToast(response.error || "Sunucuya ulaşılamadı; kayıtlar cihazda bekliyor.");
      updateNetworkBadge();
      scheduleSync(30_000);
      return;
    }
    const byId = new Map(syncQueue.map((item) => [item.operationId, item]));
    const queueIndex = new Map(syncQueue.map((item, index) => [item.operationId, index]));
    const syncedIds = new Set();
    const supersededIds = new Set();
    for (const result of response.results || []) {
      if (result.status !== "synced") continue;
      syncedIds.add(result.operationId);
      const operation = byId.get(result.operationId);
      if (!operation) continue;
      if (result.serverEntityId) syncMap[`${operation.entityType}:${operation.clientId}`] = result.serverEntityId;
      const completedIndex = queueIndex.get(operation.operationId);
      for (const candidate of syncQueue) {
        if (candidate.operationId === operation.operationId || !candidate.attemptedAt) continue;
        if (candidate.entityType === operation.entityType && String(candidate.clientId) === String(operation.clientId) && queueIndex.get(candidate.operationId) < completedIndex) {
          supersededIds.add(candidate.operationId);
        }
      }
    }
    syncQueue = syncQueue.filter((item) => !syncedIds.has(item.operationId) && !supersededIds.has(item.operationId));
    applyServerSnapshot(response.snapshot);
    persistSyncState();
    if (response.failed) showToast(`${response.synced} kayıt eşitlendi, ${response.failed} kayıt bekliyor.`);
    else if (response.synced) showToast(`${response.synced} kayıt sunucuya eşitlendi.`);
    if (syncQueue.some((item) => canSyncEntity(item.entityType))) scheduleSync(response.synced > 0 && !response.failed ? 300 : 30_000);
  };
  window.ClinicNovaNative?.onSyncResult?.(window.ClinicNovaSyncResult);

  window.ClinicNovaProductSearchResult = (status, responseText, itemId) => {
    productSearchInFlight = false;
    let response = {};
    try { response = JSON.parse(responseText || "{}"); } catch { response = {}; }
    const item = stockItems.find((entry) => Number(entry.id) === Number(itemId));
    if (!item) return showToast("Fiyatı aranan stok ürünü bulunamadı.");
    if (status === 401 || status === 403) {
      openStockDetail(item.id); showToast("Sunucu oturumu veya stok yetkisi gerekli."); return;
    }
    if (status < 200 || status >= 300 || !Array.isArray(response.offers)) {
      openStockDetail(item.id); showToast(response.error || "İnternet fiyatları alınamadı."); return;
    }
    const checkedAt = String(response.checkedAt || new Date().toISOString());
    const offers = response.offers.slice(0, 50).map((offer, index) => ({
      id: nextLocalId(), seller: String(offer.seller || "").trim(), unitPrice: Number(offer.unitPrice), shippingPrice: Number(offer.shippingPrice || 0),
      productUrl: String(offer.productUrl || "").trim(), inStock: offer.inStock !== false, checkedAt, source: "online"
    })).filter((offer) => offer.seller.length >= 2 && Number.isFinite(offer.unitPrice) && offer.unitPrice > 0 && Number.isFinite(offer.shippingPrice) && offer.shippingPrice >= 0 && offer.productUrl.startsWith("https://"));
    item.offers = offers.sort((left, right) => left.unitPrice + left.shippingPrice - right.unitPrice - right.shippingPrice);
    offers.forEach((offer) => queueCreate("STOCK_OFFER", offer.id, { itemId: String(item.id), seller: offer.seller, unitPrice: offer.unitPrice, shippingPrice: offer.shippingPrice, productUrl: offer.productUrl, inStock: offer.inStock }));
    saveData(); openStockDetail(item.id);
    showToast(offers.length ? `${offers.length} internet teklifi güncellendi.` : "Bu ürün için satışta teklif bulunamadı.");
  };
  window.ClinicNovaNative?.onProductSearchResult?.(window.ClinicNovaProductSearchResult);

  function configureEntryMode() {
    if (demoMode) {
      $("#authModeTabs").hidden = true;
      $("#previewDemoButton").hidden = true;
      $("#serverLoginButton").hidden = true;
      $("#recoveryButton").hidden = true;
      $("#localSetupFields").hidden = true;
      $("#serverUrlField").hidden = true;
      $("#serverUrl").required = false;
      $("#demoLoginFields").hidden = false;
      $("#loginEmail").required = true;
      $("#loginPassword").required = true;
      $("#loginEmail").value = "owner@clinicnova.test";
      $("#loginPassword").value = "password123";
      $("#loginPassword").minLength = 8;
      $("#loginTitle").textContent = "Kliniğiniz cebinizde.";
      $("#loginDescription").textContent = "Bugünün operasyonunu, hastalarınızı ve tahsilat akışını çevrimdışı demo verileriyle deneyin.";
      $("#loginSubmitLabel").textContent = "Demo girişi";
      $("#loginSecureNote").textContent = "Demo kayıtları yalnızca cihazda tutulur; gerçek hasta verisi kullanmayın.";
      return;
    }

    const account = localAccount();
    if (account) entryMode = "login";
    const creating = !account && entryMode === "register";
    const remoteLogin = !account && entryMode === "login";
    $("#authModeTabs").hidden = false;
    $("#registerModeButton").classList.toggle("active", creating);
    $("#registerModeButton").setAttribute("aria-selected", String(creating));
    $("#registerModeButton").disabled = Boolean(account);
    $("#loginModeButton").classList.toggle("active", !creating);
    $("#loginModeButton").setAttribute("aria-selected", String(!creating));
    $("#serverUrlField").hidden = !remoteLogin;
    $("#previewDemoButton").hidden = false;
    $("#serverLoginButton").hidden = remoteLogin;
    $("#recoveryButton").hidden = !account;
    $("#localSetupFields").hidden = !creating;
    $("#serverUrl").required = remoteLogin;
    $("#demoLoginFields").hidden = remoteLogin;
    $("#loginEmail").required = !remoteLogin;
    $("#loginPassword").required = !remoteLogin;
    $("#loginPassword").minLength = 10;
    $("#loginPassword").autocomplete = creating ? "new-password" : "current-password";
    $("#localClinicName").required = creating;
    $("#localAdminName").required = creating;
    const configuredUrl = mobileConfig.serverUrl || storage.get("clinicnova.serverUrl", "");
    $("#serverUrl").value = configuredUrl;
    $("#loginEmail").value = account?.email || "";
    $("#loginTitle").textContent = creating ? "Yerel yönetici hesabını oluşturun." : remoteLogin ? "ClinicNova hesabınıza giriş yapın." : `${account.clinicName} hesabına giriş`;
    $("#loginDescription").textContent = creating ? "Bu hesap internet olmasa da cihazdaki klinik kayıtlarını korur." : remoteLogin ? "Klinik sunucu adresinizi girin; güvenli giriş sayfası açılsın." : "İnternet olmadan çalışabilir; bağlantı geldiğinde sunucuyla eşitlenir.";
    $("#loginSubmitLabel").textContent = creating ? "Kaydol ve başla" : remoteLogin ? "Giriş sayfasını aç" : "Giriş yap";
    $("#loginSecureNote").textContent = remoteLogin ? "Sunucu adresi HTTPS olmalıdır. Hesap bilgileriniz yalnızca açılan güvenli giriş sayfasında kullanılır." : "Parolanın kendisi saklanmaz. Güvenli özeti cihazda tutulur; Windows ve Mac'te yerel kasa ayrıca işletim sistemiyle şifrelenir.";
  }

  $("#todayLabel").textContent = new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(today);
  $("#versionLabel").textContent = `ClinicNova ${mobileConfig.platformLabel || "Android"} · Sürüm ${mobileConfig.appVersion || "yerel"}`;
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const textLimitError = formTextLimitError(event.currentTarget);
    if (textLimitError) return showToast(textLimitError);
    if (!demoMode) {
      const submit = event.submitter;
      if (submit) submit.disabled = true;
      try {
        let account = localAccount();
        if (!account && entryMode === "login") {
          const connected = connectToServer($("#serverUrl").value);
          if (!connected) return;
          return;
        }
        const email = $("#loginEmail").value.trim().toLocaleLowerCase("tr-TR");
        const password = $("#loginPassword").value;
        if (!account) {
          const clinicName = $("#localClinicName").value.trim();
          const adminName = $("#localAdminName").value.trim();
          if (clinicName.length < 2 || adminName.length < 2 || !email.includes("@") || password.length < 10) return showToast("Klinik, yönetici, e-posta ve en az 10 karakterli parolayı kontrol edin.");
          const passwordSalt = randomSecret();
          const recoverySalt = randomSecret();
          const code = recoveryCode();
          account = {
            clinicName, adminName, email, iterations: LOCAL_AUTH_ITERATIONS, passwordSalt,
            passwordHash: await deriveLocalSecret(password, passwordSalt), recoverySalt,
            recoveryHash: await deriveLocalSecret(code.replaceAll("-", ""), recoverySalt), failures: 0, lockedUntil: 0, createdAt: Date.now()
          };
          if (!persistLocalAccount(account)) return showToast("Yerel hesap cihazda saklanamadı. Boş alanı ve cihaz kilidini kontrol edip yeniden deneyin.");
          showApp();
          openModal("HESAP KURTARMA", "Kurtarma kodunuzu kaydedin", `<div class="modal-grid"><p class="modal-note">Bu kod yalnızca şimdi gösterilir. Parolanızı unutursanız çevrimdışı hesabı bununla kurtarabilirsiniz.</p><p class="modal-note"><strong style="font-size:1.1rem;letter-spacing:.08em">${escapeHtml(code)}</strong></p><p class="modal-note">Kodu hasta bilgisinden ayrı ve güvenli bir yerde saklayın.</p><button class="button button-primary" data-close-modal>Anladım, kaydettim</button></div>`);
          showToast("Yerel yönetici hesabı oluşturuldu.");
          return;
        }
        if (Number(account.lockedUntil || 0) > Date.now()) return showToast(`Çok fazla yanlış deneme. ${Math.ceil((account.lockedUntil - Date.now()) / 60000)} dakika sonra tekrar deneyin.`);
        const candidate = await deriveLocalSecret(password, account.passwordSalt, account.iterations);
        if (email !== account.email || !secureEqual(candidate, account.passwordHash)) {
          account.failures = Number(account.failures || 0) + 1;
          if (account.failures >= 5) { account.lockedUntil = Date.now() + 5 * 60_000; account.failures = 0; }
          if (!persistLocalAccount(account)) warnPersistenceFailure();
          return showToast("E-posta veya parola yanlış.");
        }
        account.failures = 0; account.lockedUntil = 0;
        if (!persistLocalAccount(account)) return showToast("Giriş durumu cihazda güvenle saklanamadı. Boş alanı ve cihaz kilidini kontrol edin.");
        showApp();
        showToast(navigator.onLine ? "Giriş başarılı. Sunucu bağlantısı varsa eşitleme başlatıldı." : "Çevrimdışı giriş başarılı.");
        setTimeout(() => syncPending(true), 200);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Yerel giriş tamamlanamadı.");
      } finally {
        if (submit) submit.disabled = false;
      }
      return;
    }
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    if (!email.includes("@") || password.length < 8) return showToast("E-posta ve şifreyi kontrol edin.");
    storage.set("clinicnova.session", { email, createdAt: Date.now() });
    showApp();
    showToast("Hoş geldiniz, Derya.");
  });
  $("#registerModeButton").addEventListener("click", () => {
    if (localAccount()) return showToast("Bu cihazda zaten bir yerel hesap var. Yeni hesap için mevcut klinik verilerini ayrı bir cihazda kullanın.");
    entryMode = "register";
    configureEntryMode();
  });
  $("#loginModeButton").addEventListener("click", () => {
    entryMode = "login";
    configureEntryMode();
  });
  $("#serverLoginButton").addEventListener("click", () => {
    const current = storage.get("clinicnova.serverUrl", "") || mobileConfig.serverUrl || "";
    const value = window.prompt("HTTPS ClinicNova sunucu adresi", current || "https://");
    if (value) connectToServer(value);
  });
  $("#recoveryButton").addEventListener("click", () => {
    openModal("HESAP KURTARMA", "Yerel parolayı sıfırla", `<form id="recoveryForm" class="modal-grid"><label class="field">Kurtarma kodu<input name="code" autocomplete="off" required /></label><label class="field">Yeni parola<input name="password" type="password" minlength="10" autocomplete="new-password" required /></label><div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button class="button button-primary" type="submit">Parolayı yenile</button></div></form>`);
  });
  $("#previewDemoButton").addEventListener("click", enterPreviewMode);

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, [data-go], [data-action], [data-copy-reminder], [data-whatsapp-reminder], [data-complete-reminder]");
    if (!target) return;
    if (target.dataset.copyReminder) { copyReminderMessage(target.dataset.copyReminder); return; }
    if (target.dataset.whatsappReminder) {
      const item = reminderDeliveries.find((entry) => String(entry.id) === String(target.dataset.whatsappReminder));
      if (item) { item.lastOpenedAt = new Date().toISOString(); item.updatedAt = item.lastOpenedAt; saveData(); }
      return;
    }
    if (target.dataset.completeReminder) {
      const item = reminderDeliveries.find((entry) => String(entry.id) === String(target.dataset.completeReminder));
      if (!item || item.status !== "READY") return;
      item.status = "DONE"; item.completedAt = new Date().toISOString(); item.updatedAt = item.completedAt;
      communicationLog.unshift({ id: nextLocalId(), patientId: item.patientId, patient: item.patient, channel: "WhatsApp", status: "Personel gönderdi", message: item.message, date: "Şimdi", reminderDeliveryId: item.id });
      saveData(); openNotifications(); showToast("Mesaj gönderildi olarak işaretlendi."); return;
    }
    if (target.hasAttribute("data-reminder-settings")) return openReminderSettings();
    if (target.hasAttribute("data-open-notifications")) return openNotifications();
    if (target.dataset.go) { closeModal(); return navigate(target.dataset.go); }
    if (target.dataset.calendarStep) {
      const step = Number(target.dataset.calendarStep);
      state.appointmentMonth = new Date(Date.UTC(state.appointmentMonth.getUTCFullYear(), state.appointmentMonth.getUTCMonth() + step, 1, 12));
      renderAppointments(); return;
    }
    if (target.dataset.date) {
      state.selectedDate = target.dataset.date;
      const selected = calendarDate(state.selectedDate);
      if (selected) state.appointmentMonth = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1, 12));
      renderAppointments(); return;
    }
    if (target.dataset.financeFilter) { state.transactionFilter = target.dataset.financeFilter; renderFinance(); return; }
    if (target.dataset.consentFilter) { state.consentFilter = target.dataset.consentFilter; renderConsents(); return; }
    if (target.dataset.dashboardSummary) return openDashboardSummary(target.dataset.dashboardSummary);
    if (target.dataset.completeTodo) {
      const taskId = safeRecordKey(target.dataset.completeTodo);
      if (!taskId) return;
      (dailyTodoCompletions[todayIso] ||= Object.create(null))[taskId] = new Date().toISOString();
      const cutoff = addCalendarDays(todayIso, -45);
      for (const day of Object.keys(dailyTodoCompletions)) if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < cutoff) delete dailyTodoCompletions[day];
      saveData(); renderDailyTodos(); showToast("Görev bugün için tamamlandı."); return;
    }
    if (target.dataset.toggleManualTodo) {
      const todo = manualTodos.find((item) => String(item.id) === String(target.dataset.toggleManualTodo));
      if (!todo) return;
      todo.done = !todo.done; todo.updatedAt = new Date().toISOString();
      saveData(); renderDailyTodos(); return;
    }
    if (target.dataset.deleteManualTodo) {
      const before = manualTodos.length;
      manualTodos = manualTodos.filter((item) => String(item.id) !== String(target.dataset.deleteManualTodo));
      if (manualTodos.length === before) return;
      saveData(); renderDailyTodos(); showToast("Yapılacak maddesi kaldırıldı."); return;
    }
    if (target.dataset.organizerStep) {
      const step = Number(target.dataset.organizerStep);
      const base = state.organizerMonth || calendarDate(`${todayIso.slice(0, 7)}-01`);
      state.organizerMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + step, 1, 12));
      renderCalendarOrganizer(); return;
    }
    if (target.dataset.organizerDate) {
      state.organizerDate = target.dataset.organizerDate;
      const selected = calendarDate(state.organizerDate);
      if (selected) state.organizerMonth = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1, 12));
      renderCalendarOrganizer(); return;
    }
    if (target.dataset.deleteCalendarNote) {
      const before = calendarNotes.length;
      calendarNotes = calendarNotes.filter((item) => String(item.id) !== String(target.dataset.deleteCalendarNote));
      if (calendarNotes.length === before) return;
      saveData(); renderCalendarOrganizer(); showToast("Takvim notu kaldırıldı."); return;
    }
    if (target.dataset.treatmentDetail) return openTreatmentDetail(target.dataset.treatmentDetail);
    if (target.dataset.treatmentProgress) return openTreatmentProgress(target.dataset.treatmentProgress);
    if (target.dataset.finishTreatment) {
      const record = treatments.find((item) => Number(item.id) === Number(target.dataset.finishTreatment));
      if (!record || record.status === "COMPLETED") return;
      if (!window.confirm(`${record.patient} için ${record.treatment} tedavisi bitirilsin mi? Bu işlem hasta geçmişine ve kişi raporuna eklenecek.`)) return;
      const stockResult = applyLocalStockForTreatment(record, "COMPLETED");
      if (!stockResult.ok) return showToast(stockResult.message);
      record.status = "COMPLETED"; record.progress = 100; record.completedAt = new Date().toISOString();
      const progress = (record.progressHistory ||= []);
      if (!progress.some((item) => finiteNumber(item.progress) === 100)) progress.unshift({ progress: 100, note: record.description || "Tedavi tamamlandı.", doctor: record.doctor, date: "Şimdi" });
      syncCompletedTreatmentHistory(record);
      queueUpdate("TREATMENT", record.id, treatmentPayload(record)); saveData(); renderAll(); openTreatmentDetail(record.id); showToast(stockResult.message); return;
    }
    if (target.dataset.payBalance) return openBalancePayment(target.dataset.payBalance);
    if (target.dataset.financeTransaction) return openFinanceDetail(target.dataset.financeTransaction);
    if (target.dataset.consent) return openConsentDetail(target.dataset.consent);
    if (target.dataset.editConsentStatus) return openConsentStatusEditor(target.dataset.editConsentStatus);
    if (target.dataset.filter) { state.patientFilter = target.dataset.filter; $$("#patientFilters button").forEach((button) => button.classList.toggle("active", button === target)); renderPatients(); return; }
    if (target.dataset.restoreTrash) {
      const trashId = Number(target.dataset.restoreTrash);
      const trashItem = trashItems.find((item) => Number(item.id) === trashId);
      if (!trashItem) return;
      if (trashItem.kind === "stockItems" && !canManageTrash()) return showToast("Stok Çöp Kutusunu yönetme yetkiniz yok.");
      const payload = trashItem.payload;
      if (trashItem.kind === "patientBundle") {
        const restoredAppointments = prepareRestoredClinicalRecords(payload.appointments, applyLocalStockForAppointment);
        if (!restoredAppointments.ok) return showToast(restoredAppointments.message);
        const restoredTreatments = prepareRestoredClinicalRecords(payload.treatments, applyLocalStockForTreatment);
        if (!restoredTreatments.ok) {
          for (const appointment of restoredAppointments.records.filter((item) => item.status === "COMPLETED")) applyLocalStockForAppointment(appointment, "CANCELLED");
          return showToast(restoredTreatments.message);
        }
        state.patients.unshift(payload.patient);
        state.appointments.push(...restoredAppointments.records);
        state.transactions.push(...payload.transactions);
        treatmentPlans.push(...(payload.treatmentPlans || []));
        treatments.push(...restoredTreatments.records);
        communicationLog.push(...(payload.communication || []));
        consentRecords.push(...(payload.consents || []));
        if (payload.treatmentHistory?.length) state.treatmentHistory[payload.patient.id] = payload.treatmentHistory;
        if (payload.media?.length) state.patientMedia[payload.patient.id] = payload.media;
        restoredTreatments.records.forEach(syncCompletedTreatmentHistory);
        queueCreate("PATIENT", payload.patient.id, patientPayload(payload.patient));
        restoredAppointments.records.forEach((item) => queueCreate("APPOINTMENT", item.id, appointmentPayload(item)));
        payload.transactions.forEach((item) => queueCreate("PAYMENT", item.id, paymentPayload(item)));
        (payload.treatmentPlans || []).forEach((item) => queueCreate("TREATMENT_PLAN", item.id, treatmentPlanPayload(item)));
        restoredTreatments.records.forEach((item) => queueCreate("TREATMENT", item.id, treatmentPayload(item)));
        safeArray(payload.consents).forEach((item) => queueCreate("CONSENT", item.id, consentPayload(item)));
        (payload.communication || []).forEach((item) => queueCreate("COMMUNICATION", item.id, communicationPayload(item)));
      }
      if (trashItem.kind === "appointment") {
        const restored = JSON.parse(JSON.stringify(payload));
        if (restored.status === "COMPLETED") {
          restored.status = "STARTED";
          const stockResult = applyLocalStockForAppointment(restored, "COMPLETED");
          if (!stockResult.ok) return showToast(stockResult.message);
          restored.status = "COMPLETED";
        }
        state.appointments.push(restored); queueCreate("APPOINTMENT", restored.id, appointmentPayload(restored));
      }
      if (trashItem.kind === "transaction") { state.transactions.unshift(payload); queueCreate("PAYMENT", payload.id, paymentPayload(payload)); }
      if (trashItem.kind === "treatmentHistory") {
        let restoredTreatment = payload.treatmentRecord ? JSON.parse(JSON.stringify(payload.treatmentRecord)) : null;
        if (restoredTreatment?.status === "COMPLETED") {
          restoredTreatment.status = "STARTED";
          const stockResult = applyLocalStockForTreatment(restoredTreatment, "COMPLETED");
          if (!stockResult.ok) return showToast(stockResult.message);
          restoredTreatment.status = "COMPLETED";
        }
        if (restoredTreatment) {
          treatments = treatments.filter((item) => Number(item.id) !== Number(restoredTreatment.id));
          treatments.unshift(restoredTreatment); syncCompletedTreatmentHistory(restoredTreatment);
          queueCreate("TREATMENT", restoredTreatment.id, treatmentPayload(restoredTreatment));
        } else {
          const items = (state.treatmentHistory[payload.patientId] ||= []);
          const restoredId = String(payload.item?.treatmentId ?? payload.item?.id ?? payload.item?.appointmentId ?? "");
          if (!restoredId || !items.some((item) => String(item.treatmentId ?? item.id ?? item.appointmentId ?? "") === restoredId)) items.splice(payload.index, 0, payload.item);
        }
      }
      if (trashItem.kind === "media") (state.patientMedia[payload.patientId] ||= []).unshift(payload.item);
      if (trashItem.kind === "treatmentPlans") { treatmentPlans.unshift(payload); queueCreate("TREATMENT_PLAN", payload.id, treatmentPlanPayload(payload)); }
      if (trashItem.kind === "stockItems") {
        const restored = JSON.parse(JSON.stringify(payload)); delete restored.linkedRecipes; delete restored.linkedResponses;
        stockItems = stockItems.filter((item) => Number(item.id) !== Number(restored.id));
        stockItems.unshift(restored); queueCreate("STOCK_ITEM", restored.id, stockItemPayload(restored));
        for (const recipe of safeArray(payload.linkedRecipes)) {
          stockRecipes = stockRecipes.filter((item) => Number(item.id) !== Number(recipe.id));
          stockRecipes.unshift(JSON.parse(JSON.stringify(recipe))); queueCreate("STOCK_RECIPE", recipe.id, stockRecipePayload(recipe));
        }
        for (const offer of restored.offers || []) queueCreate("STOCK_OFFER", offer.id, { itemId: String(restored.id), seller: offer.seller, unitPrice: offer.unitPrice, shippingPrice: offer.shippingPrice || 0, productUrl: offer.productUrl, inStock: offer.inStock !== false });
      }
      if (trashItem.kind === "stockOffer") {
        const stockItem = stockItems.find((item) => Number(item.id) === Number(payload.stockId));
        if (stockItem) {
          (stockItem.offers ||= []).push(payload.offer);
          queueCreate("STOCK_OFFER", payload.offer.id, { itemId: String(stockItem.id), seller: payload.offer.seller, unitPrice: payload.offer.unitPrice, shippingPrice: payload.offer.shippingPrice || 0, productUrl: payload.offer.productUrl, inStock: payload.offer.inStock !== false });
        }
      }
      if (trashItem.kind === "communicationLog") { communicationLog.unshift(payload); queueCreate("COMMUNICATION", payload.id, communicationPayload(payload)); }
      if (trashItem.kind === "consentRecords") { consentRecords.unshift(payload); queueCreate("CONSENT", payload.id, consentPayload(payload)); }
      if (trashItem.kind === "treatments") {
        const restored = JSON.parse(JSON.stringify(payload)); delete restored.linkedRecipes; delete restored.linkedResponses;
        if (restored.status === "COMPLETED") {
          restored.status = "STARTED";
          const stockResult = applyLocalStockForTreatment(restored, "COMPLETED");
          if (!stockResult.ok) return showToast(stockResult.message);
          restored.status = "COMPLETED";
        }
        treatments = treatments.filter((item) => Number(item.id) !== Number(restored.id));
        treatments.unshift(restored); syncCompletedTreatmentHistory(restored); queueCreate("TREATMENT", restored.id, treatmentPayload(restored));
      }
      if (trashItem.kind === "staffRecords") { staffRecords.unshift(payload); queueCreate("STAFF", payload.id, staffPayload(payload)); }
      trashItems = trashItems.filter((item) => Number(item.id) !== trashId);
      saveData(); renderAll(); openModule("Çöp Kutusu"); showToast("Kayıt geri yüklendi."); return;
    }
    if (target.dataset.purgeTrash) {
      const trashId = Number(target.dataset.purgeTrash);
      if (!window.confirm("Bu kayıt kalıcı olarak silinsin mi? Bu işlem geri alınamaz.")) return;
      trashItems = trashItems.filter((item) => Number(item.id) !== trashId);
      saveData(); openModule("Çöp Kutusu"); showToast("Kayıt kalıcı olarak silindi."); return;
    }
    if (target.hasAttribute("data-empty-trash")) {
      if (!window.confirm("Çöp Kutusundaki tüm kayıtlar kalıcı olarak silinsin mi?")) return;
      trashItems = []; saveData(); openModule("Çöp Kutusu"); showToast("Çöp Kutusu boşaltıldı."); return;
    }
    if (target.dataset.toggleStaff) {
      const id = Number(target.dataset.toggleStaff);
      const staff = staffRecords.find((item) => Number(item.id) === id);
      if (!staff) return showToast("Personel kaydı bulunamadı.");
      const nextActive = staff.active === false;
      const prompt = nextActive
        ? `${staff.fullName} yeniden aktifleştirilsin mi?`
        : `${staff.fullName} aktif personelden çıkarılsın mı? Geçmiş kayıtları korunacaktır.`;
      if (!window.confirm(prompt)) return;
      staff.active = nextActive;
      queueUpdate("STAFF", staff.id, staffPayload(staff));
      saveData(); openModule("Personel");
      showToast(nextActive ? "Personel yeniden aktifleştirildi." : "Personel aktif kadrodan çıkarıldı."); return;
    }
    if (target.dataset.deleteRecord) {
      const id = Number(target.dataset.deleteRecord);
      const kind = target.dataset.recordKind;
      if (kind === "stockItems" && !canManageTrash()) return showToast("Stok kaydını silme yetkiniz yok.");
      const moduleByKind = { treatmentPlans: "Tedavi planları", treatments: "Gerçekleşen tedaviler", staffRecords: "Personel", stockItems: "Stok", communicationLog: "İletişim", consentRecords: "Dijital onam" };
      if (!moduleByKind[kind] || !window.confirm("Bu kayıt silinsin mi?")) return;
      const sourceByKind = { treatmentPlans, treatments, staffRecords, stockItems, communicationLog, consentRecords };
      const deletedRecord = sourceByKind[kind].find((item) => Number(item.id) === id);
      const linkedRecipes = kind === "stockItems" ? stockRecipes.filter((item) => Number(item.itemId) === id) : [];
      const trashPayload = deletedRecord ? JSON.parse(JSON.stringify({ ...deletedRecord, linkedRecipes })) : null;
      if (deletedRecord?.status === "COMPLETED" && kind === "treatments") applyLocalStockForTreatment(deletedRecord, "CANCELLED");
      if (deletedRecord) moveToTrash(kind, deletedRecord.name || deletedRecord.fullName || deletedRecord.title || deletedRecord.patient || deletedRecord.form || deletedRecord.reason || "Silinen kayıt", trashPayload);
      if (kind === "treatmentPlans") treatmentPlans = treatmentPlans.filter((item) => Number(item.id) !== id);
      if (kind === "treatments") {
        if (deletedRecord?.patientId) state.treatmentHistory[deletedRecord.patientId] = (state.treatmentHistory[deletedRecord.patientId] || []).filter((item) => String(item.treatmentId ?? item.id ?? "") !== String(id));
        treatments = treatments.filter((item) => Number(item.id) !== id); queueDelete("TREATMENT", id);
      }
      if (kind === "staffRecords") { staffRecords = staffRecords.filter((item) => Number(item.id) !== id); queueDelete("STAFF", id); }
      if (kind === "stockItems") stockItems = stockItems.filter((item) => Number(item.id) !== id);
      if (kind === "communicationLog") communicationLog = communicationLog.filter((item) => Number(item.id) !== id);
      if (kind === "consentRecords") consentRecords = consentRecords.filter((item) => Number(item.id) !== id);
      if (kind === "communicationLog") queueDelete("COMMUNICATION", id);
      if (kind === "consentRecords") queueDelete("CONSENT", id);
      if (kind === "treatmentPlans") queueDelete("TREATMENT_PLAN", id);
      if (kind === "stockItems") {
        stockRecipes = stockRecipes.filter((item) => Number(item.itemId) !== id);
        queueDelete("STOCK_ITEM", id);
      }
      const originalOpener = modalOpener;
      saveData();
      if (kind === "consentRecords" && state.activeView === "consents") { renderConsents(); showToast("Onam kaydı silindi."); return; }
      if (kind === "stockItems" && state.activeView === "stocks") { renderStocks(); showToast("Stok ürünü Çöp Kutusuna taşındı."); return; }
      if (kind === "treatmentPlans" && state.activeView === "treatment-plans") { renderTreatmentPlans(); showToast("Tedavi planı silindi."); return; }
      openModule(moduleByKind[kind]); modalOpener = originalOpener; showToast("Kayıt silindi."); return;
    }
      if (target.dataset.deletePatient) {
      const patientId = Number(target.dataset.deletePatient);
      const patient = patientById(patientId);
      if (!patient || !window.confirm(`${patient.name} ve bağlı randevu, ödeme, tedavi planı, onam ve fotoğraf kayıtları silinsin mi?`)) return;
      const linkedAppointments = state.appointments.filter((item) => item.patientId === patientId);
      const linkedTransactions = state.transactions.filter((item) => item.patientId === patientId);
      const linkedPlans = treatmentPlans.filter((item) => Number(item.patientId) === patientId);
      const linkedConsents = consentRecords.filter((item) => Number(item.patientId) === patientId);
      const linkedTreatments = treatments.filter((item) => Number(item.patientId) === patientId);
      const linkedCommunication = communicationLog.filter((item) => Number(item.patientId) === patientId);
      const patientBundle = JSON.parse(JSON.stringify({ patient, appointments: linkedAppointments, transactions: linkedTransactions, treatmentPlans: linkedPlans, consents: linkedConsents, treatments: linkedTreatments, communication: linkedCommunication, treatmentHistory: state.treatmentHistory[patientId] || [], media: state.patientMedia[patientId] || [] }));
      linkedAppointments.filter((item) => item.status === "COMPLETED").forEach((item) => { applyLocalStockForAppointment(item, "CANCELLED"); item.status = "CANCELLED"; });
      linkedTreatments.filter((item) => item.status === "COMPLETED").forEach((item) => applyLocalStockForTreatment(item, "CANCELLED"));
      moveToTrash("patientBundle", patient.name, patientBundle);
      linkedAppointments.forEach((item) => queueDelete("APPOINTMENT", item.id));
      linkedTransactions.forEach((item) => queueDelete("PAYMENT", item.id));
      linkedPlans.forEach((item) => queueDelete("TREATMENT_PLAN", item.id));
      linkedConsents.forEach((item) => queueDelete("CONSENT", item.id));
      linkedTreatments.forEach((item) => queueDelete("TREATMENT", item.id));
      linkedCommunication.forEach((item) => queueDelete("COMMUNICATION", item.id));
      queueDelete("PATIENT", patientId);
      state.patients = state.patients.filter((item) => item.id !== patientId);
      state.appointments = state.appointments.filter((item) => item.patientId !== patientId);
      state.transactions = state.transactions.filter((item) => item.patientId !== patientId);
      treatmentPlans = treatmentPlans.filter((item) => Number(item.patientId) !== patientId);
      consentRecords = consentRecords.filter((item) => Number(item.patientId) !== patientId);
      treatments = treatments.filter((item) => Number(item.patientId) !== patientId);
      communicationLog = communicationLog.filter((item) => Number(item.patientId) !== patientId);
      reminderDeliveries = reminderDeliveries.filter((item) => Number(item.patientId) !== patientId);
      delete state.treatmentHistory[patientId];
      delete state.patientMedia[patientId];
      saveData(); renderAll(); closeModal(); showToast("Hasta ve bağlı kayıtları silindi."); return;
    }
    if (target.dataset.deleteAppointment) {
      const appointmentId = Number(target.dataset.deleteAppointment);
      if (!window.confirm("Bu randevu silinsin mi?")) return;
      const deletedAppointment = state.appointments.find((item) => item.id === appointmentId);
      const deletedAppointmentSnapshot = deletedAppointment ? JSON.parse(JSON.stringify(deletedAppointment)) : null;
      if (deletedAppointment?.status === "COMPLETED") { applyLocalStockForAppointment(deletedAppointment, "CANCELLED"); deletedAppointment.status = "CANCELLED"; }
      if (deletedAppointmentSnapshot) moveToTrash("appointment", `${patientById(deletedAppointmentSnapshot.patientId)?.name || "Hasta"} randevusu`, deletedAppointmentSnapshot);
      if (deletedAppointment) queueDelete("APPOINTMENT", appointmentId);
      state.appointments = state.appointments.filter((item) => item.id !== appointmentId);
      reminderDeliveries = reminderDeliveries.filter((item) => String(item.appointmentId) !== String(appointmentId));
      if (deletedAppointment) state.treatmentHistory[deletedAppointment.patientId] = (state.treatmentHistory[deletedAppointment.patientId] || []).filter((item) => Number(item.appointmentId) !== appointmentId);
      saveData(); renderAll(); closeModal(); showToast("Randevu silindi."); return;
    }
    if (target.dataset.deleteStockRecipe) {
      const recipeId = Number(target.dataset.deleteStockRecipe);
      const recipe = stockRecipes.find((item) => Number(item.id) === recipeId);
      if (!recipe || !window.confirm("Bu tedavi reçetesi silinsin mi?")) return;
      queueDelete("STOCK_RECIPE", recipe.id);
      stockRecipes = stockRecipes.filter((item) => Number(item.id) !== recipeId);
      saveData(); renderStocks(); showToast("Tedavi reçetesi silindi."); return;
    }
    if (target.dataset.deleteStockOffer) {
      const stockId = Number(target.dataset.stockId);
      const offerId = Number(target.dataset.deleteStockOffer);
      const stockItem = stockItems.find((item) => Number(item.id) === stockId);
      const offer = stockItem?.offers?.find((item) => Number(item.id) === offerId);
      if (!stockItem || !offer || !window.confirm(`${offer.seller} satın alma fiyatı silinsin mi?`)) return;
      moveToTrash("stockOffer", `${stockItem.name} · ${offer.seller} fiyatı`, { stockId, offer });
      stockItem.offers = stockItem.offers.filter((item) => Number(item.id) !== offerId);
      queueDelete("STOCK_OFFER", offerId);
      saveData(); openStockDetail(stockId); showToast("Satın alma fiyatı silindi."); return;
    }
    if (target.dataset.deleteTransaction) {
      const transactionId = Number(target.dataset.deleteTransaction);
      const patientId = Number(target.dataset.patientId);
      if (!window.confirm("Bu finans kaydı silinsin mi?")) return;
      const deletedTransaction = state.transactions.find((item) => item.id === transactionId);
      if (deletedTransaction) moveToTrash("transaction", `${deletedTransaction.name} · ${deletedTransaction.detail}`, deletedTransaction);
      if (deletedTransaction) queueDelete("PAYMENT", transactionId);
      state.transactions = state.transactions.filter((item) => item.id !== transactionId);
      saveData(); renderAll();
      if (patientId && patientById(patientId)) openPatientDetail(patientId); else closeModal();
      showToast("Finans kaydı silindi."); return;
    }
    if (target.dataset.deleteTreatment !== undefined) {
      const patientId = Number(target.dataset.patientId);
      const index = Number(target.dataset.deleteTreatment);
      if (!window.confirm("Bu tedavi geçmişi kaydı silinsin mi?")) return;
      const deletedTreatment = (state.treatmentHistory[patientId] || [])[index];
      const syncedTreatmentRecord = deletedTreatment?.id ? treatments.find((item) => Number(item.id) === Number(deletedTreatment.id)) : null;
      const deletedTreatmentPayload = deletedTreatment ? JSON.parse(JSON.stringify({ patientId, index, item: deletedTreatment, treatmentRecord: syncedTreatmentRecord })) : null;
      if (syncedTreatmentRecord?.status === "COMPLETED") applyLocalStockForTreatment(syncedTreatmentRecord, "CANCELLED");
      if (deletedTreatmentPayload) moveToTrash("treatmentHistory", `${patientById(patientId)?.name || "Hasta"} · ${deletedTreatment.treatment}`, deletedTreatmentPayload);
      state.treatmentHistory[patientId] = (state.treatmentHistory[patientId] || []).filter((_, itemIndex) => itemIndex !== index);
      if (deletedTreatment?.id) { treatments = treatments.filter((item) => Number(item.id) !== Number(deletedTreatment.id)); queueDelete("TREATMENT", deletedTreatment.id); }
      saveData(); openPatientDetail(patientId); showToast("Tedavi kaydı silindi."); return;
    }
    if (target.dataset.deleteMedia) {
      const patientId = Number(target.dataset.patientId);
      const mediaId = Number(target.dataset.deleteMedia);
      if (!window.confirm("Bu fotoğraf silinsin mi?")) return;
      const deletedMedia = (state.patientMedia[patientId] || []).find((item) => item.id === mediaId);
      if (deletedMedia) moveToTrash("media", `${patientById(patientId)?.name || "Hasta"} · ${deletedMedia.kind} fotoğrafı`, { patientId, item: deletedMedia });
      state.patientMedia[patientId] = (state.patientMedia[patientId] || []).filter((item) => item.id !== mediaId);
      saveData(); openPatientDetail(patientId); showToast("Fotoğraf silindi."); return;
    }
    if (target.dataset.deleteDoctor) {
      const id = Number(target.dataset.deleteDoctor);
      const doctor = clinicDoctors.find((item) => Number(item.id) === id);
      const activeAppointments = doctor ? state.appointments.filter((item) => item.doctor === doctor.name && item.date >= todayIso && !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status)) : [];
      if (activeAppointments.length) return showToast(`${doctor.name} için ${activeAppointments.length} aktif randevu var. Önce randevuları başka hekime aktarın.`);
      if (!doctor || !window.confirm(`${doctor.name} doktor listesinden silinsin mi? Geçmiş kayıtlar korunur.`)) return;
      clinicDoctors = clinicDoctors.filter((item) => Number(item.id) !== id);
      queueDelete("DOCTOR", id);
      saveData(); openClinicManagement(); showToast("Doktor silindi."); return;
    }
    if (target.dataset.deleteChair) {
      const chair = target.dataset.deleteChair;
      const activeAppointments = state.appointments.filter((item) => item.room === chair && item.date >= todayIso && !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status));
      if (activeAppointments.length) return showToast(`${chair} için ${activeAppointments.length} aktif randevu var. Önce randevuları başka koltuğa aktarın.`);
      if (!window.confirm(`${chair} silinsin mi? Geçmiş randevular korunur.`)) return;
      clinicChairs = clinicChairs.filter((item) => item !== chair);
      queueUpdate("CLINIC_CONFIG", "clinic", clinicConfigPayload());
      saveData(); openClinicManagement(); showToast("Koltuk silindi."); return;
    }
    if (target.dataset.editPatient) return openEditPatient(target.dataset.editPatient);
    if (target.dataset.patientReport) return openPatientReport(target.dataset.patientReport);
    if (target.dataset.patient) return openPatientDetail(target.dataset.patient);
    if (target.dataset.appointment) return openAppointmentDetail(target.dataset.appointment);
    if (target.dataset.treatmentPlan) return openTreatmentPlanDetail(target.dataset.treatmentPlan);
    if (target.dataset.stockItem) return openStockDetail(target.dataset.stockItem);
    if (target.dataset.module) return openModule(target.dataset.module);
    if (target.dataset.transactionFilter) {
      state.transactionFilter = target.dataset.transactionFilter;
      closeModal(); navigate("finance"); showToast("Finans filtresi uygulandı."); return;
    }
    if (target.hasAttribute("data-close-modal")) return closeModal();
    if (target.dataset.saveAppointment) {
      const appointment = state.appointments.find((item) => item.id === Number(target.dataset.saveAppointment));
      if (!appointment) return;
      const nextStatus = $("#appointmentStatus").value;
      const previousStatus = appointment.status;
      if (ACTIVE_APPOINTMENT_STATUSES.has(nextStatus)) {
        const validationError = appointmentValidationError(appointment);
        if (validationError) return showToast(validationError);
        const conflict = appointmentConflict({ ...appointment, status: nextStatus }, appointment.id);
        if (conflict) return showToast(appointmentConflictMessage(conflict));
      }
      const stockResult = applyLocalStockForAppointment(appointment, nextStatus);
      if (!stockResult.ok) return showToast(stockResult.message);
      appointment.status = nextStatus;
      if (nextStatus === "COMPLETED" && previousStatus !== "COMPLETED") {
        const patient = patientById(appointment.patientId);
        (state.treatmentHistory[appointment.patientId] ||= []).unshift({ appointmentId: appointment.id, date: new Intl.DateTimeFormat("tr-TR", { timeZone: CLINIC_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(today), treatment: appointment.treatment, doctor: appointment.doctor, note: `${appointment.duration} dakikalık randevu tamamlandı.${appointment.stockUsage?.length ? " Malzeme reçetesi stoktan işlendi." : ""}` });
        if (patient) patient.lastVisit = "Bugün";
      }
      if (previousStatus === "COMPLETED" && nextStatus !== "COMPLETED") state.treatmentHistory[appointment.patientId] = (state.treatmentHistory[appointment.patientId] || []).filter((item) => Number(item.appointmentId) !== Number(appointment.id));
      queueUpdate("APPOINTMENT", appointment.id, appointmentPayload(appointment));
      saveData(); processAppointmentReminders(); renderAll(); closeModal(); showToast(stockResult.message); return;
    }
    if (target.hasAttribute("data-clear-local")) {
      if (!window.confirm("Bu cihazdaki tüm yerel klinik kayıtları ve bekleyen eşitleme işlemleri silinsin mi?")) return;
      state.patients = []; state.appointments = []; state.transactions = []; state.treatmentHistory = {}; state.patientMedia = {};
      treatmentPlans = []; stockItems = []; stockRecipes = []; communicationLog = []; consentRecords = []; treatments = []; staffRecords = []; surveys = []; surveyResponses = []; recalls = []; reminderDeliveries = []; reminderSettings = { ...defaultReminderSettings }; trashItems = []; dailyTodoCompletions = {};
      syncQueue = []; syncMap = {}; storage.set("clinicnova.syncBootstrapComplete", true);
      saveData(); persistSyncState(); renderAll(); closeModal(); showToast("Yerel kayıtlar temizlendi."); return;
    }
    if (target.hasAttribute("data-reset-demo")) {
      state.patients = JSON.parse(JSON.stringify(defaultPatients));
      state.appointments = JSON.parse(JSON.stringify(defaultAppointments));
      state.transactions = JSON.parse(JSON.stringify(defaultTransactions));
      state.treatmentHistory = JSON.parse(JSON.stringify(defaultTreatmentHistory));
      state.patientMedia = {};
      treatmentPlans = JSON.parse(JSON.stringify(defaultTreatmentPlans));
      stockItems = JSON.parse(JSON.stringify(defaultStockItems));
      communicationLog = JSON.parse(JSON.stringify(defaultCommunicationLog));
      consentRecords = JSON.parse(JSON.stringify(defaultConsentRecords));
      treatments = []; staffRecords = []; surveys = []; surveyResponses = []; recalls = []; reminderDeliveries = []; reminderSettings = { ...defaultReminderSettings };
      trashItems = []; dailyTodoCompletions = {};
      state.transactionFilter = "ALL";
      state.consentFilter = "ALL";
      if (!previewMode) storage.set("clinicnova.notificationsRead", false);
      $("#notificationDot").hidden = false;
      saveData(); renderAll(); closeModal(); showToast("Demo verileri sıfırlandı."); return;
    }
    const action = target.dataset.action;
    if (action === "add-manual-todo") { closeModal(); return openAddManualTodo(); }
    if (action === "add-calendar-note") { closeModal(); return openAddCalendarNote(target.dataset.noteDate); }
    if (action === "add-patient") { closeModal(); return openAddPatient(); }
    if (action === "add-appointment") { closeModal(); return openAddAppointment(target.dataset.patientPrefill); }
    if (action === "add-payment") { closeModal(); return openAddPayment(target.dataset.patientPrefill); }
    if (action === "add-expense") { closeModal(); return openAddExpense(); }
    if (action === "add-consent") { closeModal(); return openAddConsent(); }
    if (action === "add-stock-item") { closeModal(); return openAddStockItem(); }
    if (action === "add-treatment-plan") { closeModal(); return openAddTreatmentPlan(); }
    if (action === "stock-movement") { closeModal(); return openStockMovement(target.dataset.stockPrefill); }
    if (action === "add-stock-offer") { closeModal(); return openAddStockOffer(target.dataset.stockPrefill); }
    if (action === "add-stock-recipe") { closeModal(); return openAddStockRecipe(); }
    if (action === "add-treatment-history") return openAddTreatmentHistory(target.dataset.patientPrefill);
    if (action === "add-communication") return openAddCommunication();
    if (action === "add-treatment") return openAddTreatment();
    if (action === "add-staff") return openAddStaff();
    if (action === "clinic-management") return openClinicManagement();
    if (action === "mesh-sync") return openMeshSync();
    if (action === "mesh-create") {
      try {
        const clinicId = `clinic_${(crypto.randomUUID?.() || `${Date.now()}_${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, "")}`;
        const config = { clinicId, secret: randomSecret(32) };
        configureMesh(config); openMeshSync(); showToast("Şifreli klinik cihaz ağı oluşturuldu.");
      } catch (error) { showToast(error instanceof Error ? error.message : "Klinik ağı oluşturulamadı."); }
      return;
    }
    if (action === "mesh-sync-now") { window.ClinicNovaNative?.meshSyncNow?.(); meshStatus = "Yerel ağ taranıyor"; openMeshSync(); return; }
    if (action === "mesh-resolve") {
      try {
        const result = meshEngine?.resolveConflict(target.dataset.conflictKey, target.dataset.operationId);
        if (!result) throw new Error("Çakışma bulunamadı.");
        applyMeshDocument(result.document); persistMesh(); openMeshSync(); showToast("Seçilen kayıt sürümü tüm cihazlara uygulanmak üzere kaydedildi.");
      } catch (error) { showToast(error instanceof Error ? error.message : "Çakışma çözülemedi."); }
      return;
    }
    if (action === "mesh-disable") {
      if (!window.confirm("Bu cihaz klinik eşitleme ağından çıkarılsın mı? Yerel kayıtlar silinmez.")) return;
      if (typeof window.ClinicNovaNative?.meshDisable === "function" && window.ClinicNovaNative.meshDisable() === false) {
        warnPersistenceFailure(); showToast("Eşitleme ayarı güvenli cihaz kasasından silinemedi."); return;
      }
      storage.set("clinicnova.meshConfig", null); storage.set("clinicnova.meshState", null); storage.set("clinicnova.meshConflicts", []);
      meshEngine = null; meshConfig = null; meshStatus = "Yapılandırılmadı"; openMeshSync(); return;
    }
    if (action === "add-doctor") return openAddDoctor();
    if (action === "add-chair") return openAddChair();
    if (action === "rename-clinic") return openRenameClinic();
    if (action === "profile") return openProfile();
    if (action === "finance-report") return openFinanceReport();
    if (action === "transaction-filter") return openTransactionFilter();
    if (action === "connect") return openConnection();
    if (action === "security") return openSecurity();
    if (action === "logout") {
      if (previewMode) return window.location.reload();
      storage.set("clinicnova.session", null); storage.set("clinicnova.previewSession", null); closeModal(); showLogin(); showToast("Oturum kapatıldı."); return;
    }
  });

  const activeSwipes = new WeakMap();
  function resetSwipeRow(row) {
    row.classList.remove("swiping", "swipe-ready", "swipe-committing");
    row.style.removeProperty("--swipe-offset");
    activeSwipes.delete(row);
  }
  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".swipe-delete-trigger")) return;
    const row = event.target.closest(".swipe-delete");
    if (!row) return;
    activeSwipes.set(row, { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offset: 0, horizontal: false });
    row.classList.add("swiping");
  });
  document.addEventListener("pointermove", (event) => {
    const row = event.target.closest(".swipe-delete") || $$(".swipe-delete.swiping").find((candidate) => activeSwipes.get(candidate)?.pointerId === event.pointerId);
    const gesture = row && activeSwipes.get(row);
    if (!row || !gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX; const dy = event.clientY - gesture.startY;
    if (!gesture.horizontal && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { resetSwipeRow(row); return; }
    if (dx < -8 && Math.abs(dx) > Math.abs(dy)) gesture.horizontal = true;
    if (!gesture.horizontal) return;
    event.preventDefault();
    gesture.offset = Math.max(-112, Math.min(0, dx));
    row.style.setProperty("--swipe-offset", `${gesture.offset}px`);
    row.classList.toggle("swipe-ready", gesture.offset <= -72);
  }, { passive: false });
  function finishSwipe(event) {
    const row = $$(".swipe-delete.swiping").find((candidate) => activeSwipes.get(candidate)?.pointerId === event.pointerId);
    const gesture = row && activeSwipes.get(row);
    if (!row || !gesture) return;
    if (gesture.horizontal) {
      row.dataset.suppressSwipeClick = "true";
      setTimeout(() => { if (row.isConnected) delete row.dataset.suppressSwipeClick; }, 350);
    }
    if (gesture.offset <= -72) {
      row.classList.add("swipe-committing");
      row.querySelector(".swipe-delete-trigger")?.click();
      setTimeout(() => { if (row.isConnected) resetSwipeRow(row); }, 280);
    } else resetSwipeRow(row);
  }
  document.addEventListener("pointerup", finishSwipe);
  document.addEventListener("pointercancel", finishSwipe);
  document.addEventListener("click", (event) => {
    const row = event.target.closest(".swipe-delete[data-suppress-swipe-click]");
    if (row && !event.target.closest(".swipe-delete-trigger")) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Delete" || event.target.closest("input, textarea, select")) return;
    const row = event.target.closest(".swipe-delete");
    if (!row) return;
    event.preventDefault(); row.querySelector(".swipe-delete-trigger")?.click();
  });

  $("#patientSearch").addEventListener("input", (event) => { state.patientQuery = event.target.value; renderPatients(); });
  document.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-patient-media]");
    if (!input || !input.files?.[0]) return;
    const file = input.files[0];
    if (!file.type.startsWith("image/")) return showToast("Lütfen bir fotoğraf seçin.");
    const patientId = Number(input.dataset.patientMedia);
    try {
      const dataUrl = await imageFileData(file);
      if (!patientById(patientId)) return showToast("Fotoğrafın ekleneceği hasta bulunamadı.");
      const items = state.patientMedia[patientId] || [];
      items.unshift({ id: nextLocalId(), kind: input.dataset.mediaKind || "Fotoğraf", date: "Şimdi", dataUrl });
      state.patientMedia[patientId] = items.slice(0, 8);
      saveData();
      openPatientDetail(patientId);
      showToast(`${input.dataset.mediaKind || "Fotoğraf"} fotoğrafı eklendi.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Fotoğraf okunamadı.");
    } finally {
      cleanupNativeCameraCaptures();
    }
  });
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeModal(); });
  $("#notificationButton").addEventListener("click", openNotifications);
  $("#themeButton").addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    storage.set("clinicnova.theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
  });
  window.addEventListener("online", () => { updateNetworkBadge(); syncPending(); processAppointmentReminders(); });
  window.addEventListener("offline", updateNetworkBadge);
  document.addEventListener("keydown", (event) => {
    if ($("#modalBackdrop").hidden) return;
    if (event.key === "Escape") return closeModal();
    if (event.key !== "Tab") return;
    const focusable = $$("#modalBackdrop button:not([disabled]), #modalBackdrop a[href], #modalBackdrop input:not([disabled]), #modalBackdrop select:not([disabled]), #modalBackdrop textarea:not([disabled])").filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  document.addEventListener("submit", async (event) => {
    const textLimitError = formTextLimitError(event.target);
    if (textLimitError) { event.preventDefault(); showToast(textLimitError); return; }
    if (event.target.id === "patientEditForm") {
      event.preventDefault(); const form = new FormData(event.target); const patient = patientById(form.get("patientId")); if (!patient) return showToast("Hasta bulunamadı.");
      const name = String(form.get("name") || "").trim(); const phone = String(form.get("phone") || "").trim(); const email = String(form.get("email") || "").trim().toLowerCase(); const birthDate = String(form.get("birthDate") || "");
      if (name.length < 2 || phone.replace(/\D/g, "").length < 8 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return showToast("Hasta adı, telefon ve e-posta bilgilerini kontrol edin.");
      if (birthDate && (!calendarDate(birthDate) || birthDate > todayIso)) return showToast("Doğum tarihini kontrol edin.");
      Object.assign(patient, { name, phone, email, nationalId: String(form.get("nationalId") || "").trim(), birthDate, gender: String(form.get("gender") || "UNSPECIFIED"), address: String(form.get("address") || "").trim(), allergies: String(form.get("allergies") || "").trim(), chronicDiseases: String(form.get("chronicDiseases") || "").trim(), medications: String(form.get("medications") || "").trim(), tag: String(form.get("tag") || "NEW"), treatment: String(form.get("treatment") || "").trim(), note: String(form.get("note") || "").trim() });
      queueUpdate("PATIENT", patient.id, patientPayload(patient)); saveData(); processAppointmentReminders(); renderAll(); openPatientDetail(patient.id); showToast("Hasta bilgileri güncellendi."); return;
    }
    if (event.target.id === "treatmentProgressForm") {
      event.preventDefault(); const form = new FormData(event.target);
      const record = treatments.find((item) => Number(item.id) === Number(form.get("treatmentId")));
      const progress = Math.trunc(Number(form.get("progress"))); const note = String(form.get("note") || "").trim();
      if (!record || record.status === "COMPLETED" || ![10, 25, 50, 75, 90].includes(progress) || note.length < 3) return showToast("Tedavi ilerleme bilgisini kontrol edin.");
      record.status = "STARTED"; record.progress = progress; record.progressHistory = safeArray(record.progressHistory);
      record.progressHistory.unshift({ id: nextLocalId(), progress, note, doctor: record.doctor, date: "Şimdi", createdAt: new Date().toISOString() });
      record.description = [record.description, note].filter(Boolean).join("\n").slice(0, 4000);
      syncCompletedTreatmentHistory(record); queueUpdate("TREATMENT", record.id, treatmentPayload(record)); saveData(); renderAll(); openTreatmentDetail(record.id); showToast("Tedavi ilerlemesi kaydedildi."); return;
    }
    if (event.target.id === "treatmentForm") {
      event.preventDefault(); const form = new FormData(event.target); const patient = patientById(form.get("patientId"));
      const requestedStatus = String(form.get("status") || "COMPLETED");
      const record = { id: nextLocalId(), patientId: patient?.id, patient: patient?.name || "", doctor: String(form.get("doctor") || ""), tooth: String(form.get("tooth") || ""), treatment: String(form.get("treatment") || "").trim(), description: String(form.get("description") || "").trim(), fee: Number(form.get("fee")), status: requestedStatus === "COMPLETED" ? "STARTED" : requestedStatus, date: String(form.get("date") || todayIso), branch: currentClinicName() };
      if (!patient || record.treatment.length < 2 || record.doctor.trim().length < 2 || record.doctor.length > 160 || !calendarDate(record.date) || !Number.isFinite(record.fee) || record.fee < 0 || record.fee > 100_000_000) return showToast("Tedavi bilgilerini kontrol edin.");
      try {
        [record.beforePhoto, record.afterPhoto] = await Promise.all([imageFileData(form.get("beforePhoto")), imageFileData(form.get("afterPhoto"))]);
      } catch (error) { return showToast(error instanceof Error ? error.message : "Fotoğraflar okunamadı."); }
      finally { cleanupNativeCameraCaptures(); }
      const stockResult = applyLocalStockForTreatment(record, requestedStatus);
      if (!stockResult.ok) return showToast(stockResult.message);
      record.status = requestedStatus;
      record.progress = requestedStatus === "COMPLETED" ? 100 : requestedStatus === "STARTED" ? 10 : 0;
      record.progressHistory = requestedStatus === "COMPLETED" ? [{ progress: 100, note: record.description || "Tedavi tamamlandı.", doctor: record.doctor, date: "Şimdi" }] : [];
      if (requestedStatus === "COMPLETED") record.completedAt = new Date().toISOString();
      treatments.unshift(record); syncCompletedTreatmentHistory(record); queueCreate("TREATMENT", record.id, treatmentPayload(record)); saveData(); openModule("Gerçekleşen tedaviler"); showToast(stockResult.message); return;
    }
    if (event.target.id === "staffForm") {
      event.preventDefault(); const form = new FormData(event.target); const record = { id: nextLocalId(), fullName: String(form.get("fullName") || "").trim(), roleLabel: String(form.get("roleLabel") || "").trim(), phone: String(form.get("phone") || "").trim(), email: String(form.get("email") || "").trim().toLowerCase(), workingHours: String(form.get("workingHours") || "").trim(), compensation: String(form.get("compensation") || "").trim(), active: form.get("active") === "on" };
      if (record.fullName.length < 2 || record.roleLabel.length < 2 || (record.email && !record.email.includes("@"))) return showToast("Personel bilgilerini kontrol edin.");
      staffRecords.unshift(record); queueCreate("STAFF", record.id, staffPayload(record)); saveData(); openModule("Personel"); showToast("Personel kaydedildi."); return;
    }
    if (event.target.id === "reminderSettingsForm") {
      event.preventDefault(); const form = new FormData(event.target);
      const enabled = form.get("enabled") === "on";
      const template = String(form.get("template") || "").trim();
      if (template.length < 10 || template.length > 1000) return showToast("Mesaj şablonu 10-1000 karakter olmalıdır.");
      const nextReminderSettings = { id: "clinic", enabled, weekEnabled: form.get("weekEnabled") === "on", dayEnabled: form.get("dayEnabled") === "on", template };
      if (enabled && !nextReminderSettings.weekEnabled && !nextReminderSettings.dayEnabled) return showToast("En az bir bildirim zamanı seçin.");
      reminderSettings = nextReminderSettings;
      if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch { /* Uygulama içi bildirim kullanılmaya devam eder. */ }
      }
      if (enabled && typeof window.ClinicNovaNative?.requestNotificationPermission === "function") window.ClinicNovaNative.requestNotificationPermission();
      saveData(); await processAppointmentReminders(); openReminderSettings(); showToast(enabled ? "Randevu mesajı bildirimleri açıldı." : "Randevu mesajı bildirimleri kapatıldı."); return;
    }
    if (event.target.id === "treatmentHistoryForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patient = patientById(form.get("patientId"));
      const treatment = String(form.get("treatment") || "").trim();
      const doctor = String(form.get("doctor") || "").trim();
      const note = String(form.get("note") || "").trim();
      const date = String(form.get("date") || todayIso);
      if (!patient || treatment.length < 2 || !doctor || note.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return showToast("Tedavi, tarih, hekim ve not bilgilerini kontrol edin.");
      const recordId = nextLocalId();
      const treatmentRecord = { id: recordId, patientId: patient.id, patient: patient.name, doctor, tooth: "", treatment, description: note, fee: 0, paymentPlan: null, status: "STARTED", date, branch: currentClinicName(), manual: true };
      const stockResult = applyLocalStockForTreatment(treatmentRecord, "COMPLETED");
      if (!stockResult.ok) return showToast(stockResult.message);
      treatmentRecord.status = "COMPLETED"; treatmentRecord.progress = 100; treatmentRecord.completedAt = new Date().toISOString();
      treatmentRecord.progressHistory = [{ progress: 100, note, doctor, date: "Şimdi" }];
      treatments.unshift(treatmentRecord); syncCompletedTreatmentHistory(treatmentRecord); queueCreate("TREATMENT", treatmentRecord.id, treatmentPayload(treatmentRecord));
      patient.lastVisit = date === todayIso ? "Bugün" : patient.lastVisit;
      saveData(); openPatientDetail(patient.id); showToast("Tedavi geçmişine kayıt eklendi."); return;
    }
    if (event.target.id === "communicationForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patientName = String(form.get("patient") || "").trim();
      const patient = state.patients.find((item) => item.name === patientName);
      const record = { id: nextLocalId(), patientId: patient?.id || null, patient: patientName, channel: String(form.get("channel") || "Klinik içi not"), status: String(form.get("status") || "Yerel taslak"), message: String(form.get("message") || "").trim(), date: "Şimdi" };
      if (record.patient.length < 2 || record.message.length < 3) return showToast("Kişi ve iletişim notunu kontrol edin.");
      communicationLog.unshift(record); queueCreate("COMMUNICATION", record.id, communicationPayload(record)); saveData(); openModule("İletişim"); showToast("İletişim kaydı eklendi."); return;
    }
    if (event.target.id === "manualTodoForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const title = String(form.get("title") || "").trim();
      const detail = String(form.get("detail") || "").trim();
      const icon = safeManualIcon(form.get("icon"));
      if (title.length < 2) return showToast("Yapılacak madde en az 2 karakter olmalıdır.");
      const cutoff = addCalendarDays(todayIso, -45);
      manualTodos = manualTodos.filter((item) => !/^\d{4}-\d{2}-\d{2}$/.test(String(item.day)) || item.day >= cutoff);
      manualTodos.push({ id: nextLocalId(), day: todayIso, title, detail, icon, done: false, createdAt: new Date().toISOString() });
      saveData(); closeModal(); renderDailyTodos(); showToast("Yapılacak listeye eklendi."); return;
    }
    if (event.target.id === "calendarNoteForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const date = String(form.get("date") || "");
      const text = String(form.get("text") || "").trim();
      const doctor = String(form.get("doctor") || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !calendarDate(date)) return showToast("Geçerli bir tarih seçin.");
      if (text.length < 2) return showToast("Not en az 2 karakter olmalıdır.");
      calendarNotes.push({ id: nextLocalId(), date, text, doctor, createdAt: new Date().toISOString() });
      state.organizerDate = date;
      const selected = calendarDate(date);
      if (selected) state.organizerMonth = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1, 12));
      saveData(); closeModal(); renderCalendarOrganizer(); showToast("Takvim notu eklendi."); return;
    }
    if (event.target.id === "balancePaymentForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const item = state.transactions.find((entry) => Number(entry.id) === Number(form.get("transactionId")));
      const amount = Number(form.get("amount"));
      const remaining = item ? outstandingAmount(item) : 0;
      if (!item || item.type === "expense" || !Number.isFinite(amount) || amount <= 0 || amount > remaining) return showToast("Tahsilat tutarını kalan bakiyeyi aşmayacak şekilde girin.");
      const method = String(form.get("method") || "Belirtilmedi");
      const note = String(form.get("note") || "Taksit tahsilatı").trim();
      allocateInstallmentPayment(item, amount);
      item.amount = Number(item.amount || 0) + amount;
      item.remainingAmount = Math.max(0, Number(item.totalAmount || item.amount) - item.amount);
      item.status = "PAID";
      item.isDeposit = item.isDeposit || item.remainingAmount > 0;
      item.paymentHistory = Array.isArray(item.paymentHistory) ? item.paymentHistory : [];
      item.paymentHistory.unshift({ id: nextLocalId(), amount, method, note, date: "Şimdi" });
      const linkedPlan = treatmentPlans.find((plan) => Number(plan.id) === Number(item.treatmentPlanId));
      if (linkedPlan) {
        linkedPlan.paid = Math.max(0, finiteNumber(linkedPlan.total) - item.remainingAmount);
        linkedPlan.paymentPlan = { ...safeObject(linkedPlan.paymentPlan), installments: safeArray(item.installments) };
        queueUpdate("TREATMENT_PLAN", linkedPlan.id, treatmentPlanPayload(linkedPlan));
      }
      queueUpdate("PAYMENT", item.id, paymentPayload(item));
      saveData(); renderAll(); openFinanceDetail(item.id); showToast(item.remainingAmount > 0 ? `${currency(amount)} tahsil edildi · ${currency(item.remainingAmount)} kaldı.` : "Ödeme planı tamamen tahsil edildi."); return;
    }
    if (event.target.id === "doctorForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const doctor = { id: nextLocalId(), name: String(form.get("name") || "").trim(), email: String(form.get("email") || "").trim().toLowerCase(), specialty: String(form.get("specialty") || "").trim() || "Diş hekimi" };
      if (doctor.name.length < 2 || !doctor.email.includes("@")) return showToast("Doktor adı ve e-posta adresini kontrol edin.");
      if (clinicDoctors.some((item) => item.email.toLocaleLowerCase("tr-TR") === doctor.email)) return showToast("Bu e-posta ile bir doktor zaten kayıtlı.");
      clinicDoctors.push(doctor); queueCreate("DOCTOR", doctor.id, doctorPayload(doctor)); saveData(); openClinicManagement(); showToast("Doktor kaydedildi."); return;
    }
    if (event.target.id === "chairForm") {
      event.preventDefault();
      const name = String(new FormData(event.target).get("name") || "").trim();
      if (name.length < 2) return showToast("Koltuk adını kontrol edin.");
      if (clinicChairs.some((chair) => chair.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) return showToast("Bu koltuk zaten kayıtlı.");
      clinicChairs.push(name); queueUpdate("CLINIC_CONFIG", "clinic", clinicConfigPayload()); saveData(); openClinicManagement(); showToast("Koltuk kaydedildi."); return;
    }
    if (event.target.id === "clinicNameForm") {
      event.preventDefault();
      const name = String(new FormData(event.target).get("name") || "").trim();
      if (name.length < 2 || name.length > 120) return showToast("Klinik adı 2-120 karakter olmalıdır.");
      if (previewMode) {
        previewClinicName = name; applyLocalIdentity(); saveData(); openClinicManagement(); showToast("Klinik adı inceleme oturumu için güncellendi."); return;
      }
      const account = localAccount() || {}; account.clinicName = name;
      if (!persistLocalAccount(account)) return showToast("Klinik adı cihazda saklanamadı.");
      applyLocalIdentity(account);
      queueUpdate("CLINIC_CONFIG", "clinic", clinicConfigPayload()); saveData(); openClinicManagement(); showToast("Klinik adı güncellendi."); return;
    }
    if (event.target.id === "recoveryForm") {
      event.preventDefault();
      const account = localAccount();
      const form = new FormData(event.target);
      const code = String(form.get("code") || "").replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
      const password = String(form.get("password") || "");
      if (!account || code.length !== 30 || password.length < 10) return showToast("Kurtarma kodunu ve en az 10 karakterli yeni parolayı kontrol edin.");
      try {
        const candidate = await deriveLocalSecret(code, account.recoverySalt, account.iterations);
        if (!secureEqual(candidate, account.recoveryHash)) return showToast("Kurtarma kodu geçersiz.");
        const nextCode = recoveryCode();
        account.passwordSalt = randomSecret();
        account.passwordHash = await deriveLocalSecret(password, account.passwordSalt, account.iterations);
        account.recoverySalt = randomSecret();
        account.recoveryHash = await deriveLocalSecret(nextCode.replaceAll("-", ""), account.recoverySalt, account.iterations);
        account.failures = 0; account.lockedUntil = 0;
        if (!persistLocalAccount(account)) return showToast("Yeni parola cihazda saklanamadı. Eski parola ve kurtarma kodu geçerliliğini koruyor.");
        openModal("HESAP KURTARMA", "Parola yenilendi", `<div class="modal-grid"><p class="modal-note">Eski kurtarma kodu iptal edildi. Yeni kodunuzu güvenli bir yere kaydedin:</p><p class="modal-note"><strong style="font-size:1.1rem;letter-spacing:.08em">${escapeHtml(nextCode)}</strong></p><button class="button button-primary" data-close-modal>Kaydettim</button></div>`);
        showToast("Yerel parola yenilendi.");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Parola yenilenemedi.");
      }
      return;
    }
    if (event.target.id === "patientForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patient = {
        id: nextLocalId(), name: String(form.get("name") || "").trim(), phone: String(form.get("phone") || "").trim(), email: String(form.get("email") || "").trim().toLowerCase(),
        nationalId: String(form.get("nationalId") || "").trim(), birthDate: String(form.get("birthDate") || ""), gender: String(form.get("gender") || "UNSPECIFIED"), address: String(form.get("address") || "").trim(), allergies: String(form.get("allergies") || "").trim(), chronicDiseases: String(form.get("chronicDiseases") || "").trim(), medications: String(form.get("medications") || "").trim(),
        tag: String(form.get("tag") || "NEW"), lastVisit: "Yeni kayıt", treatment: String(form.get("treatment") || "").trim() || "Muayene", note: String(form.get("note") || "").trim(), color: state.patients.length % palette.length
      };
      if (patient.name.length < 2 || patient.phone.replace(/\D/g, "").length < 8 || (patient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email))) return showToast("Hasta adı, telefon ve e-posta bilgilerini kontrol edin.");
      if (patient.birthDate && (!calendarDate(patient.birthDate) || patient.birthDate > todayIso)) return showToast("Doğum tarihini kontrol edin.");
      state.patients.unshift(patient);
      queueCreate("PATIENT", patient.id, patientPayload(patient));
      saveData(); renderAll(); closeModal(); navigate("patients"); showToast("Hasta başarıyla kaydedildi.");
    }
    if (event.target.id === "appointmentForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const appointment = {
        id: nextLocalId(), patientId: Number(form.get("patientId")), date: String(form.get("date") || ""), time: String(form.get("time") || ""), duration: Number(form.get("duration")),
        treatment: String(form.get("treatment") || "").trim(), doctor: String(form.get("doctor") || "").trim(), room: String(form.get("room") || "").trim(), status: "PLANNED"
      };
      const validationError = appointmentValidationError(appointment);
      if (validationError) return showToast(validationError);
      const conflict = appointmentConflict(appointment);
      if (conflict) return showToast(appointmentConflictMessage(conflict));
      state.appointments.push(appointment);
      queueCreate("APPOINTMENT", appointment.id, appointmentPayload(appointment));
      state.selectedDate = form.get("date");
      { const selected = calendarDate(state.selectedDate); if (selected) state.appointmentMonth = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1, 12)); }
      saveData(); processAppointmentReminders(); renderAll(); closeModal(); navigate("appointments"); showToast("Randevu başarıyla oluşturuldu.");
    }
    if (event.target.id === "paymentForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patient = patientById(form.get("patientId"));
      const amount = Number(form.get("amount"));
      if (!patient || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return showToast("Hasta ve tutarı kontrol edin.");
      const components = [1, 2].map((index) => ({ name: String(form.get(`itemName${index}`) || "").trim(), amount: Number(form.get(`itemAmount${index}`) || 0) })).filter((item) => item.name && item.amount > 0);
      const totalAmount = components.reduce((sum, item) => sum + item.amount, 0);
      if (!components.length || totalAmount <= 0 || totalAmount > 100_000_000 || components.some((item) => item.amount > 100_000_000) || amount > totalAmount) return showToast("İşlem bedellerini ve alınan tutarı kontrol edin.");
      const installmentCount = Math.max(1, Number(form.get("installmentCount")) || 1);
      const remainingAmount = Math.max(0, totalAmount - amount);
      const paymentPlan = buildLocalPaymentPlan(totalAmount, amount, installmentCount, String(form.get("firstInstallmentDate") || todayIso), "");
      const payment = {
        id: nextLocalId(), patientId: patient.id, name: patient.name, detail: `${form.get("description").trim()} · ${form.get("method")}`,
        amount, totalAmount, remainingAmount, installmentCount, paidInstallments: remainingAmount === 0 ? installmentCount : 0,
        installments: paymentPlan.installments.map((item) => ({ ...item, paidAmount: remainingAmount === 0 ? item.amount : 0 })), firstInstallmentDate: paymentPlan.firstInstallmentDate,
        components, isDeposit: remainingAmount > 0 || form.get("isDeposit") === "on", type: "income", status: "PAID", date: "Şimdi", createdAt: new Date().toISOString()
      };
      state.transactions.unshift(payment);
      queueCreate("PAYMENT", payment.id, paymentPayload(payment));
      state.transactionFilter = "ALL";
      saveData(); renderAll(); closeModal(); navigate("finance"); showToast(remainingAmount > 0 ? `Ödeme kaydedildi · ${currency(remainingAmount)} bakiye kaldı.` : "Ödeme tamamen tahsil edildi.");
    }
    if (event.target.id === "expenseForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const amount = Number(form.get("amount"));
      const name = String(form.get("name") || "").trim();
      if (name.length < 2 || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return showToast("Gider başlığı ve tutarı kontrol edin.");
      const category = String(form.get("category") || "Diğer");
      const method = String(form.get("method") || "Belirtilmedi");
      const description = String(form.get("description") || "").trim();
      const expense = { id: nextLocalId(), patientId: null, name, category, method, detail: `${category} · ${method}${description ? ` · ${description}` : ""}`, amount, type: "expense", status: "PAID", date: "Şimdi" };
      state.transactions.unshift(expense); queueCreate("PAYMENT", expense.id, paymentPayload(expense)); state.transactionFilter = "ALL";
      saveData(); renderAll(); closeModal(); navigate("finance"); showToast("Gider finans kaydına eklendi.");
    }
    if (event.target.id === "consentForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patient = patientById(form.get("patientId"));
      if (!patient) return showToast("Hasta seçimini kontrol edin.");
      const status = String(form.get("status") || "Taslak");
      const consent = { id: nextLocalId(), patientId: patient.id, patient: patient.name, form: String(form.get("form") || "Genel tedavi onamı"), treatment: String(form.get("treatment") || "Genel tedavi").trim(), language: String(form.get("language") || "Türkçe"), channel: String(form.get("channel") || "Klinikte"), status, date: "Şimdi", signedAt: status === "İmzalandı" ? "Şimdi" : "", signer: status === "İmzalandı" ? patient.name : "", version: "v1", note: String(form.get("note") || "").trim(), history: [{ status, date: "Şimdi", note: "Onam kaydı oluşturuldu." }] };
      consentRecords.unshift(consent); state.consentFilter = "ALL";
      queueCreate("CONSENT", consent.id, consentPayload(consent));
      saveData(); renderAll(); closeModal(); navigate("consents"); showToast(status === "İmzalandı" ? "İmzalı onam kaydedildi." : "Onam kaydı oluşturuldu.");
    }
    if (event.target.id === "consentStatusForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const consent = consentRecords.find((item) => Number(item.id) === Number(form.get("consentId")));
      if (!consent) return showToast("Onam kaydı bulunamadı.");
      const nextStatus = String(form.get("status") || "");
      const actor = String(form.get("actor") || "").trim();
      const note = String(form.get("note") || "").trim();
      if (!actor || note.length < 3) return showToast("İşlem yapan kişi ve açıklamayı girin.");
      if (consent.status === "İmzalandı" && !["İmzalandı", "İptal edildi"].includes(nextStatus)) return showToast("İmzalı onam yalnızca iptal edilebilir.");
      if (consent.status === "İptal edildi") return showToast("İptal edilen onam değiştirilemez; yeni belge oluşturun.");
      if (nextStatus === consent.status) return showToast("Yeni durum mevcut durumla aynı.");
      consent.history = Array.isArray(consent.history) ? consent.history : [{ status: consent.status, date: consent.date, note: "Önceki kayıt" }];
      consent.status = nextStatus; consent.date = "Şimdi";
      consent.history.unshift({ status: nextStatus, date: "Şimdi", note: `${actor}: ${note}` });
      if (nextStatus === "İmzalandı") { consent.signer = actor; consent.signedAt = "Şimdi"; }
      if (nextStatus === "İptal edildi") consent.revokedBy = actor;
      queueUpdate("CONSENT", consent.id, consentPayload(consent));
      saveData(); renderConsents(); openConsentDetail(consent.id); showToast(`Onam durumu “${nextStatus}” olarak güncellendi.`);
    }
    if (event.target.id === "stockItemForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const item = { id: nextLocalId(), name: String(form.get("name") || "").trim(), category: String(form.get("category") || "").trim(), amount: Number(form.get("amount")), minimum: Number(form.get("minimum")), unit: String(form.get("unit") || "").trim(), supplier: String(form.get("supplier") || "").trim(), purchasePrice: Number(form.get("purchasePrice") || 0), movements: [], offers: [] };
      if (item.name.length < 2 || item.category.length < 2 || !item.unit || !Number.isInteger(item.amount) || item.amount < 0 || item.amount > 100_000_000 || !Number.isInteger(item.minimum) || item.minimum < 0 || item.minimum > 100_000_000 || !Number.isFinite(item.purchasePrice) || item.purchasePrice < 0 || item.purchasePrice > 100_000_000) return showToast("Ürün bilgilerini kontrol edin.");
      if (stockItems.some((entry) => entry.name.toLocaleLowerCase("tr-TR") === item.name.toLocaleLowerCase("tr-TR"))) return showToast("Bu ürün stokta zaten kayıtlı.");
      if (item.amount > 0) item.movements.unshift({ id: nextLocalId(), type: "IN", quantity: item.amount, note: "Açılış stoku", date: "Şimdi", createdAt: Date.now() });
      stockItems.unshift(item); queueCreate("STOCK_ITEM", item.id, stockItemPayload(item)); saveData(); renderAll(); closeModal(); navigate("stocks"); showToast("Yeni stok ürünü kaydedildi.");
    }
    if (event.target.id === "treatmentPlanForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patient = patientById(form.get("patientId"));
      const total = Number(form.get("total"));
      const paid = Number(form.get("paid"));
      if (!patient || !Number.isFinite(total) || total < 0 || total > 100_000_000 || !Number.isFinite(paid) || paid < 0 || paid > total) return showToast("Hasta ve ücret bilgilerini kontrol edin; ödeme toplam ücreti aşamaz.");
      const statusCode = String(form.get("status"));
      const status = ({ PROPOSED: "Önerildi", ACCEPTED: "Kabul edildi", STARTED: "Başladı", COMPLETED: "Tamamlandı", CANCELLED: "İptal" })[statusCode] || "Önerildi";
      const date = String(form.get("date"));
      const paymentPlan = buildLocalPaymentPlan(total, paid, form.get("installmentCount"), String(form.get("firstInstallmentDate") || todayIso), String(form.get("paymentPlanNote") || "").trim());
      const plan = { id: nextLocalId(), patientId: patient.id, patient: patient.name, treatment: String(form.get("treatment") || "").trim(), tooth: String(form.get("tooth") || "").trim(), doctor: String(form.get("doctor") || "").trim(), branch: String(form.get("branch") || "").trim(), date, plannedAt: formattedInstallmentDate(date), total, paid, paymentPlan, status, statusCode, note: String(form.get("note") || "").trim() };
      if (plan.treatment.length < 2 || !plan.doctor || !plan.branch) return showToast("Tedavi, hekim ve şube bilgilerini kontrol edin.");
      treatmentPlans.unshift(plan); queueCreate("TREATMENT_PLAN", plan.id, treatmentPlanPayload(plan));
      if (paid > 0) {
        const payment = { id: nextLocalId(), treatmentPlanId: plan.id, patientId: patient.id, name: patient.name, detail: `${plan.treatment} plan peşinatı · Nakit`, amount: paid, totalAmount: total, remainingAmount: Math.max(0, total - paid), installmentCount: paymentPlan.installmentCount, paidInstallments: total === paid ? paymentPlan.installmentCount : 0, installments: paymentPlan.installments.map((item) => ({ ...item, paidAmount: total === paid ? item.amount : 0 })), firstInstallmentDate: paymentPlan.firstInstallmentDate, components: [{ name: plan.treatment, amount: total }], isDeposit: true, type: "income", status: "PAID", date: "Şimdi", createdAt: new Date().toISOString() };
        state.transactions.unshift(payment); queueCreate("PAYMENT", payment.id, paymentPayload(payment));
      }
      saveData(); renderAll(); closeModal(); navigate("treatment-plans"); showToast("Tedavi planı kaydedildi.");
    }
    if (event.target.id === "stockMovementForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const item = stockItems.find((entry) => Number(entry.id) === Number(form.get("itemId")));
      const type = String(form.get("type"));
      const quantity = Number(form.get("quantity"));
      if (!item || !Number.isInteger(quantity) || quantity < 0 || quantity > 100_000_000 || (type !== "ADJUSTMENT" && quantity === 0)) return showToast("Ürün ve miktarı kontrol edin.");
      if (type === "OUT" && quantity > Number(item.amount)) return showToast(`Stok yetersiz. Mevcut: ${item.amount} ${item.unit}.`);
      item.amount = type === "IN" ? Number(item.amount) + quantity : type === "OUT" ? Number(item.amount) - quantity : quantity;
      const movement = { id: nextLocalId(), itemId: item.id, type, quantity, note: String(form.get("note") || "").trim() || (type === "IN" ? "Stok girişi" : type === "OUT" ? "Stok çıkışı" : "Sayım düzeltmesi"), date: "Şimdi", createdAt: Date.now() };
      (item.movements ||= []).unshift(movement);
      queueCreate("STOCK_MOVEMENT", movement.id, { itemId: String(item.id), type, quantity, note: movement.note });
      saveData(); renderAll(); closeModal(); navigate("stocks"); showToast("Stok miktarı güncellendi.");
    }
    if (event.target.id === "stockRecipeForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const recipe = { id: nextLocalId(), treatmentType: String(form.get("treatmentType") || "").trim(), itemId: Number(form.get("itemId")), quantity: Number(form.get("quantity")) };
      if (recipe.treatmentType.length < 2 || !stockItems.some((item) => Number(item.id) === recipe.itemId) || !Number.isInteger(recipe.quantity) || recipe.quantity < 1 || recipe.quantity > 100_000) return showToast("Tedavi, malzeme ve miktarı kontrol edin.");
      const existing = stockRecipes.find((item) => treatmentKey(item.treatmentType) === treatmentKey(recipe.treatmentType) && Number(item.itemId) === recipe.itemId);
      if (existing) {
        existing.treatmentType = recipe.treatmentType; existing.quantity = recipe.quantity;
        queueUpdate("STOCK_RECIPE", existing.id, stockRecipePayload(existing));
      } else {
        stockRecipes.unshift(recipe); queueCreate("STOCK_RECIPE", recipe.id, stockRecipePayload(recipe));
      }
      saveData(); renderAll(); closeModal(); navigate("stocks"); showToast("Tedavi reçetesi kaydedildi.");
    }
    if (event.target.id === "stockOfferForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const item = stockItems.find((entry) => Number(entry.id) === Number(form.get("itemId")));
      const productUrl = String(form.get("productUrl") || "").trim();
      if (!item || !productUrl.startsWith("https://")) return showToast("Geçerli bir HTTPS satın alma sayfası girin.");
      closeModal(); refreshOnlineOffers(item.id, productUrl);
    }
    if (event.target.id === "connectionForm") {
      event.preventDefault();
      const url = new FormData(event.target).get("url").trim().replace(/\/$/, "");
      connectToServer(url);
    }
    if (event.target.id === "meshJoinForm") {
      event.preventDefault();
      try {
        const config = parseMeshPairingCode(new FormData(event.target).get("code"));
        configureMesh(config); openMeshSync(); showToast("Cihaz klinik ağına katıldı; eşler aranıyor.");
      } catch (error) { showToast(error instanceof Error ? error.message : "Eşleştirme kodu geçersiz."); }
    }
  });

  window.ClinicNovaDateUtils = Object.freeze({ localDate, calendarDateKey, addCalendarDays, addCalendarMonthsClamped, daysUntil, buildLocalPaymentPlan, refreshClinicClock });
  purgeExpiredTrash();
  queueExistingLocalRecords();
  initializeMesh();
  setTimeout(processAppointmentReminders, 2500);
  setInterval(processAppointmentReminders, 60_000);
  applyFormTextLimits(document);
  configureEntryMode();
  if (storage.get("clinicnova.theme", "light") === "dark") document.documentElement.classList.add("dark");
  $("#notificationDot").hidden = storage.get("clinicnova.notificationsRead", false) && !reminderDeliveries.some((item) => item.status === "READY");
  window.ClinicNovaBack = () => {
    if (!$("#modalBackdrop").hidden) {
      closeModal();
      return true;
    }
    if (!$("#appShell").hidden && state.activeView !== "home") {
      navigate("home");
      return true;
    }
    return false;
  };
  updateNetworkBadge();
  if (demoMode && mobileConfig.autoOpenDemo) {
    storage.set("clinicnova.previewSession", { createdAt: Date.now(), source: "ios-file-demo" });
    showApp();
  } else if (demoMode && (storage.get("clinicnova.session", null) || storage.get("clinicnova.previewSession", null))) showApp(); else showLogin();
  let backgroundedAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { backgroundedAt = Date.now(); return; }
    if (!demoMode && authenticatedThisRun && backgroundedAt && Date.now() - backgroundedAt >= 5 * 60_000) {
      closeModal(); showLogin(); showToast("Güvenlik için yerel oturum kilitlendi.");
    }
    backgroundedAt = 0;
    processAppointmentReminders();
  });
  if (new URLSearchParams(window.location.search).has("sync")) setTimeout(() => syncPending(true), 500);
  else setTimeout(syncPending, 1500);
})();
