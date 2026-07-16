(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const mobileConfig = window.CLINICNOVA_MOBILE_CONFIG || { mode: "production", serverUrl: "" };
  const demoMode = mobileConfig.mode === "demo";
  const storage = {
    get(key, fallback) {
      try {
        const value = window.ClinicNovaNative?.storage?.getItem(key) ?? localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch { return fallback; }
    },
    set(key, value) {
      try {
        const serialized = JSON.stringify(value);
        if (window.ClinicNovaNative?.storage) window.ClinicNovaNative.storage.setItem(key, serialized);
        else localStorage.setItem(key, serialized);
      } catch { /* Platform storage can be unavailable when the OS keychain is locked. */ }
    }
  };

  const today = new Date();
  const todayIso = localDate(today);
  const tomorrowIso = localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
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
    { id: 1, patientId: 1, name: "Ayşe Yılmaz", detail: "İmplant · Kart", amount: 18500, totalAmount: 42000, remainingAmount: 23500, installmentCount: 4, paidInstallments: 1, components: [{ name: "İmplant", amount: 36000 }, { name: "Cerrahi işlem", amount: 6000 }], type: "income", status: "PENDING", date: "Bugün, 11:24" },
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
  const defaultHotLeads = [
    { id: 1, name: "John Smith", country: "Birleşik Krallık", treatment: "İmplant + otel", score: 94, phone: "+44 700 000 1000" },
    { id: 2, name: "Emily Carter", country: "Birleşik Krallık", treatment: "Hollywood Smile", score: 88, phone: "+44 700 000 1001" },
    { id: 3, name: "Lukas Weber", country: "Almanya", treatment: "Zirkonyum kaplama", score: 82, phone: "+49 700 000 1002" }
  ];
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
    { id: 3, patient: "Emily Carter", channel: "E-posta", message: "Your treatment package is ready for review.", status: "Demo taslak" }
  ];
  const defaultConsentRecords = [
    { id: 1, patientId: 1, patient: "Ayşe Yılmaz", form: "İmplant aydınlatılmış onamı", treatment: "İmplant", language: "Türkçe", channel: "Tablet", status: "İmzalandı", date: "Bugün, 09:12", signedAt: "Bugün, 09:12", signer: "Ayşe Yılmaz", version: "v2", note: "Cerrahi işlem öncesi klinikte imzalandı." },
    { id: 2, patientId: 2, patient: "Mehmet Demir", form: "Kanal tedavisi onamı", treatment: "Kanal tedavisi", language: "Türkçe", channel: "SMS bağlantısı", status: "İmzalandı", date: "Dün, 15:40", signedAt: "Dün, 15:40", signer: "Mehmet Demir", version: "v1", note: "İkinci seans öncesi onaylandı." },
    { id: 3, patientId: null, patient: "Emily Carter", form: "International treatment consent", treatment: "Health Tourism", language: "English", channel: "E-posta bağlantısı", status: "İmza bekliyor", date: "10 Temmuz", signedAt: "", signer: "", version: "v1", note: "Treatment package and travel timing shared." },
    { id: 4, patientId: 5, patient: "Zeynep Çelik", form: "Kişisel veri ve görüntü kullanım onamı", treatment: "Genel", language: "Türkçe", channel: "Klinikte", status: "Taslak", date: "Bugün", signedAt: "", signer: "", version: "v1", note: "Hasta kontrol randevusunda inceleyecek." }
  ];
  const modules = [
    { name: "Finans", detail: "Tahsilat, peşinat ve giderler", icon: "i-wallet", color: "#16845b" },
    { name: "Gerçekleşen tedaviler", detail: "Klinik işlem ve ücret kayıtları", icon: "i-tooth", color: "#276aa8" },
    { name: "Personel", detail: "Ekip, çalışma ve hakediş", icon: "i-users", color: "#16845b" },
    { name: "Sağlık turizmi", detail: "Lead ve paket yönetimi", icon: "i-plane", color: "#ed6b3a" },
    { name: "İletişim", detail: "WhatsApp, SMS, e-posta", icon: "i-message", color: "#7257b7" },
    { name: "Anketler", detail: "Memnuniyet ve yanıtlar", icon: "i-chart", color: "#b76b12" },
    { name: "Recall", detail: "Hasta takip ve geri çağırma", icon: "i-calendar", color: "#a64458" },
    { name: "Tam web paneli", detail: "Tüm gelişmiş ve yönetim özellikleri", icon: "i-grid", color: "#276aa8" },
    { name: "Raporlar", detail: "Gelir ve performans", icon: "i-chart", color: "#b76b12" },
    { name: "Dijital onam", detail: "Onam ve imza kayıtları", icon: "i-shield", color: "#16845b" },
    { name: "Çöp Kutusu", detail: "30 gün saklanan silinmiş kayıtlar", icon: "i-box", color: "#a64458" }
  ];

  const localDataWasMigrated = storage.get("clinicnova.localDataMigrated", false);
  function localCollection(key, demoDefaults) {
    const stored = storage.get(key, null);
    if (demoMode) return stored ?? JSON.parse(JSON.stringify(demoDefaults));
    if (!Array.isArray(stored)) return [];
    if (localDataWasMigrated) return stored;
    return stored.filter((item) => Number(item?.id) > 1_000_000_000_000);
  }

  let hotLeads = localCollection("clinicnova.hotLeads", defaultHotLeads);
  let treatmentPlans = localCollection("clinicnova.treatmentPlans", defaultTreatmentPlans);
  let stockItems = localCollection("clinicnova.stockItems", defaultStockItems);
  let stockRecipes = localCollection("clinicnova.stockRecipes", defaultStockRecipes);
  let clinicDoctors = localCollection("clinicnova.clinicDoctors", defaultClinicDoctors);
  let clinicChairs = storage.get("clinicnova.clinicChairs", demoMode ? defaultClinicChairs : []);
  let communicationLog = localCollection("clinicnova.communicationLog", defaultCommunicationLog);
  let consentRecords = localCollection("clinicnova.consentRecords", defaultConsentRecords);
  let treatments = localCollection("clinicnova.treatments", []);
  let staffRecords = localCollection("clinicnova.staff", []);
  let surveys = localCollection("clinicnova.surveys", []);
  let surveyResponses = localCollection("clinicnova.surveyResponses", []);
  let recalls = localCollection("clinicnova.recalls", []);
  let trashItems = demoMode || localDataWasMigrated ? storage.get("clinicnova.trashItems", []) : [];
  let legacyOfferId = Date.now();
  stockItems.forEach((item) => (item.offers ||= []).forEach((offer) => {
    if (!Number.isFinite(Number(offer.id))) offer.id = legacyOfferId++;
  }));

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
    appointmentMonth: new Date(today.getFullYear(), today.getMonth(), 1),
    activeView: "home"
  };
  if (!demoMode && !localDataWasMigrated) {
    const patientIds = new Set(state.patients.map((item) => String(item.id)));
    state.treatmentHistory = Object.fromEntries(Object.entries(state.treatmentHistory).filter(([id]) => patientIds.has(id)));
    state.patientMedia = Object.fromEntries(Object.entries(state.patientMedia).filter(([id]) => patientIds.has(id)));
  }
  storage.set("clinicnova.localDataMigrated", true);
  const deviceId = storage.get("clinicnova.deviceId", null) || (crypto.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  storage.set("clinicnova.deviceId", deviceId);
  let syncQueue = storage.get("clinicnova.syncQueue", []);
  let syncMap = storage.get("clinicnova.syncMap", {});
  let syncing = false;
  let syncTimer = null;
  let serverPermissions = storage.get("clinicnova.serverPermissions", null);
  if (demoMode) serverPermissions = null;
  let productSearchInFlight = false;
  let authenticatedThisRun = false;
  let previewMode = false;
  let previewClinicName = "İnceleme Kliniği";
  const LOCAL_AUTH_ITERATIONS = 210000;

  function localDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function currency(value) {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value);
  }
  function buildLocalPaymentPlan(total, downPayment, installmentCount, firstInstallmentDate, note) {
    const count = Math.max(1, Math.min(24, Number(installmentCount) || 1));
    const remaining = Math.max(0, Math.round((Number(total) - Number(downPayment)) * 100) / 100);
    const base = Math.floor((remaining / count) * 100) / 100;
    let allocated = 0;
    const start = new Date(`${firstInstallmentDate || todayIso}T12:00:00`);
    const installments = Array.from({ length: count }, (_, index) => {
      const date = new Date(start); date.setMonth(date.getMonth() + index);
      const amount = index === count - 1 ? Math.round((remaining - allocated) * 100) / 100 : base;
      allocated += amount;
      return { number: index + 1, dueDate: localDate(date), amount };
    });
    return { total: Number(total), downPayment: Number(downPayment), installmentCount: count, firstInstallmentDate: firstInstallmentDate || todayIso, installments, note: note || "" };
  }
  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toLocaleUpperCase("tr-TR")).join("");
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
      const result = window.ClinicNovaNative.hashSecret(secret, salt, iterations);
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
    return ({ PLANNED: "Planlandı", ARRIVED: "Geldi", COMPLETED: "Tamamlandı", PENDING_CONFIRMATION: "Onay bekliyor", CANCELLED: "İptal edildi", NO_SHOW: "Gelmedi" })[status] || status;
  }
  function saveData() {
    if (previewMode) return;
    storage.set("clinicnova.patients", state.patients);
    storage.set("clinicnova.appointments", state.appointments);
    storage.set("clinicnova.transactions", state.transactions);
    storage.set("clinicnova.treatmentHistory", state.treatmentHistory);
    storage.set("clinicnova.patientMedia", state.patientMedia);
    storage.set("clinicnova.hotLeads", hotLeads);
    storage.set("clinicnova.treatmentPlans", treatmentPlans);
    storage.set("clinicnova.stockItems", stockItems);
    storage.set("clinicnova.stockRecipes", stockRecipes);
    storage.set("clinicnova.clinicDoctors", clinicDoctors);
    storage.set("clinicnova.clinicChairs", clinicChairs);
    storage.set("clinicnova.communicationLog", communicationLog);
    storage.set("clinicnova.consentRecords", consentRecords);
    storage.set("clinicnova.treatments", treatments);
    storage.set("clinicnova.staff", staffRecords);
    storage.set("clinicnova.surveys", surveys);
    storage.set("clinicnova.surveyResponses", surveyResponses);
    storage.set("clinicnova.recalls", recalls);
    storage.set("clinicnova.trashItems", trashItems);
  }
  if (!demoMode && !localDataWasMigrated) saveData();

  function operationId() {
    return crypto.randomUUID?.() ?? `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function persistSyncState() {
    if (previewMode) return updateNetworkBadge();
    storage.set("clinicnova.syncQueue", syncQueue);
    storage.set("clinicnova.syncMap", syncMap);
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
    const permission = entityType === "PATIENT" ? "patients" : entityType === "APPOINTMENT" ? "appointments" : entityType === "PAYMENT" ? "finance" : ["TREATMENT_PLAN", "TREATMENT"].includes(entityType) ? "treatments" : entityType.startsWith("STOCK_") ? "stocks" : ["DOCTOR", "STAFF"].includes(entityType) ? "staff" : entityType === "CONSENT" ? "consents" : ["SURVEY", "SURVEY_RESPONSE"].includes(entityType) ? "surveys" : entityType === "COMMUNICATION" ? "communication" : entityType === "RECALL" ? "recalls" : entityType === "LEAD" ? "tourism" : "settings";
    return serverPermissions[permission] !== false;
  }

  function queueCreate(entityType, clientId, payload) {
    if (demoMode || previewMode) return;
    const id = String(clientId);
    const pendingDelete = syncQueue.some((item) => item.entityType === entityType && item.clientId === id && item.action === "DELETE");
    if (pendingDelete) syncQueue = syncQueue.filter((item) => !(item.entityType === entityType && item.clientId === id && item.action === "DELETE"));
    const pending = syncQueue.find((item) => item.entityType === entityType && item.clientId === id && item.action === "CREATE");
    if (pending) pending.payload = payload;
    else syncQueue.push({ operationId: operationId(), entityType, action: pendingDelete && syncMap[`${entityType}:${id}`] ? "UPDATE" : "CREATE", clientId: id, createdAt: new Date().toISOString(), payload });
    persistSyncState();
    scheduleSync();
  }

  function queueUpdate(entityType, clientId, payload) {
    if (demoMode || previewMode) return;
    const id = String(clientId);
    const pendingCreate = syncQueue.find((item) => item.entityType === entityType && item.clientId === id && item.action === "CREATE");
    if (pendingCreate) pendingCreate.payload = { ...pendingCreate.payload, ...payload };
    else syncQueue.push({ operationId: operationId(), entityType, action: "UPDATE", clientId: id, createdAt: new Date().toISOString(), payload });
    persistSyncState();
    scheduleSync();
  }

  function queueDelete(entityType, clientId, payload = {}) {
    if (demoMode || previewMode) return;
    const id = String(clientId);
    const hadPendingCreate = syncQueue.some((item) => item.entityType === entityType && item.clientId === id && item.action === "CREATE");
    syncQueue = syncQueue.filter((item) => !(item.entityType === entityType && item.clientId === id));
    if (!hadPendingCreate || syncMap[`${entityType}:${id}`]) syncQueue.push({ operationId: operationId(), entityType, action: "DELETE", clientId: id, createdAt: new Date().toISOString(), payload });
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
    return { patientId: payment.patientId ? String(payment.patientId) : undefined, type: payment.type === "expense" ? "EXPENSE" : "INCOME", status: payment.status || "PAID", amount: payment.amount, totalAmount: payment.totalAmount || payment.amount, remainingAmount: payment.type === "expense" ? 0 : outstandingAmount(payment), method, description: payment.detail, isDeposit: Boolean(payment.isDeposit), paidAt: payment.paidAt, dueDate: payment.dueDate, referralSource: payment.referralSource || "", discountAmount: payment.discountAmount || 0 };
  }

  function treatmentPayload(record) { return { patientId: String(record.patientId), doctor: record.doctor, toothNumber: record.tooth || "", treatmentType: record.treatment, description: record.description || "", fee: record.fee || 0, paymentPlan: record.paymentPlan || null, status: record.status || "COMPLETED", date: record.date || todayIso }; }
  function staffPayload(record) { return { fullName: record.fullName, roleLabel: record.roleLabel, phone: record.phone || "", email: record.email || "", workingHours: record.workingHours || "", compensation: record.compensation || "", active: record.active !== false }; }
  const consentStatusCode = (status) => ({ Taslak: "DRAFT", "İmza bekliyor": "SENT", İmzalandı: "SIGNED", "İptal edildi": "CANCELLED" })[status] || status || "DRAFT";
  const consentStatusLabel = (status) => ({ DRAFT: "Taslak", SENT: "İmza bekliyor", SIGNED: "İmzalandı", CANCELLED: "İptal edildi" })[status] || status || "Taslak";
  function consentPayload(record) { return { patientId: String(record.patientId), templateName: record.templateName || record.form, content: record.content || [record.treatment, record.note].filter(Boolean).join(" — ") || record.form, status: consentStatusCode(record.status) }; }
  function surveyPayload(record) { return { title: record.title, description: record.description || "", active: record.active !== false }; }
  function surveyResponsePayload(record) { return { surveyId: String(record.surveyId), patientId: String(record.patientId), score: record.score, comment: record.comment || "" }; }
  const communicationChannelCode = (channel) => ({ WhatsApp: "WHATSAPP", SMS: "SMS", "E-posta": "EMAIL", Telefon: "PHONE", "Klinik içi not": "IN_APP" })[channel] || channel || "IN_APP";
  const communicationStatusCode = (status) => ({ "Yerel taslak": "QUEUED", Arandı: "SENT", "Yanıt bekleniyor": "SENT", "Teslim edildi": "DELIVERED" })[status] || status || "QUEUED";
  function communicationPayload(record) { const patient = state.patients.find((item) => item.name === record.patient); return { patientId: record.patientId ? String(record.patientId) : patient ? String(patient.id) : undefined, channel: communicationChannelCode(record.channel), direction: record.direction || "OUTBOUND", subject: record.subject || "", source: record.source || "Android", contactName: record.patient || "", contactValue: record.contactValue || patient?.phone || "", message: record.message, status: communicationStatusCode(record.status) }; }
  function recallPayload(record) { return { patientId: String(record.patientId), reason: record.reason, dueDate: record.dueDate, status: record.status || "OPEN", notes: record.notes || "" }; }
  function leadPayload(record) { return { fullName: record.name, phone: record.phone || "", email: record.email || "", country: record.country, city: record.city || "", language: record.language || "EN", interestedTreatment: record.treatment, estimatedBudget: record.budget || "", message: record.message || `${record.treatment} için bilgi talebi`, sourceChannel: record.sourceChannel || "MANUAL", leadStatus: record.status || "NEW", leadScore: record.score ?? 50, gdprConsent: Boolean(record.gdprConsent), notes: record.notes || "" }; }

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
    surveys.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("SURVEY", item.id, surveyPayload(item)));
    surveyResponses.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("SURVEY_RESPONSE", item.id, surveyResponsePayload(item)));
    communicationLog.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("COMMUNICATION", item.id, communicationPayload(item)));
    recalls.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("RECALL", item.id, recallPayload(item)));
    hotLeads.filter((item) => Number(item.id) > 1_000_000_000_000).forEach((item) => queueCreate("LEAD", item.id, leadPayload(item)));
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

  function applyLocalStockForAppointment(appointment, nextStatus) {
    if (appointment.status === nextStatus) return { ok: true, message: "Randevu durumu güncellendi." };
    if (nextStatus === "COMPLETED") {
      const recipes = stockRecipes.filter((recipe) => treatmentKey(recipe.treatmentType) === treatmentKey(appointment.treatment));
      const insufficient = recipes.find((recipe) => {
        const item = stockItems.find((entry) => Number(entry.id) === Number(recipe.itemId));
        return !item || Number(item.amount) < Number(recipe.quantity);
      });
      if (insufficient) {
        const item = stockItems.find((entry) => Number(entry.id) === Number(insufficient.itemId));
        return { ok: false, message: item ? `Stok yetersiz: ${item.name}. Gerekli ${insufficient.quantity} ${item.unit}, mevcut ${item.amount} ${item.unit}.` : "Reçetedeki stok ürünü bulunamadı." };
      }
      appointment.stockUsage = recipes.map((recipe) => ({ itemId: Number(recipe.itemId), quantity: Number(recipe.quantity) }));
      for (const usage of appointment.stockUsage) {
        const item = stockItems.find((entry) => Number(entry.id) === usage.itemId);
        item.amount = Number(item.amount) - usage.quantity;
        (item.movements ||= []).unshift({ id: Date.now() + Math.random(), type: "OUT", quantity: usage.quantity, note: `${appointment.treatment} tamamlandı · otomatik sarf`, appointmentId: appointment.id, automatic: true, date: "Şimdi" });
      }
      return { ok: true, message: recipes.length ? "Randevu tamamlandı; reçetedeki malzemeler stoktan düşüldü." : "Randevu tamamlandı. Bu tedavi için malzeme reçetesi tanımlı değil." };
    }
    if (appointment.status === "COMPLETED" && Array.isArray(appointment.stockUsage)) {
      for (const usage of appointment.stockUsage) {
        const item = stockItems.find((entry) => Number(entry.id) === Number(usage.itemId));
        if (!item) continue;
        item.amount = Number(item.amount) + Number(usage.quantity);
        (item.movements ||= []).unshift({ id: Date.now() + Math.random(), type: "IN", quantity: Number(usage.quantity), note: `${appointment.treatment} geri alındı · otomatik iade`, appointmentId: appointment.id, automatic: true, date: "Şimdi" });
      }
      appointment.stockUsage = [];
      return { ok: true, message: "Tamamlama geri alındı; kullanılan malzemeler stoğa iade edildi." };
    }
    return { ok: true, message: "Randevu durumu güncellendi." };
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
    trashItems.unshift({ id: deletedAt + Math.random(), kind, label, payload, deletedAt, expiresAt: deletedAt + 30 * 24 * 60 * 60 * 1000 });
  }

  function purgeExpiredTrash() {
    const active = trashItems.filter((item) => Number(item.expiresAt) > Date.now());
    if (active.length === trashItems.length) return;
    trashItems = active;
    storage.set("clinicnova.trashItems", trashItems);
  }

  function trashDaysLeft(item) {
    return Math.max(1, Math.ceil((Number(item.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  function outstandingAmount(item) {
    return Number.isFinite(Number(item.remainingAmount)) ? Number(item.remainingAmount) : item.status === "PENDING" ? Number(item.amount) : 0;
  }

  function renderDashboard() {
    const allowed = (permission) => !serverPermissions || serverPermissions[permission] !== false;
    const todayAppointments = allowed("appointments") ? state.appointments.filter((item) => item.date === todayIso).sort((a, b) => a.time.localeCompare(b.time)) : [];
    const revenue = state.transactions.filter((item) => item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pending = state.transactions.filter((item) => item.type === "income" && outstandingAmount(item) > 0);
    const visibleLeadCount = allowed("tourism") ? hotLeads.length : 0;
    const visiblePending = allowed("finance") ? pending : [];
    $("#alertBanner").hidden = !allowed("tourism") && !allowed("finance");
    $("#opportunitySummary").textContent = `${visibleLeadCount} sıcak lead ve ${visiblePending.length} geciken tahsilat bugün aksiyon bekliyor.`;
    $("#alertBanner").setAttribute("aria-label", `Gelir fırsatları hazır: ${visibleLeadCount} sıcak lead ve ${visiblePending.length} geciken tahsilat`);
    const metrics = [
      { label: "Bugünkü randevu", value: todayAppointments.length, detail: "+2 geçen haftaya göre", icon: "i-calendar", positive: true },
      { label: "Aylık tahsilat", value: currency(revenue), detail: "+%14 büyüme", icon: "i-wallet", positive: true, bars: true },
      { label: "Aktif hasta", value: state.patients.filter((item) => item.tag !== "PASSIVE").length, detail: "2 yeni kayıt", icon: "i-users" },
      { label: "Bekleyen ödeme", value: currency(visiblePending.reduce((sum, item) => sum + outstandingAmount(item), 0)), detail: `${visiblePending.length} ödeme planı`, icon: "i-chart" }
    ].filter((metric) => !["Aylık tahsilat", "Bekleyen ödeme"].includes(metric.label) || allowed("finance")).filter((metric) => metric.label !== "Aktif hasta" || allowed("patients")).filter((metric) => metric.label !== "Bugünkü randevu" || allowed("appointments"));
    $("#metricGrid").innerHTML = metrics.map((metric) => `
      <article class="metric-card">
        <div class="metric-top"><span>${escapeHtml(metric.label)}</span><span class="metric-icon"><svg><use href="#${metric.icon}"/></svg></span></div>
        <strong>${escapeHtml(metric.value)}</strong>
        <small class="${metric.positive ? "positive" : ""}">${metric.positive ? "↗" : "•"} ${escapeHtml(metric.detail)}</small>
        ${metric.bars ? `<span class="mini-bars">${[25,48,35,62,56,78,92].map((height) => `<i style="height:${height}%"></i>`).join("")}</span>` : ""}
      </article>`).join("");
    $("#todayAppointments").innerHTML = todayAppointments.length ? todayAppointments.slice(0, 4).map((appointment) => {
      const patient = patientById(appointment.patientId);
      return `<button class="timeline-item" data-appointment="${appointment.id}" style="width:100%;border-left:0;border-right:0;border-top:0;background:transparent;text-align:left;color:inherit">
        <span class="timeline-time"><strong>${appointment.time}</strong><small>${appointment.duration} dk</small></span><span class="timeline-line"></span>
        <span class="timeline-copy"><strong>${escapeHtml(patient?.name || "Hasta")}</strong><small>${escapeHtml(appointment.treatment)} · ${escapeHtml(appointment.doctor)}</small></span>
        <span class="status-pill ${appointment.status}">${statusLabel(appointment.status)}</span>
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
      const [background, foreground] = palette[patient.color % palette.length].split("|");
      return `<div class="entry-row"><button class="patient-card" data-patient="${patient.id}" style="width:100%;text-align:left;color:inherit">
        <span class="patient-avatar" style="background:${background};color:${foreground}">${initials(patient.name)}</span>
        <span class="patient-copy"><strong>${escapeHtml(patient.name)}</strong><small>${escapeHtml(patient.phone)} · ${escapeHtml(patient.lastVisit)}</small><span class="patient-tags"><i class="tag">${escapeHtml(patient.tag)}</i><i class="tag">${escapeHtml(patient.treatment)}</i></span></span>
        <svg><use href="#i-chevron"/></svg>
      </button><button class="delete-button" data-delete-patient="${patient.id}" aria-label="${escapeHtml(patient.name)} hastasını sil">Sil</button></div>`;
    }).join("") : `<div class="empty-state"><strong>Sonuç bulunamadı</strong><br/>Arama veya filtreyi değiştirin.</div>`;
  }

  function renderDateStrip() {
    const month = state.appointmentMonth;
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first.getFullYear(), first.getMonth(), first.getDate() - mondayOffset);
    const dates = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
    $("#calendarMonthLabel").textContent = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(first);
    $("#dateStrip").innerHTML = dates.map((date) => {
      const iso = localDate(date);
      const outside = date.getMonth() !== first.getMonth();
      const hasAppointment = state.appointments.some((item) => item.date === iso);
      return `<button class="date-button ${iso === state.selectedDate ? "active" : ""} ${outside ? "outside" : ""} ${hasAppointment ? "has-appointment" : ""}" data-date="${iso}" aria-label="${new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(date)}"><strong>${date.getDate()}</strong></button>`;
    }).join("");
  }

  function renderTreatmentPlans() {
    $("#treatmentPlanList").innerHTML = treatmentPlans.length ? treatmentPlans.map((plan) => `<button class="offline-record clickable-record" data-treatment-plan="${plan.id}"><span class="record-icon">🦷</span><span class="patient-copy"><strong>${escapeHtml(plan.patient)}</strong><small>${escapeHtml(plan.treatment)} · ${escapeHtml(plan.doctor || "Hekim belirtilmedi")}</small><span class="record-progress"><i style="width:${plan.total ? Math.min(100, Math.round(plan.paid / plan.total * 100)) : 0}%"></i></span></span><span class="record-value">${currency(plan.paid || 0)}<small>${currency(plan.total || 0)} plan</small></span></button>`).join("") : `<div class="empty-state"><strong>Tedavi planı yok</strong><br/>Sunucuya bağlandığınızda klinik planları burada görünür.</div>`;
  }

  function renderStocks() {
    const criticalCount = stockItems.filter((item) => Number(item.amount) <= Number(item.minimum)).length;
    const totalValue = stockItems.reduce((sum, item) => sum + Number(item.amount || 0) * Number(item.purchasePrice || 0), 0);
    $("#stockSummary").innerHTML = `<article class="finance-stat"><span>Kritik ürün</span><strong>${criticalCount}</strong><small>${stockItems.length} ürün kayıtlı</small></article><article class="finance-stat"><span>Stok değeri</span><strong>${currency(totalValue)}</strong><small>Alış fiyatlarına göre</small></article>`;
    $("#stockList").innerHTML = stockItems.length ? stockItems.map((item) => {
      const critical = Number(item.amount) <= Number(item.minimum);
      return `<button class="offline-record clickable-record" data-stock-item="${item.id}"><span class="transaction-icon ${critical ? "expense" : ""}">${critical ? "!" : "✓"}</span><span class="patient-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category || "Kategorisiz")} · Min. ${item.minimum} ${escapeHtml(item.unit)}</small></span><span class="record-value ${critical ? "critical" : ""}">${item.amount}<small>${escapeHtml(item.unit)}</small></span></button>`;
    }).join("") : `<div class="empty-state"><strong>Stok ürünü yok</strong><br/>Yeni ürün ekleyerek başlayın.</div>`;
    $("#stockRecipeList").innerHTML = stockRecipes.length ? stockRecipes.map((recipe) => {
      const item = stockItems.find((entry) => Number(entry.id) === Number(recipe.itemId));
      return `<article class="offline-record record-deletable"><span class="record-icon">⚙️</span><span class="patient-copy"><strong>${escapeHtml(recipe.treatmentType)}</strong><small>${escapeHtml(item?.name || "Silinmiş ürün")} · ${recipe.quantity} ${escapeHtml(item?.unit || "adet")}</small></span><button class="delete-button" data-delete-stock-recipe="${recipe.id}" aria-label="${escapeHtml(recipe.treatmentType)} reçetesini sil">Sil</button></article>`;
    }).join("") : `<div class="empty-state"><strong>Tedavi reçetesi yok</strong><br/>Bir tedavi tamamlandığında düşecek malzemeleri tanımlayın.</div>`;
  }

  function renderAppointments() {
    renderDateStrip();
    const appointments = state.appointments.filter((item) => item.date === state.selectedDate).sort((a, b) => a.time.localeCompare(b.time));
    $("#appointmentTotal").textContent = appointments.length;
    $("#appointmentList").innerHTML = appointments.length ? appointments.map((appointment) => {
      const patient = patientById(appointment.patientId);
      return `<div class="entry-row"><button class="appointment-card" data-appointment="${appointment.id}" style="width:100%;text-align:left;color:inherit">
        <span class="appointment-clock"><strong>${appointment.time}</strong><small>${appointment.duration} dk</small></span>
        <span class="appointment-main"><span class="row"><strong>${escapeHtml(patient?.name || "Hasta")}</strong><i class="status-pill ${appointment.status}">${statusLabel(appointment.status)}</i></span><p>${escapeHtml(appointment.treatment)} · ${escapeHtml(appointment.room)}</p><footer><i class="doctor-chip">${initials(appointment.doctor.replace("Dr. ", ""))}</i>${escapeHtml(appointment.doctor)}</footer></span>
      </button><button class="delete-button" data-delete-appointment="${appointment.id}" aria-label="${escapeHtml(patient?.name || "Hasta")} randevusunu sil">Sil</button></div>`;
    }).join("") : `<div class="empty-state"><strong>Bu gün boş</strong><br/>Yeni bir randevu oluşturarak planlamaya başlayın.</div>`;
  }

  function renderFinance() {
    const income = state.transactions.filter((item) => item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const collected = state.transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const billed = state.transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.totalAmount || item.amount || 0), 0);
    const expense = state.transactions.filter((item) => item.type === "expense" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pending = state.transactions.filter((item) => item.type === "income" && outstandingAmount(item) > 0);
    const visibleTransactions = state.transactions.filter((item) => {
      if (state.transactionFilter === "ALL") return true;
      if (state.transactionFilter === "EXPENSE") return item.type === "expense";
      return item.status === state.transactionFilter;
    });
    $("#financePeriod").textContent = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(today);
    $("#monthlyRevenue").textContent = currency(collected);
    $("#financeStats").innerHTML = [
      ["Kesilen toplam", currency(billed), `${state.transactions.filter((item) => item.type === "income").length} gelir kaydı`],
      ["Bekleyen tahsilat", currency(pending.reduce((sum, item) => sum + outstandingAmount(item), 0)), `${pending.length} ödeme planı`],
      ["Toplam gider", currency(expense), `${state.transactions.filter((item) => item.type === "expense").length} gider kaydı`],
      ["Net nakit akışı", currency(collected - expense), "Tahsilat − gider"]
    ].map(([label, value, detail]) => `<article class="finance-stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
    $$("#financeFilterChips button").forEach((button) => button.classList.toggle("active", button.dataset.financeFilter === state.transactionFilter));
    $("#transactionFilterButton").textContent = ({ ALL: "Filtrele", PAID: "Ödenenler", PENDING: "Gecikenler", EXPENSE: "Giderler" })[state.transactionFilter];
    $("#pendingPaymentList").innerHTML = pending.length ? pending.map((item) => `<button class="offline-record clickable-record" data-finance-transaction="${item.id}"><span class="transaction-icon pending">!</span><span class="patient-copy"><strong>${escapeHtml(item.name)}</strong><small>${item.paidInstallments || 0}/${item.installmentCount || 1} taksit · ${escapeHtml(item.detail)}</small><span class="record-progress"><i style="width:${Math.min(100, Math.round(Number(item.amount || 0) / Number(item.totalAmount || item.amount || 1) * 100))}%"></i></span></span><span class="record-value critical">${currency(outstandingAmount(item))}<small>kalan</small></span></button>`).join("") : `<div class="empty-state"><strong>Bekleyen bakiye yok</strong><br/>Tüm tahsilatlar tamamlanmış görünüyor.</div>`;
    $("#transactionList").innerHTML = visibleTransactions.length ? visibleTransactions.map((item) => `<article class="transaction-card transaction-card-deletable"><button class="transaction-main" data-finance-transaction="${item.id}" aria-label="${escapeHtml(item.name)} finans ayrıntısı">
      <span class="transaction-icon ${item.type === "expense" ? "expense" : item.status === "PENDING" ? "pending" : ""}">${item.type === "expense" ? "−" : item.status === "PENDING" ? "!" : "+"}</span>
      <span class="transaction-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)} · ${escapeHtml(item.date)}${item.isDeposit ? " · Peşinat" : ""}</small>${item.components?.length ? `<span class="transaction-lines">${item.components.map((line) => `${escapeHtml(line.name)} ${currency(line.amount)}`).join(" · ")}</span>` : ""}${outstandingAmount(item) > 0 ? `<span class="installment-note">${item.paidInstallments || 0}/${item.installmentCount || 1} taksit ödendi · Kalan ${currency(outstandingAmount(item))}</span>` : ""}</span>
      <span class="transaction-amount ${item.type === "expense" ? "expense" : outstandingAmount(item) > 0 ? "pending" : ""}">${item.type === "expense" ? "−" : "+"}${currency(item.amount)}<small>${item.type === "expense" ? "Gider" : outstandingAmount(item) > 0 ? "Kısmi ödendi" : "Ödendi"}</small></span>
      </button>
      <button class="delete-button" data-delete-transaction="${item.id}" aria-label="${escapeHtml(item.name)} finans kaydını sil">Sil</button>
    </article>`).join("") : `<div class="empty-state"><strong>İşlem bulunamadı</strong><br/>Filtreyi değiştirerek diğer hareketleri görüntüleyin.</div>`;
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
    $("#consentList").innerHTML = visible.length ? visible.map((item) => `<article class="offline-record record-deletable"><button class="consent-main" data-consent="${item.id}"><span class="transaction-icon ${item.status === "İmzalandı" ? "" : ["Taslak", "İptal edildi"].includes(item.status) ? "expense" : "pending"}">${item.status === "İmzalandı" ? "✓" : item.status === "Taslak" ? "…" : item.status === "İptal edildi" ? "×" : "!"}</span><span class="patient-copy"><strong>${escapeHtml(item.patient)}</strong><small>${escapeHtml(item.form)} · ${escapeHtml(item.language || "Türkçe")}</small><span class="installment-note">${escapeHtml(item.channel || "Klinikte")} · ${escapeHtml(item.date)}</span></span><span class="record-state">${escapeHtml(item.status)}</span></button><button class="delete-button" data-delete-record="${item.id}" data-record-kind="consentRecords" aria-label="${escapeHtml(item.patient)} onam kaydını sil">Sil</button></article>`).join("") : `<div class="empty-state"><strong>Onam bulunamadı</strong><br/>Filtreyi değiştirin veya yeni bir onam oluşturun.</div>`;
  }

  function renderModules() {
    const modulePermission = { Finans: "finance", "Gerçekleşen tedaviler": "treatments", Personel: "staff", "Sağlık turizmi": "tourism", İletişim: "communication", Anketler: "surveys", Recall: "recalls", Raporlar: "reports", "Dijital onam": "consents" };
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
    modalOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    $("#modalEyebrow").textContent = eyebrow;
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = content;
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
    openModal("HASTA PROFİLİ", "Bilgileri düzenle", `<form id="patientEditForm" class="modal-grid"><input type="hidden" name="patientId" value="${patient.id}" />
      <div class="modal-grid two"><label class="field">Ad soyad<input name="name" value="${escapeHtml(patient.name)}" required /></label><label class="field">Telefon<input name="phone" type="tel" value="${escapeHtml(patient.phone)}" required /></label></div>
      <div class="modal-grid two"><label class="field">E-posta<input name="email" type="email" value="${escapeHtml(patient.email || "")}" /></label><label class="field">TC / kimlik no<input name="nationalId" value="${escapeHtml(patient.nationalId || "")}" /></label></div>
      <div class="modal-grid two"><label class="field">Doğum tarihi<input name="birthDate" type="date" value="${escapeHtml(patient.birthDate || "")}" /></label><label class="field">Cinsiyet<select name="gender">${[["UNSPECIFIED","Belirtilmedi"],["FEMALE","Kadın"],["MALE","Erkek"],["OTHER","Diğer"]].map(([value,label]) => `<option value="${value}" ${patient.gender === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
      <label class="field">Adres<textarea name="address">${escapeHtml(patient.address || "")}</textarea></label><div class="modal-grid two"><label class="field">Alerjiler<textarea name="allergies">${escapeHtml(patient.allergies || "")}</textarea></label><label class="field">Kronik hastalıklar<textarea name="chronicDiseases">${escapeHtml(patient.chronicDiseases || "")}</textarea></label></div><label class="field">Kullandığı ilaçlar<textarea name="medications">${escapeHtml(patient.medications || "")}</textarea></label>
      <div class="modal-grid two"><label class="field">Etiket<select name="tag">${["NEW","ACTIVE","PASSIVE","RISKY","VIP"].map((tag) => `<option ${patient.tag === tag ? "selected" : ""}>${tag}</option>`).join("")}</select></label><label class="field">İlgilendiği tedavi<input name="treatment" value="${escapeHtml(patient.treatment || "")}" /></label></div><label class="field">Not<textarea name="note">${escapeHtml(patient.note || "")}</textarea></label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-patient="${patient.id}">Vazgeç</button><button class="button button-primary">Değişiklikleri kaydet</button></div></form>`);
  }

  function openAddAppointment(preferredPatientId) {
    if (!clinicDoctors.length) return showToast("Önce Klinik yönetimi bölümünden doktor ekleyin.");
    if (!clinicChairs.length) return showToast("Önce Klinik yönetimi bölümünden koltuk ekleyin.");
    const selectedPatientId = Number(preferredPatientId);
    const patientOptions = state.patients.map((patient) => `<option value="${patient.id}" ${patient.id === selectedPatientId ? "selected" : ""}>${escapeHtml(patient.name)}</option>`).join("");
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
    const patientOptions = state.patients.map((patient) => `<option value="${patient.id}" ${patient.id === selectedPatientId ? "selected" : ""}>${escapeHtml(patient.name)}</option>`).join("");
    openModal("TAHSİLAT", "Ödeme al", `<form id="paymentForm" class="modal-grid">
      <label class="field">Hasta<select name="patientId" required>${patientOptions}</select></label>
      <div class="line-item-grid"><label class="field">İşlem 1<input name="itemName1" value="İmplant" required /></label><label class="field">Bedeli<input name="itemAmount1" type="number" inputmode="decimal" min="0" step="1" value="30000" required /></label><label class="field">İşlem 2<input name="itemName2" value="Protez üst yapı" /></label><label class="field">Bedeli<input name="itemAmount2" type="number" inputmode="decimal" min="0" step="1" value="12000" /></label></div>
      <div class="modal-grid two"><label class="field">Şimdi alınan<input name="amount" type="number" inputmode="decimal" min="1" step="1" value="18000" required /></label><label class="field">Ödeme yöntemi<select name="method"><option>Kart</option><option>Nakit</option><option>Transfer</option><option>Online</option></select></label></div>
      <div class="modal-grid two"><label class="field">Toplam taksit<select name="installmentCount"><option value="1">Tek çekim</option><option value="2">2 taksit</option><option value="3">3 taksit</option><option value="4" selected>4 taksit</option><option value="6">6 taksit</option><option value="9">9 taksit</option><option value="12">12 taksit</option></select></label><label class="field">Ödenen taksit<input name="paidInstallments" type="number" min="0" value="1" /></label></div>
      <label class="field checkbox-field"><input name="isDeposit" type="checkbox" /> Bu tahsilat peşinattır</label>
      <label class="field">Not<input name="description" value="Tedavi planı tahsilatı" required /></label>
      <p class="modal-note">Tahsilat hemen cihazda saklanır; sunucu bağlandığında merkezi finans paneline eşitlenir.</p>
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
    const options = state.patients.map((patient) => `<option value="${patient.id}">${escapeHtml(patient.name)}</option>`).join("");
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
    openModal(item.type === "expense" ? "GİDER DETAYI" : "TAHSİLAT DETAYI", item.name, `<div class="modal-grid">
      <div class="finance-stats"><article class="finance-stat"><span>${item.type === "expense" ? "Gider" : "Tahsil edilen"}</span><strong>${currency(item.amount)}</strong><small>${escapeHtml(item.date)}</small></article><article class="finance-stat"><span>${item.type === "expense" ? "Kategori" : "Kalan bakiye"}</span><strong>${item.type === "expense" ? escapeHtml(item.category || "Diğer") : currency(remaining)}</strong><small>${item.type === "expense" ? escapeHtml(item.method || "Belirtilmedi") : `${item.paidInstallments || 0}/${item.installmentCount || 1} taksit`}</small></article></div>
      <p class="modal-note"><strong>${escapeHtml(item.detail)}</strong>${item.isDeposit ? "<br/>Peşinat olarak işlendi." : ""}</p>
      ${item.components?.length ? `<section class="patient-section"><div class="patient-section-title"><strong>İşlem kalemleri</strong><span>${item.components.length}</span></div><div class="history-list">${item.components.map((line) => `<article><i>₺</i><span><strong>${escapeHtml(line.name)}</strong><small>${currency(line.amount)}</small></span></article>`).join("")}</div></section>` : ""}
      ${item.paymentHistory?.length ? `<section class="patient-section"><div class="patient-section-title"><strong>Tahsilat geçmişi</strong><span>${item.paymentHistory.length}</span></div><div class="history-list">${item.paymentHistory.map((entry) => `<article><i>₺</i><span><strong>${currency(entry.amount)} · ${escapeHtml(entry.method)}</strong><small>${escapeHtml(entry.date)}</small><p>${escapeHtml(entry.note)}</p></span></article>`).join("")}</div></section>` : ""}
      ${remaining > 0 ? `<div class="finance-progress"><span style="width:${Math.min(100, Math.round(Number(item.amount || 0) / Number(item.totalAmount || item.amount || 1) * 100))}%"></span></div><button class="button button-primary" data-pay-balance="${item.id}">Bu plana tahsilat işle</button>` : ""}
    </div>`);
  }

  function openBalancePayment(id) {
    const item = state.transactions.find((entry) => Number(entry.id) === Number(id));
    const remaining = item ? outstandingAmount(item) : 0;
    if (!item || item.type === "expense" || remaining <= 0) return showToast("Açık ödeme planı bulunamadı.");
    const unpaidInstallments = Math.max(1, Number(item.installmentCount || 1) - Number(item.paidInstallments || 0));
    const suggested = Math.min(remaining, Math.ceil(remaining / unpaidInstallments));
    openModal("TAKSİT TAHSİLATI", item.name, `<form id="balancePaymentForm" class="modal-grid"><input type="hidden" name="transactionId" value="${item.id}" />
      <div class="finance-stats"><article class="finance-stat"><span>Kalan bakiye</span><strong>${currency(remaining)}</strong><small>${item.paidInstallments || 0}/${item.installmentCount || 1} taksit ödendi</small></article><article class="finance-stat"><span>Önerilen ödeme</span><strong>${currency(suggested)}</strong><small>${unpaidInstallments} taksit kaldı</small></article></div>
      <div class="modal-grid two"><label class="field">Alınan tutar<input name="amount" type="number" inputmode="decimal" min="0.01" max="${remaining}" step="0.01" value="${suggested}" required /></label><label class="field">Ödeme yöntemi<select name="method"><option>Kart</option><option>Nakit</option><option>Transfer</option><option>Online</option></select></label></div>
      <label class="field">Açıklama<input name="note" value="Taksit tahsilatı" required /></label>
      <p class="modal-note">Bu ödeme mevcut plana işlenir; yeni ve bağımsız bir borç kaydı oluşturmaz.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-finance-transaction="${item.id}">Vazgeç</button><button type="submit" class="button button-primary">Tahsilatı kaydet</button></div>
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
      ${item.status !== "İptal edildi" ? `<button class="button button-primary" data-edit-consent-status="${item.id}">Durumu değiştir</button>` : `<p class="modal-note">İptal edilen onam yeniden etkinleştirilmez. Yeni belge sürümü oluşturun.</p>`}
    </div>`);
  }

  function openConsentStatusEditor(id) {
    const item = consentRecords.find((entry) => Number(entry.id) === Number(id));
    if (!item) return;
    const options = item.status === "İmzalandı" ? ["İmzalandı", "İptal edildi"] : ["Taslak", "İmza bekliyor", "İmzalandı", "İptal edildi"];
    openModal("ONAM DURUMU", item.patient, `<form id="consentStatusForm" class="modal-grid"><input type="hidden" name="consentId" value="${item.id}" />
      <p class="modal-note"><strong>${escapeHtml(item.form)}</strong><br/>Mevcut durum: ${escapeHtml(item.status)}. İmzalı belge yalnızca iptal edilebilir; eski imza kaydı korunur.</p>
      <label class="field">Yeni durum<select name="status">${options.map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
      <label class="field">İmzalayan / işlem yapan<input name="actor" value="${escapeHtml(item.signer || item.patient)}" required /></label>
      <label class="field">Açıklama<textarea name="note" required placeholder="Durum değişikliği nedeni veya imza notu"></textarea></label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-consent="${item.id}">Vazgeç</button><button type="submit" class="button button-primary">Durumu kaydet</button></div>
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
    openModal("TEDAVİ GEÇMİŞİ", `${patient.name} için kayıt`, `<form id="treatmentHistoryForm" class="modal-grid"><input type="hidden" name="patientId" value="${patient.id}" />
      <div class="modal-grid two"><label class="field">Tedavi<input name="treatment" required placeholder="Dolgu, kontrol, ölçü..." /></label><label class="field">Tarih<input name="date" type="date" value="${todayIso}" required /></label></div>
      <label class="field">Hekim<select name="doctor" required>${doctorOptions}</select></label>
      <label class="field">Klinik notu<textarea name="note" required minlength="3" placeholder="Uygulanan işlem, kullanılan malzeme ve takip notu"></textarea></label>
      <p class="modal-note">Bu alan geçmişten gelen veya randevu dışında tamamlanan klinik işlemler içindir. Randevuyu “Tamamlandı” yapmak tedavi geçmişini zaten otomatik oluşturur.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-patient="${patient.id}">Vazgeç</button><button type="submit" class="button button-primary">Tedavi kaydını ekle</button></div>
    </form>`);
  }

  function openAddLead() {
    openModal("SAĞLIK TURİZMİ", "Yeni lead ekle", `<form id="leadForm" class="modal-grid">
      <div class="modal-grid two"><label class="field">Ad soyad<input name="name" required /></label><label class="field">Ülke<input name="country" required placeholder="Almanya" /></label></div>
      <label class="field">Telefon<input name="phone" type="tel" required placeholder="+49 ..." /></label>
      <label class="field">Talep edilen tedavi<input name="treatment" required placeholder="İmplant, zirkonyum..." /></label>
      <label class="field">Lead puanı<input name="score" type="number" min="0" max="100" step="1" value="50" required /></label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-module="Sağlık turizmi">Vazgeç</button><button type="submit" class="button button-primary">Lead’i kaydet</button></div>
    </form>`);
  }

  function openAddCommunication() {
    const recipients = [...state.patients.map((item) => item.name), ...hotLeads.map((item) => item.name)];
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
      <div class="modal-grid two"><label class="field">Hasta<select name="patientId">${state.patients.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></label><label class="field">Hekim<select name="doctor">${clinicDoctors.map((item) => `<option>${escapeHtml(item.name)}</option>`).join("")}</select></label></div>
      <div class="modal-grid two"><label class="field">Tedavi<input name="treatment" required placeholder="İmplant, dolgu..." /></label><label class="field">Diş / bölge<input name="tooth" placeholder="36 veya tüm ağız" /></label></div>
      <div class="modal-grid two"><label class="field">Tarih<input name="date" type="date" value="${todayIso}" required /></label><label class="field">Durum<select name="status"><option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED">Başladı</option><option value="COMPLETED" selected>Tamamlandı</option><option value="CANCELLED">İptal</option></select></label></div>
      <label class="field">Ücret<input name="fee" type="number" min="0" step="0.01" value="0" required /></label><label class="field">Klinik açıklaması<textarea name="description"></textarea></label>
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

  function openAddSurvey() {
    openModal("ANKETLER", "Memnuniyet anketi oluştur", `<form id="surveyForm" class="modal-grid"><label class="field">Başlık<input name="title" required /></label><label class="field">Açıklama<textarea name="description"></textarea></label><label class="field checkbox-field"><input name="active" type="checkbox" checked /> Yanıt kabul ediyor</label><div class="modal-actions"><button type="button" class="button button-secondary" data-module="Anketler">Vazgeç</button><button class="button button-primary">Anketi kaydet</button></div></form>`);
  }

  function openAddSurveyResponse() {
    const activeSurveys = surveys.filter((item) => item.active !== false);
    if (!activeSurveys.length || !state.patients.length) return showToast("Önce aktif bir anket ve hasta ekleyin.");
    openModal("ANKET YANITI", "Hasta yanıtı ekle", `<form id="surveyResponseForm" class="modal-grid"><label class="field">Anket<select name="surveyId">${activeSurveys.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join("")}</select></label><label class="field">Hasta<select name="patientId">${state.patients.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></label><label class="field">Puan<select name="score">${[5,4,3,2,1].map((score) => `<option value="${score}">${score} / 5</option>`).join("")}</select></label><label class="field">Yorum<textarea name="comment"></textarea></label><div class="modal-actions"><button type="button" class="button button-secondary" data-module="Anketler">Vazgeç</button><button class="button button-primary">Yanıtı kaydet</button></div></form>`);
  }

  function openAddRecall() {
    if (!state.patients.length) return showToast("Önce hasta ekleyin.");
    openModal("RECALL", "Hasta takibi ekle", `<form id="recallForm" class="modal-grid"><label class="field">Hasta<select name="patientId">${state.patients.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select></label><label class="field">Takip nedeni<input name="reason" required placeholder="6 aylık kontrol" /></label><div class="modal-grid two"><label class="field">Takip tarihi<input name="dueDate" type="date" value="${todayIso}" required /></label><label class="field">Durum<select name="status"><option value="OPEN">Açık</option><option value="CONTACTED">İletişime geçildi</option><option value="SCHEDULED">Randevu planlandı</option><option value="CLOSED">Kapandı</option></select></label></div><label class="field">Not<textarea name="notes"></textarea></label><div class="modal-actions"><button type="button" class="button button-secondary" data-module="Recall">Vazgeç</button><button class="button button-primary">Takibi kaydet</button></div></form>`);
  }

  function openAddTreatmentPlan() {
    if (!state.patients.length) return showToast("Önce bir hasta ekleyin.");
    if (!clinicDoctors.length) return showToast("Önce Klinik yönetimi bölümünden doktor ekleyin.");
    const patientOptions = state.patients.map((patient) => `<option value="${patient.id}">${escapeHtml(patient.name)}</option>`).join("");
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
    const options = stockItems.map((item) => `<option value="${item.id}" ${Number(preferredItemId) === Number(item.id) ? "selected" : ""}>${escapeHtml(item.name)} · ${item.amount} ${escapeHtml(item.unit)}</option>`).join("");
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
    const options = stockItems.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${item.amount} ${escapeHtml(item.unit)}</option>`).join("");
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
    const remaining = Math.max(0, Number(plan.total || 0) - Number(plan.paid || 0));
    openModal("TEDAVİ PLANI DETAYI", plan.patient, `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(plan.treatment)}</strong><br/>Durum: ${escapeHtml(plan.status)} · Plan tarihi: ${escapeHtml(plan.plannedAt || "Belirtilmedi")}</p>
      <div class="finance-stats"><article class="finance-stat"><span>Plan tutarı</span><strong>${currency(plan.total || 0)}</strong><small>${currency(plan.paid || 0)} tahsil edildi</small></article><article class="finance-stat"><span>Kalan</span><strong>${currency(remaining)}</strong><small>${escapeHtml(plan.status)}</small></article></div>
      <div class="history-list"><article><i>🦷</i><span><strong>Diş / bölge</strong><small>${escapeHtml(plan.tooth || "Belirtilmedi")}</small></span></article><article><i>👨‍⚕️</i><span><strong>Hekim</strong><small>${escapeHtml(plan.doctor || "Belirtilmedi")}</small></span></article><article><i>⌂</i><span><strong>Şube</strong><small>${escapeHtml(plan.branch || "Belirtilmedi")}</small></span></article></div>
      <p class="modal-note"><strong>Ödeme planı</strong><br/>${plan.paymentPlan ? `${currency(plan.paymentPlan.downPayment || 0)} peşinat · ${plan.paymentPlan.installmentCount} taksit<br/>${plan.paymentPlan.installments.map((item) => `${item.number}. taksit: ${currency(item.amount)} · ${new Intl.DateTimeFormat("tr-TR").format(new Date(`${item.dueDate}T12:00:00`))}`).join("<br/>")}${plan.paymentPlan.note ? `<br/>Not: ${escapeHtml(plan.paymentPlan.note)}` : ""}` : "Taksit planı tanımlanmadı."}</p>
      <p class="modal-note"><strong>Klinik notu</strong><br/>${escapeHtml(plan.note || "Not eklenmemiş.")}</p>
    </div>`);
  }

  function openClinicManagement() {
    openModal("KLİNİK AYARLARI", "Klinik yönetimi", `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(currentClinicName())}</strong><br/>Randevu ve tedavi formlarındaki doktor ile koltuk seçeneklerini buradan yönetin.</p>
      <button class="button button-secondary" data-action="rename-clinic">Klinik adını değiştir</button>
      <div class="section-heading"><div><span class="eyebrow">HEKİMLER</span><h3>Doktorlar</h3></div><button class="text-button" data-action="add-doctor">Doktor ekle</button></div>
      <div class="list-stack">${clinicDoctors.map((doctor) => `<article class="offline-record record-deletable"><span class="record-icon">👨‍⚕️</span><span class="patient-copy"><strong>${escapeHtml(doctor.name)}</strong><small>${escapeHtml(doctor.specialty || "Diş hekimi")} · ${escapeHtml(doctor.email || "")}</small></span><button class="delete-button" data-delete-doctor="${doctor.id}">Sil</button></article>`).join("") || `<div class="empty-state">Doktor eklenmedi.</div>`}</div>
      <div class="section-heading"><div><span class="eyebrow">PLANLAMA</span><h3>Koltuklar</h3></div><button class="text-button" data-action="add-chair">Koltuk ekle</button></div>
      <div class="list-stack">${clinicChairs.map((chair) => `<article class="offline-record record-deletable"><span class="record-icon">🪑</span><span class="patient-copy"><strong>${escapeHtml(chair)}</strong><small>Randevu planlamasında kullanılabilir</small></span><button class="delete-button" data-delete-chair="${escapeHtml(chair)}">Sil</button></article>`).join("") || `<div class="empty-state">Koltuk eklenmedi.</div>`}</div>
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

  function openStockDetail(id) {
    const item = stockItems.find((entry) => Number(entry.id) === Number(id));
    if (!item) return;
    const offers = Array.isArray(item.offers) ? [...item.offers].filter((offer) => offer.inStock !== false).sort((a, b) => (Number(a.unitPrice) + Number(a.shippingPrice || 0)) - (Number(b.unitPrice) + Number(b.shippingPrice || 0))) : [];
    const serverUrl = previewMode ? "" : storage.get("clinicnova.serverUrl", "");
    openModal("STOK DETAYI", item.name, `<div class="modal-grid">
      <div class="finance-stats"><article class="finance-stat"><span>Mevcut</span><strong>${item.amount} ${escapeHtml(item.unit)}</strong><small>Minimum ${item.minimum}</small></article><article class="finance-stat"><span>Stok değeri</span><strong>${currency(Number(item.amount) * Number(item.purchasePrice || 0))}</strong><small>${currency(item.purchasePrice || 0)} / ${escapeHtml(item.unit)}</small></article></div>
      <p class="modal-note"><strong>${escapeHtml(item.category || "Kategorisiz")}</strong><br/>Tedarikçi: ${escapeHtml(item.supplier || "Belirtilmedi")}<br/>Son hareket: ${escapeHtml(item.movements?.[0]?.note || "Henüz hareket yok")}</p>
      <div class="stock-actions"><button class="button button-primary" data-action="add-stock-offer" data-stock-prefill="${item.id}" ${productSearchInFlight ? "disabled" : ""}>${productSearchInFlight ? "Fiyat okunuyor…" : "Satın alma sayfası ekle"}</button><button class="button button-secondary" data-action="stock-movement" data-stock-prefill="${item.id}">Adet ekle / çıkar</button></div>
      <section class="patient-section"><div class="patient-section-title"><strong>Satın alma sayfaları</strong><span>${offers.length}</span></div><div class="purchase-list">${offers.length ? offers.map((offer) => { const total = Number(offer.unitPrice) + Number(offer.shippingPrice || 0); const checked = offer.checkedAt ? new Date(offer.checkedAt).toLocaleString("tr-TR") : "Kayıtlı fiyat"; return `<div class="purchase-row"><span><strong>${escapeHtml(offer.seller)}</strong><small>Ürün ${currency(offer.unitPrice)} + kargo ${currency(offer.shippingPrice || 0)} · ${escapeHtml(checked)}</small></span><span class="purchase-actions"><a class="mini-action" href="${escapeHtml(offer.productUrl)}" target="_blank" rel="noopener noreferrer">${currency(total)} · Satın al</a><button class="delete-button" data-delete-stock-offer="${offer.id}" data-stock-id="${item.id}" aria-label="${escapeHtml(offer.seller)} satın alma fiyatını sil">Sil</button></span></div>`; }).join("") : `<p class="empty-inline">Henüz sayfa eklenmedi. Mağazadaki ürün bağlantısını girerek güncel fiyatı görebilirsiniz.</p>`}</div></section>
      ${serverUrl ? `<p class="modal-note">Ürün sayfasını yapıştırın; ClinicNova fiyatı okuyup “Satın al” bağlantısını hazırlar.</p>` : `<p class="modal-note">Sayfadaki fiyatı okumak için ClinicNova sunucunuzu bağlayın.</p>`}
    </div>`);
  }

  function openAddStockOffer(preferredItemId) {
    const item = stockItems.find((entry) => Number(entry.id) === Number(preferredItemId));
    if (!item) return;
    openModal("SATIN ALMA", `${item.name} fiyatı`, `<form id="stockOfferForm" class="modal-grid"><input type="hidden" name="itemId" value="${item.id}" />
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
    const totalPaid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalRemaining = payments.reduce((sum, item) => sum + outstandingAmount(item), 0);
    openModal("HASTA PROFİLİ", patient.name, `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(patient.phone)}</strong><br/>${escapeHtml(patient.email || "E-posta belirtilmedi")}<br/>Kimlik: ${escapeHtml(patient.nationalId || "Belirtilmedi")} · Doğum: ${escapeHtml(patient.birthDate || "Belirtilmedi")}<br/>Adres: ${escapeHtml(patient.address || "Belirtilmedi")}<br/>Son ziyaret: ${escapeHtml(patient.lastVisit)}</p>
      <p class="modal-note"><strong>Sağlık özeti</strong><br/>Alerji: ${escapeHtml(patient.allergies || "Yok / belirtilmedi")}<br/>Kronik hastalık: ${escapeHtml(patient.chronicDiseases || "Yok / belirtilmedi")}<br/>İlaçlar: ${escapeHtml(patient.medications || "Yok / belirtilmedi")}</p>
      <div class="finance-stats"><article class="finance-stat"><span>Tahsil edilen</span><strong>${currency(totalPaid)}</strong><small>${payments.length} ödeme kaydı</small></article><article class="finance-stat"><span>Kalan bakiye</span><strong>${currency(totalRemaining)}</strong><small>${appointments.length} randevu</small></article></div>
      <section class="patient-section"><div class="patient-section-title"><strong>Geçmiş tedaviler</strong><span>${history.length}</span></div><div class="history-list">${history.length ? history.map((item, index) => `<article><i>🦷</i><span><strong>${escapeHtml(item.treatment)}</strong><small>${escapeHtml(item.date)} · ${escapeHtml(item.doctor)}</small><p>${escapeHtml(item.note)}</p></span><button class="delete-button" data-delete-treatment="${index}" data-patient-id="${patient.id}" aria-label="${escapeHtml(item.treatment)} kaydını sil">Sil</button></article>`).join("") : `<p class="empty-inline">Tedavi geçmişi yok.</p>`}</div><button class="button button-secondary" data-action="add-treatment-history" data-patient-prefill="${patient.id}">Geçmiş tedavi ekle</button></section>
      <section class="patient-section"><div class="patient-section-title"><strong>Ödeme geçmişi</strong><span>${payments.length}</span></div><div class="history-list">${payments.length ? payments.map((item) => `<article><i>₺</i><span><strong>${currency(item.amount)} · ${escapeHtml(item.detail)}</strong><small>${escapeHtml(item.date)}${outstandingAmount(item) ? ` · Kalan ${currency(outstandingAmount(item))}` : " · Tamamlandı"}</small>${item.components?.length ? `<p>${item.components.map((line) => `${escapeHtml(line.name)}: ${currency(line.amount)}`).join(" · ")}</p>` : ""}</span><button class="delete-button" data-delete-transaction="${item.id}" data-patient-id="${patient.id}" aria-label="Ödeme kaydını sil">Sil</button></article>`).join("") : `<p class="empty-inline">Ödeme geçmişi yok.</p>`}</div></section>
      <section class="patient-section"><div class="patient-section-title"><strong>Before / After fotoğrafları</strong><span>${media.length}</span></div><div class="photo-grid">${media.length ? media.map((item) => `<figure><img src="${escapeHtml(item.dataUrl)}" alt="${escapeHtml(item.kind)} fotoğrafı"/><figcaption>${escapeHtml(item.kind)} · ${escapeHtml(item.date)}</figcaption><button class="delete-button photo-delete" data-delete-media="${item.id}" data-patient-id="${patient.id}" aria-label="${escapeHtml(item.kind)} fotoğrafını sil">Sil</button></figure>`).join("") : `<p class="empty-inline">Henüz fotoğraf eklenmedi.</p>`}</div><div class="photo-actions"><label class="button button-secondary">📷 Before çek<input class="visually-hidden" type="file" accept="image/*" capture="environment" data-patient-media="${patient.id}" data-media-kind="Before" /></label><label class="button button-secondary">📷 After çek<input class="visually-hidden" type="file" accept="image/*" capture="environment" data-patient-media="${patient.id}" data-media-kind="After" /></label><label class="button button-secondary">Dosyalardan yükle<input class="visually-hidden" type="file" accept="image/*" data-patient-media="${patient.id}" data-media-kind="Dosya" /></label></div></section>
      <div class="modal-actions"><button class="button button-secondary" data-edit-patient="${patient.id}">Bilgileri düzenle</button><button class="button button-secondary" data-action="add-appointment" data-patient-prefill="${patient.id}">Yeni randevu oluştur</button><button class="button button-primary" data-action="add-payment" data-patient-prefill="${patient.id}">Ödeme ekle</button></div>
    </div>`);
  }

  function openAppointmentDetail(id) {
    const appointment = state.appointments.find((item) => item.id === Number(id));
    if (!appointment) return;
    const patient = patientById(appointment.patientId);
    const appointmentTreatment = treatmentKey(appointment.treatment);
    const signedConsent = consentRecords.find((item) => { const consentTreatment = treatmentKey(item.treatment); return Number(item.patientId) === Number(appointment.patientId) && item.status === "İmzalandı" && (consentTreatment === "genel" || appointmentTreatment.includes(consentTreatment) || consentTreatment.includes(appointmentTreatment)); });
    openModal("RANDEVU DETAYI", `${appointment.time} · ${patient?.name || "Hasta"}`, `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(appointment.treatment)}</strong><br/>${escapeHtml(appointment.doctor)} · ${escapeHtml(appointment.room)}<br/>${appointment.duration} dakika · ${statusLabel(appointment.status)}</p>
      <p class="modal-note"><strong>Onam kontrolü</strong><br/>${signedConsent ? `İmzalı: ${escapeHtml(signedConsent.form)} · ${escapeHtml(signedConsent.signedAt || signedConsent.date)}` : "Bu tedaviyle eşleşen imzalı onam bulunamadı. İşlem öncesi Onam bölümünü kontrol edin."}</p>
      <label class="field">Durum<select id="appointmentStatus"><option value="PLANNED" ${appointment.status === "PLANNED" ? "selected" : ""}>Planlandı</option><option value="ARRIVED" ${appointment.status === "ARRIVED" ? "selected" : ""}>Geldi</option><option value="COMPLETED" ${appointment.status === "COMPLETED" ? "selected" : ""}>Tamamlandı</option><option value="PENDING_CONFIRMATION" ${appointment.status === "PENDING_CONFIRMATION" ? "selected" : ""}>Onay bekliyor</option><option value="NO_SHOW" ${appointment.status === "NO_SHOW" ? "selected" : ""}>Gelmedi</option><option value="CANCELLED" ${appointment.status === "CANCELLED" ? "selected" : ""}>İptal edildi</option></select></label>
      <button class="button button-primary" data-save-appointment="${appointment.id}">Durumu güncelle</button>
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
      <button class="button button-secondary" data-clear-local>Yerel verileri temizle</button>
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

  function openRevenueOpportunities() {
    const overdue = state.transactions.filter((item) => item.type === "income" && item.status === "PENDING");
    openModal("GELİR FIRSATLARI", "Bugünkü fırsatlar", `<div class="modal-grid">
      <section class="opportunity-group"><div class="opportunity-heading"><div><span class="eyebrow">SATIŞ</span><h3>Sıcak leadler</h3></div><strong>${hotLeads.length}</strong></div>
        <div class="list-stack">${hotLeads.map((lead) => `<article class="opportunity-card"><span class="score-badge">${lead.score}</span><span class="patient-copy"><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.country)} · ${escapeHtml(lead.treatment)}</small></span><a class="mini-action" href="tel:${escapeHtml(lead.phone.replace(/\s+/g, ""))}" aria-label="${escapeHtml(lead.name)} kişisini ara">Ara</a></article>`).join("")}</div>
      </section>
      <section class="opportunity-group"><div class="opportunity-heading"><div><span class="eyebrow">TAHSİLAT</span><h3>Geciken ödemeler</h3></div><strong>${overdue.length}</strong></div>
        <div class="list-stack">${overdue.map((item) => `<article class="opportunity-card"><span class="transaction-icon pending">!</span><span class="patient-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)} · ${escapeHtml(item.date)}</small></span><strong>${currency(item.amount)}</strong></article>`).join("") || `<div class="empty-state">Geciken tahsilat yok.</div>`}</div>
      </section>
      <div class="modal-actions"><button class="button button-secondary" data-module="Sağlık turizmi">Lead modülü</button><button class="button button-primary" data-transaction-filter="PENDING">Geciken tahsilatları aç</button></div>
    </div>`);
  }

  function openFinanceReport() {
    const paidIncome = state.transactions.filter((item) => item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const expenses = state.transactions.filter((item) => item.type === "expense" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pending = state.transactions.filter((item) => item.type === "income" && item.status === "PENDING").reduce((sum, item) => sum + item.amount, 0);
    openModal("FİNANS RAPORU", "Aylık özet", `<div class="modal-grid">
      <div class="finance-stats"><article class="finance-stat"><span>Tahsil edilen</span><strong>${currency(paidIncome)}</strong><small>Ödenmiş işlemler</small></article><article class="finance-stat"><span>Net akış</span><strong>${currency(paidIncome - expenses)}</strong><small>Gelir − gider</small></article></div>
      <div class="finance-stats"><article class="finance-stat"><span>Bekleyen</span><strong>${currency(pending)}</strong><small>Geciken tahsilatlar</small></article><article class="finance-stat"><span>Gider</span><strong>${currency(expenses)}</strong><small>Kaydedilmiş giderler</small></article></div>
      <button class="button button-primary" data-go="finance">Finans merkezini aç</button>
    </div>`);
  }

  function openTransactionFilter() {
    const filters = [["ALL", "Tüm işlemler"], ["PAID", "Ödenenler"], ["PENDING", "Gecikenler"], ["EXPENSE", "Giderler"]];
    openModal("FİLTRE", "Finans hareketleri", `<div class="filter-action-grid">${filters.map(([value, label]) => `<button class="filter-action ${state.transactionFilter === value ? "active" : ""}" data-transaction-filter="${value}"><strong>${label}</strong><small>${value === "PENDING" ? "Aksiyon bekleyen tahsilatlar" : value === "EXPENSE" ? "Klinik giderleri" : value === "PAID" ? "Tamamlanan tahsilatlar" : "Bütün finans hareketleri"}</small></button>`).join("")}</div>`);
  }

  function openModule(name) {
    if (name === "Finans") return navigate("finance");
    if (name === "Dijital onam") return navigate("consents");
    if (name === "Tam web paneli") return openLivePortal("/dashboard");
    const paidIncome = state.transactions.filter((item) => item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const expenses = state.transactions.filter((item) => item.type === "expense" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pendingTotal = state.transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + outstandingAmount(item), 0);
    const completedAppointments = state.appointments.filter((item) => item.status === "COMPLETED").length;
    const noShowAppointments = state.appointments.filter((item) => item.status === "NO_SHOW").length;
    const stockValue = stockItems.reduce((sum, item) => sum + Number(item.amount || 0) * Number(item.purchasePrice || 0), 0);
    const criticalStock = stockItems.filter((item) => Number(item.amount) <= Number(item.minimum)).length;
    const treatmentCounts = Object.entries(state.appointments.reduce((result, item) => { result[item.treatment] = (result[item.treatment] || 0) + 1; return result; }, {})).sort((a, b) => b[1] - a[1]);
    const doctorCounts = Object.entries(state.appointments.reduce((result, item) => { result[item.doctor] = (result[item.doctor] || 0) + 1; return result; }, {})).sort((a, b) => b[1] - a[1]);
    const moduleContent = {
      "Tedavi planları": `<div class="list-stack">${treatmentPlans.map((plan) => `<article class="offline-record record-deletable"><span class="record-icon">🦷</span><span class="patient-copy"><strong>${escapeHtml(plan.patient)}</strong><small>${escapeHtml(plan.treatment)} · ${escapeHtml(plan.status)}</small><span class="record-progress"><i style="width:${Math.round(plan.paid / plan.total * 100)}%"></i></span></span><span class="record-value">${currency(plan.paid)}<small>${currency(plan.total)} plan</small></span><button class="delete-button" data-delete-record="${plan.id}" data-record-kind="treatmentPlans" aria-label="${escapeHtml(plan.patient)} tedavi planını sil">Sil</button></article>`).join("") || `<p class="empty-inline">Tedavi planı yok.</p>`}</div>`,
      "Gerçekleşen tedaviler": `<div class="modal-grid"><button class="button button-primary" data-action="add-treatment">Tedavi kaydı ekle</button><div class="list-stack">${treatments.map((item) => `<article class="offline-record record-deletable"><span class="record-icon">🦷</span><span class="patient-copy"><strong>${escapeHtml(item.patient)}</strong><small>${escapeHtml(item.treatment)} · ${escapeHtml(item.doctor)} · ${escapeHtml(item.date)}</small></span><span class="record-value">${currency(item.fee || 0)}<small>${escapeHtml(item.status)}</small></span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="treatments">Sil</button></article>`).join("") || `<p class="empty-inline">Gerçekleşen tedavi kaydı yok.</p>`}</div></div>`,
      "Personel": `<div class="modal-grid"><button class="button button-primary" data-action="add-staff">Personel ekle</button><div class="list-stack">${staffRecords.map((item) => `<article class="offline-record record-deletable"><span class="record-icon">👤</span><span class="patient-copy"><strong>${escapeHtml(item.fullName)}</strong><small>${escapeHtml(item.roleLabel)} · ${escapeHtml(item.workingHours || "Saat belirtilmedi")}</small></span><span class="record-state">${item.active !== false ? "Aktif" : "Pasif"}</span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="staffRecords">Sil</button></article>`).join("") || `<p class="empty-inline">Personel kaydı yok.</p>`}</div></div>`,
      "Sağlık turizmi": `<div class="modal-grid"><button class="button button-primary" data-action="add-lead">Yeni lead ekle</button><div class="list-stack">${hotLeads.map((lead) => `<article class="opportunity-card record-deletable"><span class="score-badge">${lead.score}</span><span class="patient-copy"><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.country)} · ${escapeHtml(lead.treatment)}</small></span><a class="mini-action" href="tel:${escapeHtml(lead.phone.replace(/\s+/g, ""))}">Ara</a><button class="delete-button" data-delete-record="${lead.id}" data-record-kind="hotLeads" aria-label="${escapeHtml(lead.name)} lead kaydını sil">Sil</button></article>`).join("") || `<p class="empty-inline">Lead kaydı yok.</p>`}</div></div>`,
      "Stok": `<div class="list-stack">${stockItems.map((item) => { const critical = item.amount < item.minimum; return `<article class="offline-record record-deletable"><span class="transaction-icon ${critical ? "expense" : ""}">${critical ? "!" : "✓"}</span><span class="patient-copy"><strong>${escapeHtml(item.name)}</strong><small>Minimum ${item.minimum} ${escapeHtml(item.unit)}</small></span><span class="record-value ${critical ? "critical" : ""}">${item.amount}<small>${escapeHtml(item.unit)}</small></span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="stockItems" aria-label="${escapeHtml(item.name)} stok kaydını sil">Sil</button></article>`; }).join("") || `<p class="empty-inline">Stok kaydı yok.</p>`}</div>`,
      "İletişim": `<div class="modal-grid"><button class="button button-primary" data-action="add-communication">İletişim kaydı ekle</button><div class="list-stack">${communicationLog.map((item) => `<article class="offline-record record-deletable"><span class="record-channel">${escapeHtml(item.channel.slice(0, 1))}</span><span class="patient-copy"><strong>${escapeHtml(item.patient)} · ${escapeHtml(item.channel)}</strong><small>${escapeHtml(item.message)}</small></span><span class="record-state">${escapeHtml(item.status)}</span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="communicationLog" aria-label="${escapeHtml(item.patient)} iletişim kaydını sil">Sil</button></article>`).join("") || `<p class="empty-inline">İletişim kaydı yok.</p>`}</div><p class="modal-note">Çevrimdışı modda geçmiş ve taslaklar görüntülenir. Gerçek WhatsApp, SMS ve e-posta gönderimi canlı bağlantı ister.</p></div>`,
      "Anketler": `<div class="modal-grid"><div class="modal-actions"><button class="button button-primary" data-action="add-survey">Anket oluştur</button><button class="button button-secondary" data-action="add-survey-response">Yanıt ekle</button></div><div class="list-stack">${surveys.map((item) => `<article class="offline-record record-deletable"><span class="record-icon">★</span><span class="patient-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description || "Açıklama yok")} · ${surveyResponses.filter((response) => Number(response.surveyId) === Number(item.id)).length} yanıt</small></span><span class="record-state">${item.active !== false ? "Aktif" : "Kapalı"}</span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="surveys">Sil</button></article>`).join("") || `<p class="empty-inline">Anket yok.</p>`}</div><div class="history-list">${surveyResponses.slice(0, 10).map((item) => `<article><i>${item.score}</i><span><strong>${escapeHtml(item.patient)} · ${escapeHtml(item.survey || "Anket")}</strong><small>${escapeHtml(item.date || "Şimdi")}</small><p>${escapeHtml(item.comment || "Yorum yok")}</p></span></article>`).join("")}</div></div>`,
      "Recall": `<div class="modal-grid"><button class="button button-primary" data-action="add-recall">Takip ekle</button><div class="list-stack">${recalls.map((item) => `<article class="offline-record record-deletable"><span class="record-icon">↻</span><span class="patient-copy"><strong>${escapeHtml(item.patient)}</strong><small>${escapeHtml(item.reason)} · ${escapeHtml(item.dueDate)}</small></span><span class="record-state">${escapeHtml(item.status)}</span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="recalls">Sil</button></article>`).join("") || `<p class="empty-inline">Takip kaydı yok.</p>`}</div></div>`,
      "Raporlar": `<div class="modal-grid"><div class="finance-stats"><article class="finance-stat"><span>Tahsilat</span><strong>${currency(paidIncome)}</strong><small>Ödenmiş gelir</small></article><article class="finance-stat"><span>Net akış</span><strong>${currency(paidIncome - expenses)}</strong><small>${currency(expenses)} gider</small></article></div><div class="finance-stats"><article class="finance-stat"><span>Bekleyen</span><strong>${currency(pendingTotal)}</strong><small>Tahsil edilecek</small></article><article class="finance-stat"><span>Stok değeri</span><strong>${currency(stockValue)}</strong><small>${criticalStock} kritik ürün</small></article></div><div class="finance-stats"><article class="finance-stat"><span>Hasta</span><strong>${state.patients.length}</strong><small>Yerel kayıt</small></article><article class="finance-stat"><span>Randevu</span><strong>${state.appointments.length}</strong><small>${completedAppointments} tamamlandı · ${noShowAppointments} gelmedi</small></article></div><section class="patient-section"><div class="patient-section-title"><strong>Hekim performansı</strong><span>${doctorCounts.length}</span></div><div class="history-list">${doctorCounts.map(([doctor, count]) => `<article><i>👨‍⚕️</i><span><strong>${escapeHtml(doctor)}</strong><small>${count} randevu</small></span></article>`).join("") || `<p class="empty-inline">Hekim verisi yok.</p>`}</div></section><section class="patient-section"><div class="patient-section-title"><strong>Tedavi dağılımı</strong><span>${treatmentCounts.length}</span></div><div class="history-list">${treatmentCounts.slice(0, 8).map(([treatment, count]) => `<article><i>🦷</i><span><strong>${escapeHtml(treatment)}</strong><small>${count} kayıt</small></span></article>`).join("") || `<p class="empty-inline">Tedavi verisi yok.</p>`}</div></section><button class="button button-primary" data-go="finance">Finans ayrıntısını aç</button></div>`,
      "Dijital onam": `<div class="list-stack">${consentRecords.map((item) => `<article class="offline-record record-deletable"><span class="transaction-icon ${item.status === "İmzalandı" ? "" : "pending"}">${item.status === "İmzalandı" ? "✓" : "!"}</span><span class="patient-copy"><strong>${escapeHtml(item.patient)}</strong><small>${escapeHtml(item.form)} · ${escapeHtml(item.date)}</small></span><span class="record-state">${escapeHtml(item.status)}</span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="consentRecords" aria-label="${escapeHtml(item.patient)} onam kaydını sil">Sil</button></article>`).join("") || `<p class="empty-inline">Onam kaydı yok.</p>`}<p class="modal-note">Kimlik doğrulamalı imza gönderimi ve yasal sunucu kaydı bağlantı gerektirir.</p></div>`,
      "Çöp Kutusu": `<div class="modal-grid"><p class="modal-note">Silinen kayıtlar 30 gün burada saklanır. Süre dolunca otomatik ve kalıcı olarak temizlenir.</p><div class="list-stack">${trashItems.map((item) => `<article class="trash-record"><span class="record-icon">♻</span><span class="patient-copy"><strong>${escapeHtml(item.label)}</strong><small>${trashDaysLeft(item)} gün kaldı</small></span><button class="mini-action" data-restore-trash="${item.id}">Geri yükle</button><button class="delete-button" data-purge-trash="${item.id}" aria-label="${escapeHtml(item.label)} kaydını kalıcı sil">Kalıcı sil</button></article>`).join("") || `<p class="empty-inline">Çöp Kutusu boş.</p>`}</div>${trashItems.length ? `<button class="button button-secondary" data-empty-trash>Çöp Kutusunu boşalt</button>` : ""}</div>`
    };
    const routes = { "Tedavi planları": "treatment-plans", "Gerçekleşen tedaviler": "treatments", Personel: "staff", "Sağlık turizmi": "tourism/leads", "İletişim": "communication", Anketler: "surveys", Recall: "recalls", "Raporlar": "reports", "Dijital onam": "consents" };
    const serverUrl = previewMode ? "" : storage.get("clinicnova.serverUrl", "");
    const liveButton = serverUrl ? `<button class="button button-secondary" data-open-portal="/dashboard/${escapeHtml(routes[name] || "")}">Canlı panelde aç</button>` : "";
    openModal("YEREL ÇALIŞMA", name, `<div class="modal-grid">${moduleContent[name] || `<p class="modal-note">Bu modül henüz yerel kayda sahip değil.</p>`}${liveButton}</div>`);
  }

  function openNotifications() {
    if (!previewMode) storage.set("clinicnova.notificationsRead", true);
    $("#notificationDot").hidden = true;
    openModal("BİLDİRİMLER", "Bugün sizden beklenenler", `<div class="list-stack">
      <button class="patient-card action-card" data-module="Stok"><span class="transaction-icon expense">!</span><span class="patient-copy"><strong>Stok seviyesi kritik</strong><small>Anestezi kartuşu minimum seviyenin altında.</small></span><svg><use href="#i-chevron"/></svg></button>
      <button class="patient-card action-card" data-transaction-filter="PENDING"><span class="transaction-icon pending">!</span><span class="patient-copy"><strong>Tahsilat gecikmesi</strong><small>2 hastanın ödeme planı bugün aksiyon bekliyor.</small></span><svg><use href="#i-chevron"/></svg></button>
      <button class="patient-card action-card" data-action="opportunities"><span class="transaction-icon">↗</span><span class="patient-copy"><strong>Yeni sağlık turizmi lead’i</strong><small>UK kaynaklı implant talebi yüksek skorlu görünüyor.</small></span><svg><use href="#i-chevron"/></svg></button>
    </div>`);
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
    $("span", badge).textContent = syncQueue.length ? `${syncQueue.length} kayıt bekliyor` : connected && online ? "Senkronlandı" : online ? "Yerel kayıt" : "Çevrimdışı hazır";
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
    state.appointmentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    state.activeView = "home";
    hotLeads = JSON.parse(JSON.stringify(defaultHotLeads));
    treatmentPlans = JSON.parse(JSON.stringify(defaultTreatmentPlans));
    stockItems = JSON.parse(JSON.stringify(defaultStockItems));
    stockRecipes = JSON.parse(JSON.stringify(defaultStockRecipes));
    clinicDoctors = JSON.parse(JSON.stringify(defaultClinicDoctors));
    clinicChairs = JSON.parse(JSON.stringify(defaultClinicChairs));
    communicationLog = JSON.parse(JSON.stringify(defaultCommunicationLog));
    consentRecords = JSON.parse(JSON.stringify(defaultConsentRecords));
    treatments = []; staffRecords = []; surveys = []; surveyResponses = []; recalls = [];
    trashItems = [];
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
      storage.set("clinicnova.serverUrl", serverUrl);
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

  function openLivePortal(path = "/dashboard") {
    if (previewMode) return showToast("Canlı panel inceleme modunda kapalıdır.");
    const serverUrl = storage.get("clinicnova.serverUrl", "");
    if (!serverUrl) return showToast("Önce ClinicNova sunucusuna bağlanın.");
    if (!navigator.onLine) return showToast("Canlı panel için internet bağlantısı gerekir.");
    if (typeof window.ClinicNovaNative?.openPortal === "function") window.ClinicNovaNative.openPortal(serverUrl, path);
    else window.location.href = `${serverUrl.replace(/\/$/, "")}${path}`;
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
    window.ClinicNovaNative.sync(serverUrl, JSON.stringify({ deviceId, operations }));
  }

  function applyServerSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    if (snapshot.permissions && typeof snapshot.permissions === "object") { serverPermissions = snapshot.permissions; storage.set("clinicnova.serverPermissions", serverPermissions); }
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
      SURVEY: Array.isArray(snapshot.surveys) ? snapshot.surveys : [],
      SURVEY_RESPONSE: Array.isArray(snapshot.surveyResponses) ? snapshot.surveyResponses : [],
      COMMUNICATION: Array.isArray(snapshot.communication) ? snapshot.communication : [],
      RECALL: Array.isArray(snapshot.recalls) ? snapshot.recalls : [],
      LEAD: Array.isArray(snapshot.leads) ? snapshot.leads : []
    };
    const serverIds = Object.fromEntries(Object.entries(collections).map(([type, items]) => [type, new Map(items.map((item) => [String(item.serverId), item.id]))]));
    for (const [type, items] of Object.entries(collections)) {
      for (const item of items) if (item.serverId) syncMap[`${type}:${item.id}`] = String(item.serverId);
    }
    for (const stockItem of collections.STOCK_ITEM) {
      for (const offer of stockItem.offers || []) if (offer.serverId) syncMap[`STOCK_OFFER:${offer.id}`] = String(offer.serverId);
    }
    const localIdForServer = (type, localId) => {
      const mappedServerId = syncMap[`${type}:${localId}`];
      return mappedServerId ? serverIds[type]?.get(String(mappedServerId)) ?? localId : localId;
    };
    const pendingIds = (type) => new Set(syncQueue.filter((item) => item.entityType === type).map((item) => String(item.clientId)));
    const retainPending = (items, type) => items.filter((item) => pendingIds(type).has(String(item.id)));
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
    const pendingSurveys = retainPending(surveys, "SURVEY");
    const pendingSurveyResponses = retainPending(surveyResponses, "SURVEY_RESPONSE").map((item) => ({ ...mapPatientReference(item), surveyId: localIdForServer("SURVEY", item.surveyId) }));
    const pendingCommunication = retainPending(communicationLog, "COMMUNICATION").map(mapPatientReference);
    const pendingRecalls = retainPending(recalls, "RECALL").map(mapPatientReference);
    const pendingLeads = retainPending(hotLeads, "LEAD");

    state.patients = [...pendingPatients, ...collections.PATIENT];
    state.appointments = [...pendingAppointments, ...collections.APPOINTMENT];
    state.transactions = [...pendingPayments, ...collections.PAYMENT];
    treatmentPlans = [...pendingPlans, ...collections.TREATMENT_PLAN];
    stockItems = [...pendingStocks, ...collections.STOCK_ITEM];
    stockRecipes = [...pendingRecipes, ...collections.STOCK_RECIPE];
    clinicDoctors = [...pendingDoctors, ...collections.DOCTOR];
    treatments = [...pendingTreatments, ...collections.TREATMENT];
    staffRecords = [...pendingStaff, ...collections.STAFF];
    consentRecords = [...pendingConsents, ...collections.CONSENT];
    surveys = [...pendingSurveys, ...collections.SURVEY];
    surveyResponses = [...pendingSurveyResponses, ...collections.SURVEY_RESPONSE];
    communicationLog = [...pendingCommunication, ...collections.COMMUNICATION];
    recalls = [...pendingRecalls, ...collections.RECALL];
    hotLeads = [...pendingLeads, ...collections.LEAD];
    const syncedTreatmentHistory = {};
    for (const item of treatments) (syncedTreatmentHistory[item.patientId] ||= []).push({ id: item.id, date: item.date, treatment: item.treatment, doctor: item.doctor, note: item.description || statusLabel(item.status), syncedTreatment: true });
    for (const [patientId, entries] of Object.entries(state.treatmentHistory)) {
      const localOnly = entries.filter((item) => !item.syncedTreatment && !treatments.some((treatment) => Number(treatment.id) === Number(item.id)));
      if (localOnly.length) (syncedTreatmentHistory[patientId] ||= []).push(...localOnly);
    }
    state.treatmentHistory = syncedTreatmentHistory;
    if (snapshot.clinicConfig) {
      clinicChairs = Array.isArray(snapshot.clinicConfig.chairs) ? snapshot.clinicConfig.chairs : clinicChairs;
      const account = localAccount() || {};
      if (snapshot.clinicConfig.clinicName) account.clinicName = snapshot.clinicConfig.clinicName;
      storage.set("clinicnova.localAccount", account); applyLocalIdentity(account);
    }
    storage.set("clinicnova.lastPullAt", Date.now());
    saveData();
    renderAll();
  }

  window.ClinicNovaSyncResult = (status, responseText) => {
    syncing = false;
    let response = {};
    try { response = JSON.parse(responseText || "{}"); } catch { response = {}; }
    if (status === 401 || status === 403 || (status === 200 && !Array.isArray(response.results))) {
      showToast("Sunucu oturumu gerekli. Sunucuya bağlan bölümünden giriş yapın.");
      updateNetworkBadge();
      return;
    }
    if (status < 200 || status >= 300) {
      showToast(response.error || "Sunucuya ulaşılamadı; kayıtlar cihazda bekliyor.");
      updateNetworkBadge();
      scheduleSync(30_000);
      return;
    }
    const byId = new Map(syncQueue.map((item) => [item.operationId, item]));
    const syncedIds = new Set();
    for (const result of response.results || []) {
      if (result.status !== "synced") continue;
      syncedIds.add(result.operationId);
      const operation = byId.get(result.operationId);
      if (operation && result.serverEntityId) syncMap[`${operation.entityType}:${operation.clientId}`] = result.serverEntityId;
    }
    syncQueue = syncQueue.filter((item) => !syncedIds.has(item.operationId));
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
      id: Date.now() + index, seller: String(offer.seller || "").trim(), unitPrice: Number(offer.unitPrice), shippingPrice: Number(offer.shippingPrice || 0),
      productUrl: String(offer.productUrl || "").trim(), inStock: offer.inStock !== false, checkedAt, source: "online"
    })).filter((offer) => offer.seller.length >= 2 && Number.isFinite(offer.unitPrice) && offer.unitPrice > 0 && Number.isFinite(offer.shippingPrice) && offer.shippingPrice >= 0 && offer.productUrl.startsWith("https://"));
    item.offers = offers.sort((left, right) => left.unitPrice + left.shippingPrice - right.unitPrice - right.shippingPrice);
    offers.forEach((offer) => queueCreate("STOCK_OFFER", offer.id, { itemId: String(item.id), seller: offer.seller, unitPrice: offer.unitPrice, shippingPrice: offer.shippingPrice, productUrl: offer.productUrl, inStock: offer.inStock }));
    saveData(); openStockDetail(item.id);
    showToast(offers.length ? `${offers.length} internet teklifi güncellendi.` : "Bu ürün için satışta teklif bulunamadı.");
  };

  function configureEntryMode() {
    if (demoMode) {
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
    const creating = !account;
    $("#serverUrlField").hidden = true;
    $("#previewDemoButton").hidden = false;
    $("#serverLoginButton").hidden = false;
    $("#recoveryButton").hidden = creating;
    $("#localSetupFields").hidden = !creating;
    $("#serverUrl").required = false;
    $("#demoLoginFields").hidden = false;
    $("#loginEmail").required = true;
    $("#loginPassword").required = true;
    $("#loginPassword").minLength = 10;
    $("#loginPassword").autocomplete = creating ? "new-password" : "current-password";
    $("#localClinicName").required = creating;
    $("#localAdminName").required = creating;
    const configuredUrl = mobileConfig.serverUrl || storage.get("clinicnova.serverUrl", "");
    $("#serverUrl").value = configuredUrl;
    $("#loginEmail").value = account?.email || "";
    $("#loginTitle").textContent = creating ? "Yerel yönetici hesabını oluşturun." : `${account.clinicName} hesabına giriş`;
    $("#loginDescription").textContent = creating ? "Bu hesap internet olmasa da cihazdaki klinik kayıtlarını korur." : "İnternet olmadan çalışabilir; bağlantı geldiğinde sunucuyla eşitlenir.";
    $("#loginSubmitLabel").textContent = creating ? "Hesabı oluştur ve başla" : "Çevrimdışı giriş yap";
    $("#loginSecureNote").textContent = "Parolanın kendisi saklanmaz. Güvenli özeti cihazda tutulur; Windows ve Mac'te yerel kasa ayrıca işletim sistemiyle şifrelenir.";
  }

  $("#todayLabel").textContent = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(today);
  $("#versionLabel").textContent = `ClinicNova ${mobileConfig.platformLabel || "Android"} · Sürüm ${mobileConfig.appVersion || "yerel"}`;
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!demoMode) {
      const submit = event.submitter;
      if (submit) submit.disabled = true;
      try {
        const email = $("#loginEmail").value.trim().toLocaleLowerCase("tr-TR");
        const password = $("#loginPassword").value;
        let account = localAccount();
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
          storage.set("clinicnova.localAccount", account);
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
          storage.set("clinicnova.localAccount", account);
          return showToast("E-posta veya parola yanlış.");
        }
        account.failures = 0; account.lockedUntil = 0;
        storage.set("clinicnova.localAccount", account);
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
    const target = event.target.closest("button, [data-go], [data-action]");
    if (!target) return;
    if (target.dataset.go) { closeModal(); return navigate(target.dataset.go); }
    if (target.dataset.calendarStep) {
      const step = Number(target.dataset.calendarStep);
      state.appointmentMonth = new Date(state.appointmentMonth.getFullYear(), state.appointmentMonth.getMonth() + step, 1);
      renderAppointments(); return;
    }
    if (target.dataset.date) {
      state.selectedDate = target.dataset.date;
      const selected = new Date(`${state.selectedDate}T12:00:00`);
      state.appointmentMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
      renderAppointments(); return;
    }
    if (target.dataset.financeFilter) { state.transactionFilter = target.dataset.financeFilter; renderFinance(); return; }
    if (target.dataset.consentFilter) { state.consentFilter = target.dataset.consentFilter; renderConsents(); return; }
    if (target.dataset.payBalance) return openBalancePayment(target.dataset.payBalance);
    if (target.dataset.financeTransaction) return openFinanceDetail(target.dataset.financeTransaction);
    if (target.dataset.consent) return openConsentDetail(target.dataset.consent);
    if (target.dataset.editConsentStatus) return openConsentStatusEditor(target.dataset.editConsentStatus);
    if (target.dataset.filter) { state.patientFilter = target.dataset.filter; $$("#patientFilters button").forEach((button) => button.classList.toggle("active", button === target)); renderPatients(); return; }
    if (target.dataset.restoreTrash) {
      const trashId = Number(target.dataset.restoreTrash);
      const trashItem = trashItems.find((item) => Number(item.id) === trashId);
      if (!trashItem) return;
      const payload = trashItem.payload;
      if (trashItem.kind === "patientBundle") {
        state.patients.unshift(payload.patient);
        state.appointments.push(...payload.appointments);
        state.transactions.push(...payload.transactions);
        treatmentPlans.push(...(payload.treatmentPlans || []));
        treatments.push(...(payload.treatments || []));
        recalls.push(...(payload.recalls || []));
        surveyResponses.push(...(payload.surveyResponses || []));
        communicationLog.push(...(payload.communication || []));
        consentRecords.push(...(payload.consents || []));
        if (payload.treatmentHistory?.length) state.treatmentHistory[payload.patient.id] = payload.treatmentHistory;
        if (payload.media?.length) state.patientMedia[payload.patient.id] = payload.media;
        queueCreate("PATIENT", payload.patient.id, patientPayload(payload.patient));
        payload.appointments.forEach((item) => queueCreate("APPOINTMENT", item.id, appointmentPayload(item)));
        payload.transactions.filter((item) => item.patientId).forEach((item) => queueCreate("PAYMENT", item.id, paymentPayload(item)));
        (payload.treatmentPlans || []).forEach((item) => queueCreate("TREATMENT_PLAN", item.id, treatmentPlanPayload(item)));
        (payload.treatments || []).forEach((item) => queueCreate("TREATMENT", item.id, treatmentPayload(item)));
        (payload.recalls || []).forEach((item) => queueCreate("RECALL", item.id, recallPayload(item)));
        (payload.surveyResponses || []).forEach((item) => queueCreate("SURVEY_RESPONSE", item.id, surveyResponsePayload(item)));
        (payload.communication || []).forEach((item) => queueCreate("COMMUNICATION", item.id, communicationPayload(item)));
      }
      if (trashItem.kind === "appointment") { state.appointments.push(payload); queueCreate("APPOINTMENT", payload.id, appointmentPayload(payload)); }
      if (trashItem.kind === "transaction") { state.transactions.unshift(payload); if (payload.patientId) queueCreate("PAYMENT", payload.id, paymentPayload(payload)); }
      if (trashItem.kind === "treatmentHistory") {
        (state.treatmentHistory[payload.patientId] ||= []).splice(payload.index, 0, payload.item);
        if (payload.treatmentRecord) { treatments.unshift(payload.treatmentRecord); queueCreate("TREATMENT", payload.treatmentRecord.id, treatmentPayload(payload.treatmentRecord)); }
      }
      if (trashItem.kind === "media") (state.patientMedia[payload.patientId] ||= []).unshift(payload.item);
      if (trashItem.kind === "treatmentPlans") { treatmentPlans.unshift(payload); queueCreate("TREATMENT_PLAN", payload.id, treatmentPlanPayload(payload)); }
      if (trashItem.kind === "hotLeads") { hotLeads.unshift(payload); queueCreate("LEAD", payload.id, leadPayload(payload)); }
      if (trashItem.kind === "stockItems") { stockItems.unshift(payload); queueCreate("STOCK_ITEM", payload.id, stockItemPayload(payload)); }
      if (trashItem.kind === "stockOffer") {
        const stockItem = stockItems.find((item) => Number(item.id) === Number(payload.stockId));
        if (stockItem) {
          (stockItem.offers ||= []).push(payload.offer);
          queueCreate("STOCK_OFFER", payload.offer.id, { itemId: String(stockItem.id), seller: payload.offer.seller, unitPrice: payload.offer.unitPrice, shippingPrice: payload.offer.shippingPrice || 0, productUrl: payload.offer.productUrl, inStock: payload.offer.inStock !== false });
        }
      }
      if (trashItem.kind === "communicationLog") { communicationLog.unshift(payload); queueCreate("COMMUNICATION", payload.id, communicationPayload(payload)); }
      if (trashItem.kind === "consentRecords") { consentRecords.unshift(payload); queueCreate("CONSENT", payload.id, consentPayload(payload)); }
      if (trashItem.kind === "treatments") { treatments.unshift(payload); queueCreate("TREATMENT", payload.id, treatmentPayload(payload)); }
      if (trashItem.kind === "staffRecords") { staffRecords.unshift(payload); queueCreate("STAFF", payload.id, staffPayload(payload)); }
      if (trashItem.kind === "surveys") { surveys.unshift(payload); queueCreate("SURVEY", payload.id, surveyPayload(payload)); }
      if (trashItem.kind === "recalls") { recalls.unshift(payload); queueCreate("RECALL", payload.id, recallPayload(payload)); }
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
    if (target.dataset.deleteRecord) {
      const id = Number(target.dataset.deleteRecord);
      const kind = target.dataset.recordKind;
      const moduleByKind = { treatmentPlans: "Tedavi planları", treatments: "Gerçekleşen tedaviler", staffRecords: "Personel", hotLeads: "Sağlık turizmi", stockItems: "Stok", communicationLog: "İletişim", consentRecords: "Dijital onam", surveys: "Anketler", recalls: "Recall" };
      if (!moduleByKind[kind] || !window.confirm("Bu kayıt silinsin mi?")) return;
      const sourceByKind = { treatmentPlans, treatments, staffRecords, hotLeads, stockItems, communicationLog, consentRecords, surveys, recalls };
      const deletedRecord = sourceByKind[kind].find((item) => item.id === id);
      if (deletedRecord) moveToTrash(kind, deletedRecord.name || deletedRecord.fullName || deletedRecord.title || deletedRecord.patient || deletedRecord.form || deletedRecord.reason || "Silinen kayıt", deletedRecord);
      if (kind === "treatmentPlans") treatmentPlans = treatmentPlans.filter((item) => item.id !== id);
      if (kind === "treatments") { treatments = treatments.filter((item) => item.id !== id); queueDelete("TREATMENT", id); }
      if (kind === "staffRecords") { staffRecords = staffRecords.filter((item) => item.id !== id); queueDelete("STAFF", id); }
      if (kind === "hotLeads") hotLeads = hotLeads.filter((item) => item.id !== id);
      if (kind === "stockItems") stockItems = stockItems.filter((item) => item.id !== id);
      if (kind === "communicationLog") communicationLog = communicationLog.filter((item) => item.id !== id);
      if (kind === "consentRecords") consentRecords = consentRecords.filter((item) => item.id !== id);
      if (kind === "surveys") {
        const linkedResponses = surveyResponses.filter((item) => Number(item.surveyId) === id);
        linkedResponses.forEach((item) => queueDelete("SURVEY_RESPONSE", item.id));
        surveyResponses = surveyResponses.filter((item) => Number(item.surveyId) !== id);
        surveys = surveys.filter((item) => item.id !== id); queueDelete("SURVEY", id);
      }
      if (kind === "recalls") { recalls = recalls.filter((item) => item.id !== id); queueDelete("RECALL", id); }
      if (kind === "hotLeads") queueDelete("LEAD", id);
      if (kind === "communicationLog") queueDelete("COMMUNICATION", id);
      if (kind === "consentRecords") queueDelete("CONSENT", id);
      if (kind === "treatmentPlans") queueDelete("TREATMENT_PLAN", id);
      if (kind === "stockItems") queueDelete("STOCK_ITEM", id);
      const originalOpener = modalOpener;
      saveData();
      if (kind === "hotLeads") renderDashboard();
      if (kind === "consentRecords" && state.activeView === "consents") { renderConsents(); showToast("Onam kaydı silindi."); return; }
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
      const linkedRecalls = recalls.filter((item) => Number(item.patientId) === patientId);
      const linkedSurveyResponses = surveyResponses.filter((item) => Number(item.patientId) === patientId);
      const linkedCommunication = communicationLog.filter((item) => Number(item.patientId) === patientId);
      linkedAppointments.filter((item) => item.status === "COMPLETED").forEach((item) => { applyLocalStockForAppointment(item, "CANCELLED"); item.status = "CANCELLED"; });
      moveToTrash("patientBundle", patient.name, { patient, appointments: linkedAppointments, transactions: linkedTransactions, treatmentPlans: linkedPlans, consents: linkedConsents, treatments: linkedTreatments, recalls: linkedRecalls, surveyResponses: linkedSurveyResponses, communication: linkedCommunication, treatmentHistory: state.treatmentHistory[patientId] || [], media: state.patientMedia[patientId] || [] });
      linkedAppointments.forEach((item) => queueDelete("APPOINTMENT", item.id));
      linkedTransactions.forEach((item) => queueDelete("PAYMENT", item.id));
      linkedPlans.forEach((item) => queueDelete("TREATMENT_PLAN", item.id));
      linkedConsents.forEach((item) => queueDelete("CONSENT", item.id));
      linkedTreatments.forEach((item) => queueDelete("TREATMENT", item.id));
      linkedRecalls.forEach((item) => queueDelete("RECALL", item.id));
      linkedSurveyResponses.forEach((item) => queueDelete("SURVEY_RESPONSE", item.id));
      linkedCommunication.forEach((item) => queueDelete("COMMUNICATION", item.id));
      queueDelete("PATIENT", patientId);
      state.patients = state.patients.filter((item) => item.id !== patientId);
      state.appointments = state.appointments.filter((item) => item.patientId !== patientId);
      state.transactions = state.transactions.filter((item) => item.patientId !== patientId);
      treatmentPlans = treatmentPlans.filter((item) => Number(item.patientId) !== patientId);
      consentRecords = consentRecords.filter((item) => Number(item.patientId) !== patientId);
      treatments = treatments.filter((item) => Number(item.patientId) !== patientId);
      recalls = recalls.filter((item) => Number(item.patientId) !== patientId);
      surveyResponses = surveyResponses.filter((item) => Number(item.patientId) !== patientId);
      communicationLog = communicationLog.filter((item) => Number(item.patientId) !== patientId);
      delete state.treatmentHistory[patientId];
      delete state.patientMedia[patientId];
      saveData(); renderAll(); closeModal(); showToast("Hasta ve bağlı kayıtları silindi."); return;
    }
    if (target.dataset.deleteAppointment) {
      const appointmentId = Number(target.dataset.deleteAppointment);
      if (!window.confirm("Bu randevu silinsin mi?")) return;
      const deletedAppointment = state.appointments.find((item) => item.id === appointmentId);
      if (deletedAppointment?.status === "COMPLETED") { applyLocalStockForAppointment(deletedAppointment, "CANCELLED"); deletedAppointment.status = "CANCELLED"; }
      if (deletedAppointment) moveToTrash("appointment", `${patientById(deletedAppointment.patientId)?.name || "Hasta"} randevusu`, deletedAppointment);
      if (deletedAppointment) queueDelete("APPOINTMENT", appointmentId);
      state.appointments = state.appointments.filter((item) => item.id !== appointmentId);
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
      if (deletedTreatment) moveToTrash("treatmentHistory", `${patientById(patientId)?.name || "Hasta"} · ${deletedTreatment.treatment}`, { patientId, index, item: deletedTreatment, treatmentRecord: syncedTreatmentRecord });
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
    if (target.dataset.patient) return openPatientDetail(target.dataset.patient);
    if (target.dataset.appointment) return openAppointmentDetail(target.dataset.appointment);
    if (target.dataset.treatmentPlan) return openTreatmentPlanDetail(target.dataset.treatmentPlan);
    if (target.dataset.stockItem) return openStockDetail(target.dataset.stockItem);
    if (target.dataset.openPortal) return openLivePortal(target.dataset.openPortal);
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
      const stockResult = applyLocalStockForAppointment(appointment, nextStatus);
      if (!stockResult.ok) return showToast(stockResult.message);
      appointment.status = nextStatus;
      if (nextStatus === "COMPLETED" && previousStatus !== "COMPLETED") {
        const patient = patientById(appointment.patientId);
        (state.treatmentHistory[appointment.patientId] ||= []).unshift({ appointmentId: appointment.id, date: new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(today), treatment: appointment.treatment, doctor: appointment.doctor, note: `${appointment.duration} dakikalık randevu tamamlandı.${appointment.stockUsage?.length ? " Malzeme reçetesi stoktan işlendi." : ""}` });
        if (patient) patient.lastVisit = "Bugün";
      }
      if (previousStatus === "COMPLETED" && nextStatus !== "COMPLETED") state.treatmentHistory[appointment.patientId] = (state.treatmentHistory[appointment.patientId] || []).filter((item) => Number(item.appointmentId) !== Number(appointment.id));
      queueUpdate("APPOINTMENT", appointment.id, appointmentPayload(appointment));
      saveData(); renderAll(); closeModal(); showToast(stockResult.message); return;
    }
    if (target.hasAttribute("data-clear-local")) {
      if (!window.confirm("Bu cihazdaki tüm yerel klinik kayıtları ve bekleyen eşitleme işlemleri silinsin mi?")) return;
      state.patients = []; state.appointments = []; state.transactions = []; state.treatmentHistory = {}; state.patientMedia = {};
      hotLeads = []; treatmentPlans = []; stockItems = []; stockRecipes = []; communicationLog = []; consentRecords = []; treatments = []; staffRecords = []; surveys = []; surveyResponses = []; recalls = []; trashItems = [];
      syncQueue = []; syncMap = {}; storage.set("clinicnova.syncBootstrapComplete", true);
      saveData(); persistSyncState(); renderAll(); closeModal(); showToast("Yerel kayıtlar temizlendi."); return;
    }
    if (target.hasAttribute("data-reset-demo")) {
      state.patients = JSON.parse(JSON.stringify(defaultPatients));
      state.appointments = JSON.parse(JSON.stringify(defaultAppointments));
      state.transactions = JSON.parse(JSON.stringify(defaultTransactions));
      state.treatmentHistory = JSON.parse(JSON.stringify(defaultTreatmentHistory));
      state.patientMedia = {};
      hotLeads = JSON.parse(JSON.stringify(defaultHotLeads));
      treatmentPlans = JSON.parse(JSON.stringify(defaultTreatmentPlans));
      stockItems = JSON.parse(JSON.stringify(defaultStockItems));
      communicationLog = JSON.parse(JSON.stringify(defaultCommunicationLog));
      consentRecords = JSON.parse(JSON.stringify(defaultConsentRecords));
      treatments = []; staffRecords = []; surveys = []; surveyResponses = []; recalls = [];
      trashItems = [];
      state.transactionFilter = "ALL";
      state.consentFilter = "ALL";
      if (!previewMode) storage.set("clinicnova.notificationsRead", false);
      $("#notificationDot").hidden = false;
      saveData(); renderAll(); closeModal(); showToast("Demo verileri sıfırlandı."); return;
    }
    const action = target.dataset.action;
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
    if (action === "add-lead") return openAddLead();
    if (action === "add-communication") return openAddCommunication();
    if (action === "add-treatment") return openAddTreatment();
    if (action === "add-staff") return openAddStaff();
    if (action === "add-survey") return openAddSurvey();
    if (action === "add-survey-response") return openAddSurveyResponse();
    if (action === "add-recall") return openAddRecall();
    if (action === "clinic-management") return openClinicManagement();
    if (action === "add-doctor") return openAddDoctor();
    if (action === "add-chair") return openAddChair();
    if (action === "rename-clinic") return openRenameClinic();
    if (action === "profile") return openProfile();
    if (action === "opportunities") return openRevenueOpportunities();
    if (action === "finance-report") return openFinanceReport();
    if (action === "transaction-filter") return openTransactionFilter();
    if (action === "connect") return openConnection();
    if (action === "security") return openSecurity();
    if (action === "logout") {
      if (previewMode) return window.location.reload();
      storage.set("clinicnova.session", null); storage.set("clinicnova.previewSession", null); closeModal(); showLogin(); showToast("Oturum kapatıldı."); return;
    }
  });

  $("#patientSearch").addEventListener("input", (event) => { state.patientQuery = event.target.value; renderPatients(); });
  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-patient-media]");
    if (!input || !input.files?.[0]) return;
    const file = input.files[0];
    if (!file.type.startsWith("image/")) return showToast("Lütfen bir fotoğraf seçin.");
    if (file.size > 3 * 1024 * 1024) return showToast("Fotoğraf en fazla 3 MB olabilir.");
    const patientId = Number(input.dataset.patientMedia);
    const reader = new FileReader();
    reader.onload = () => {
      const items = state.patientMedia[patientId] || [];
      items.unshift({ id: Date.now(), kind: input.dataset.mediaKind || "Fotoğraf", date: "Şimdi", dataUrl: reader.result });
      state.patientMedia[patientId] = items.slice(0, 8);
      saveData();
      openPatientDetail(patientId);
      showToast(`${input.dataset.mediaKind || "Fotoğraf"} fotoğrafı eklendi.`);
    };
    reader.onerror = () => showToast("Fotoğraf okunamadı.");
    reader.readAsDataURL(file);
  });
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeModal(); });
  $("#notificationButton").addEventListener("click", openNotifications);
  $("#themeButton").addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    storage.set("clinicnova.theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
  });
  window.addEventListener("online", () => { updateNetworkBadge(); syncPending(); });
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
    if (event.target.id === "patientEditForm") {
      event.preventDefault(); const form = new FormData(event.target); const patient = patientById(form.get("patientId")); if (!patient) return showToast("Hasta bulunamadı.");
      const name = String(form.get("name") || "").trim(); const phone = String(form.get("phone") || "").trim();
      if (name.length < 2 || phone.replace(/\D/g, "").length < 7) return showToast("Hasta adı ve telefonu kontrol edin.");
      Object.assign(patient, { name, phone, email: String(form.get("email") || "").trim(), nationalId: String(form.get("nationalId") || "").trim(), birthDate: String(form.get("birthDate") || ""), gender: String(form.get("gender") || "UNSPECIFIED"), address: String(form.get("address") || "").trim(), allergies: String(form.get("allergies") || "").trim(), chronicDiseases: String(form.get("chronicDiseases") || "").trim(), medications: String(form.get("medications") || "").trim(), tag: String(form.get("tag") || "NEW"), treatment: String(form.get("treatment") || "").trim(), note: String(form.get("note") || "").trim() });
      queueUpdate("PATIENT", patient.id, patientPayload(patient)); saveData(); renderAll(); openPatientDetail(patient.id); showToast("Hasta bilgileri güncellendi."); return;
    }
    if (event.target.id === "treatmentForm") {
      event.preventDefault(); const form = new FormData(event.target); const patient = patientById(form.get("patientId"));
      const record = { id: Date.now(), patientId: patient?.id, patient: patient?.name || "", doctor: String(form.get("doctor") || ""), tooth: String(form.get("tooth") || ""), treatment: String(form.get("treatment") || "").trim(), description: String(form.get("description") || "").trim(), fee: Number(form.get("fee")), status: String(form.get("status") || "COMPLETED"), date: String(form.get("date") || todayIso), branch: currentClinicName() };
      if (!patient || record.treatment.length < 2 || !record.doctor || !Number.isFinite(record.fee) || record.fee < 0) return showToast("Tedavi bilgilerini kontrol edin.");
      treatments.unshift(record); queueCreate("TREATMENT", record.id, treatmentPayload(record)); saveData(); openModule("Gerçekleşen tedaviler"); showToast("Tedavi kaydı eklendi."); return;
    }
    if (event.target.id === "staffForm") {
      event.preventDefault(); const form = new FormData(event.target); const record = { id: Date.now(), fullName: String(form.get("fullName") || "").trim(), roleLabel: String(form.get("roleLabel") || "").trim(), phone: String(form.get("phone") || "").trim(), email: String(form.get("email") || "").trim().toLowerCase(), workingHours: String(form.get("workingHours") || "").trim(), compensation: String(form.get("compensation") || "").trim(), active: form.get("active") === "on" };
      if (record.fullName.length < 2 || record.roleLabel.length < 2 || (record.email && !record.email.includes("@"))) return showToast("Personel bilgilerini kontrol edin.");
      staffRecords.unshift(record); queueCreate("STAFF", record.id, staffPayload(record)); saveData(); openModule("Personel"); showToast("Personel kaydedildi."); return;
    }
    if (event.target.id === "surveyForm") {
      event.preventDefault(); const form = new FormData(event.target); const record = { id: Date.now(), title: String(form.get("title") || "").trim(), description: String(form.get("description") || "").trim(), active: form.get("active") === "on" };
      if (record.title.length < 2) return showToast("Anket başlığını kontrol edin.");
      surveys.unshift(record); queueCreate("SURVEY", record.id, surveyPayload(record)); saveData(); openModule("Anketler"); showToast("Anket oluşturuldu."); return;
    }
    if (event.target.id === "surveyResponseForm") {
      event.preventDefault(); const form = new FormData(event.target); const survey = surveys.find((item) => Number(item.id) === Number(form.get("surveyId"))); const patient = patientById(form.get("patientId"));
      const record = { id: Date.now(), surveyId: survey?.id, patientId: patient?.id, patient: patient?.name || "", survey: survey?.title || "", score: Number(form.get("score")), comment: String(form.get("comment") || "").trim(), date: new Date().toISOString() };
      if (!survey || !patient || !Number.isInteger(record.score) || record.score < 1 || record.score > 5) return showToast("Anket yanıtını kontrol edin.");
      surveyResponses.unshift(record); queueCreate("SURVEY_RESPONSE", record.id, surveyResponsePayload(record)); saveData(); openModule("Anketler"); showToast("Anket yanıtı kaydedildi."); return;
    }
    if (event.target.id === "recallForm") {
      event.preventDefault(); const form = new FormData(event.target); const patient = patientById(form.get("patientId"));
      const record = { id: Date.now(), patientId: patient?.id, patient: patient?.name || "", reason: String(form.get("reason") || "").trim(), dueDate: String(form.get("dueDate") || ""), status: String(form.get("status") || "OPEN"), notes: String(form.get("notes") || "").trim() };
      if (!patient || record.reason.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(record.dueDate)) return showToast("Takip bilgilerini kontrol edin.");
      recalls.unshift(record); queueCreate("RECALL", record.id, recallPayload(record)); saveData(); openModule("Recall"); showToast("Hasta takibi kaydedildi."); return;
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
      const recordId = Date.now();
      const record = { id: recordId, date: new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`)), treatment, doctor, note, manual: true };
      (state.treatmentHistory[patient.id] ||= []).unshift(record);
      const treatmentRecord = { id: recordId, patientId: patient.id, patient: patient.name, doctor, tooth: "", treatment, description: note, fee: 0, paymentPlan: null, status: "COMPLETED", date, branch: currentClinicName() };
      treatments.unshift(treatmentRecord); queueCreate("TREATMENT", treatmentRecord.id, treatmentPayload(treatmentRecord));
      patient.lastVisit = date === todayIso ? "Bugün" : patient.lastVisit;
      saveData(); openPatientDetail(patient.id); showToast("Tedavi geçmişine kayıt eklendi."); return;
    }
    if (event.target.id === "leadForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const lead = { id: Date.now(), name: String(form.get("name") || "").trim(), country: String(form.get("country") || "").trim(), phone: String(form.get("phone") || "").trim(), treatment: String(form.get("treatment") || "").trim(), score: Number(form.get("score")) };
      if (lead.name.length < 2 || lead.country.length < 2 || lead.phone.replace(/\D/g, "").length < 7 || lead.treatment.length < 2 || !Number.isInteger(lead.score) || lead.score < 0 || lead.score > 100) return showToast("Lead bilgilerini ve 0-100 arasındaki puanı kontrol edin.");
      hotLeads.unshift(lead); queueCreate("LEAD", lead.id, leadPayload(lead)); saveData(); renderDashboard(); openModule("Sağlık turizmi"); showToast("Yeni lead kaydedildi."); return;
    }
    if (event.target.id === "communicationForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patientName = String(form.get("patient") || "").trim();
      const patient = state.patients.find((item) => item.name === patientName);
      const record = { id: Date.now(), patientId: patient?.id || null, patient: patientName, channel: String(form.get("channel") || "Klinik içi not"), status: String(form.get("status") || "Yerel taslak"), message: String(form.get("message") || "").trim(), date: "Şimdi" };
      if (record.patient.length < 2 || record.message.length < 3) return showToast("Kişi ve iletişim notunu kontrol edin.");
      communicationLog.unshift(record); queueCreate("COMMUNICATION", record.id, communicationPayload(record)); saveData(); openModule("İletişim"); showToast("İletişim kaydı eklendi."); return;
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
      item.amount = Number(item.amount || 0) + amount;
      item.remainingAmount = Math.max(0, Number(item.totalAmount || item.amount) - item.amount);
      item.paidInstallments = Math.min(Number(item.installmentCount || 1), Number(item.paidInstallments || 0) + 1);
      item.status = item.remainingAmount > 0 ? "PENDING" : "PAID";
      item.paymentHistory = Array.isArray(item.paymentHistory) ? item.paymentHistory : [];
      item.paymentHistory.unshift({ id: Date.now(), amount, method, note, date: "Şimdi" });
      queueUpdate("PAYMENT", item.id, paymentPayload(item));
      saveData(); renderAll(); openFinanceDetail(item.id); showToast(item.remainingAmount > 0 ? `${currency(amount)} tahsil edildi · ${currency(item.remainingAmount)} kaldı.` : "Ödeme planı tamamen tahsil edildi."); return;
    }
    if (event.target.id === "doctorForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const doctor = { id: Date.now(), name: String(form.get("name") || "").trim(), email: String(form.get("email") || "").trim().toLowerCase(), specialty: String(form.get("specialty") || "").trim() || "Diş hekimi" };
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
      const account = localAccount() || {}; account.clinicName = name; storage.set("clinicnova.localAccount", account); applyLocalIdentity(account);
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
        storage.set("clinicnova.localAccount", account);
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
        id: Date.now(), name: form.get("name").trim(), phone: form.get("phone").trim(), email: form.get("email").trim(),
        nationalId: String(form.get("nationalId") || "").trim(), birthDate: String(form.get("birthDate") || ""), gender: String(form.get("gender") || "UNSPECIFIED"), address: String(form.get("address") || "").trim(), allergies: String(form.get("allergies") || "").trim(), chronicDiseases: String(form.get("chronicDiseases") || "").trim(), medications: String(form.get("medications") || "").trim(),
        tag: form.get("tag"), lastVisit: "Yeni kayıt", treatment: form.get("treatment").trim() || "Muayene", note: form.get("note").trim(), color: state.patients.length % palette.length
      };
      state.patients.unshift(patient);
      queueCreate("PATIENT", patient.id, patientPayload(patient));
      saveData(); renderAll(); closeModal(); navigate("patients"); showToast("Hasta başarıyla kaydedildi.");
    }
    if (event.target.id === "appointmentForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const appointment = {
        id: Date.now(), patientId: Number(form.get("patientId")), date: form.get("date"), time: form.get("time"), duration: Number(form.get("duration")),
        treatment: form.get("treatment").trim(), doctor: form.get("doctor"), room: form.get("room"), status: "PLANNED"
      };
      state.appointments.push(appointment);
      queueCreate("APPOINTMENT", appointment.id, appointmentPayload(appointment));
      state.selectedDate = form.get("date");
      { const selected = new Date(`${state.selectedDate}T12:00:00`); state.appointmentMonth = new Date(selected.getFullYear(), selected.getMonth(), 1); }
      saveData(); renderAll(); closeModal(); navigate("appointments"); showToast("Randevu başarıyla oluşturuldu.");
    }
    if (event.target.id === "paymentForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patient = patientById(form.get("patientId"));
      const amount = Number(form.get("amount"));
      if (!patient || !Number.isFinite(amount) || amount <= 0) return showToast("Hasta ve tutarı kontrol edin.");
      const components = [1, 2].map((index) => ({ name: String(form.get(`itemName${index}`) || "").trim(), amount: Number(form.get(`itemAmount${index}`) || 0) })).filter((item) => item.name && item.amount > 0);
      const totalAmount = components.reduce((sum, item) => sum + item.amount, 0);
      if (!components.length || totalAmount <= 0 || amount > totalAmount) return showToast("İşlem bedellerini ve alınan tutarı kontrol edin.");
      const installmentCount = Math.max(1, Number(form.get("installmentCount")) || 1);
      const paidInstallments = Math.min(installmentCount, Math.max(0, Number(form.get("paidInstallments")) || 0));
      const remainingAmount = Math.max(0, totalAmount - amount);
      const payment = {
        id: Date.now(), patientId: patient.id, name: patient.name, detail: `${form.get("description").trim()} · ${form.get("method")}`,
        amount, totalAmount, remainingAmount, installmentCount, paidInstallments, components, isDeposit: form.get("isDeposit") === "on", type: "income", status: remainingAmount > 0 ? "PENDING" : "PAID", date: "Şimdi"
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
      if (name.length < 2 || !Number.isFinite(amount) || amount <= 0) return showToast("Gider başlığı ve tutarı kontrol edin.");
      const category = String(form.get("category") || "Diğer");
      const method = String(form.get("method") || "Belirtilmedi");
      const description = String(form.get("description") || "").trim();
      const expense = { id: Date.now(), patientId: null, name, category, method, detail: `${category} · ${method}${description ? ` · ${description}` : ""}`, amount, type: "expense", status: "PAID", date: "Şimdi" };
      state.transactions.unshift(expense); queueCreate("PAYMENT", expense.id, paymentPayload(expense)); state.transactionFilter = "ALL";
      saveData(); renderAll(); closeModal(); navigate("finance"); showToast("Gider finans kaydına eklendi.");
    }
    if (event.target.id === "consentForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patient = patientById(form.get("patientId"));
      if (!patient) return showToast("Hasta seçimini kontrol edin.");
      const status = String(form.get("status") || "Taslak");
      const consent = { id: Date.now(), patientId: patient.id, patient: patient.name, form: String(form.get("form") || "Genel tedavi onamı"), treatment: String(form.get("treatment") || "Genel tedavi").trim(), language: String(form.get("language") || "Türkçe"), channel: String(form.get("channel") || "Klinikte"), status, date: "Şimdi", signedAt: status === "İmzalandı" ? "Şimdi" : "", signer: status === "İmzalandı" ? patient.name : "", version: "v1", note: String(form.get("note") || "").trim(), history: [{ status, date: "Şimdi", note: "Onam kaydı oluşturuldu." }] };
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
      const item = { id: Date.now(), name: String(form.get("name") || "").trim(), category: String(form.get("category") || "").trim(), amount: Number(form.get("amount")), minimum: Number(form.get("minimum")), unit: String(form.get("unit") || "").trim(), supplier: String(form.get("supplier") || "").trim(), purchasePrice: Number(form.get("purchasePrice") || 0), movements: [], offers: [] };
      if (!item.name || !item.category || !item.unit || !Number.isFinite(item.amount) || item.amount < 0 || !Number.isFinite(item.minimum) || item.minimum < 0) return showToast("Ürün bilgilerini kontrol edin.");
      if (stockItems.some((entry) => entry.name.toLocaleLowerCase("tr-TR") === item.name.toLocaleLowerCase("tr-TR"))) return showToast("Bu ürün stokta zaten kayıtlı.");
      if (item.amount > 0) item.movements.unshift({ id: Date.now() + 1, type: "IN", quantity: item.amount, note: "Açılış stoku", date: "Şimdi" });
      stockItems.unshift(item); queueCreate("STOCK_ITEM", item.id, stockItemPayload(item)); saveData(); renderAll(); closeModal(); navigate("stocks"); showToast("Yeni stok ürünü kaydedildi.");
    }
    if (event.target.id === "treatmentPlanForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const patient = patientById(form.get("patientId"));
      const total = Number(form.get("total"));
      const paid = Number(form.get("paid"));
      if (!patient || !Number.isFinite(total) || total < 0 || !Number.isFinite(paid) || paid < 0 || paid > total) return showToast("Hasta ve ücret bilgilerini kontrol edin; ödeme toplam ücreti aşamaz.");
      const statusCode = String(form.get("status"));
      const status = ({ PROPOSED: "Önerildi", ACCEPTED: "Kabul edildi", STARTED: "Başladı", COMPLETED: "Tamamlandı", CANCELLED: "İptal" })[statusCode] || "Önerildi";
      const date = String(form.get("date"));
      const paymentPlan = buildLocalPaymentPlan(total, paid, form.get("installmentCount"), String(form.get("firstInstallmentDate") || todayIso), String(form.get("paymentPlanNote") || "").trim());
      const plan = { id: Date.now(), patientId: patient.id, patient: patient.name, treatment: String(form.get("treatment") || "").trim(), tooth: String(form.get("tooth") || "").trim(), doctor: String(form.get("doctor") || "").trim(), branch: String(form.get("branch") || "").trim(), date, plannedAt: new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`)), total, paid, paymentPlan, status, statusCode, note: String(form.get("note") || "").trim() };
      if (plan.treatment.length < 2 || !plan.doctor || !plan.branch) return showToast("Tedavi, hekim ve şube bilgilerini kontrol edin.");
      treatmentPlans.unshift(plan); queueCreate("TREATMENT_PLAN", plan.id, treatmentPlanPayload(plan));
      if (paid > 0) {
        const payment = { id: Date.now() + 1, patientId: patient.id, name: patient.name, detail: `${plan.treatment} plan peşinatı · Nakit`, amount: paid, totalAmount: total, remainingAmount: Math.max(0, total - paid), installmentCount: paymentPlan.installmentCount, paidInstallments: 0, components: [{ name: plan.treatment, amount: total }], isDeposit: true, type: "income", status: total > paid ? "PENDING" : "PAID", date: "Şimdi" };
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
      if (!item || !Number.isFinite(quantity) || quantity < 0 || (type !== "ADJUSTMENT" && quantity === 0)) return showToast("Ürün ve miktarı kontrol edin.");
      if (type === "OUT" && quantity > Number(item.amount)) return showToast(`Stok yetersiz. Mevcut: ${item.amount} ${item.unit}.`);
      item.amount = type === "IN" ? Number(item.amount) + quantity : type === "OUT" ? Number(item.amount) - quantity : quantity;
      const movement = { id: Date.now(), itemId: item.id, type, quantity, note: String(form.get("note") || "").trim() || (type === "IN" ? "Stok girişi" : type === "OUT" ? "Stok çıkışı" : "Sayım düzeltmesi"), date: "Şimdi" };
      (item.movements ||= []).unshift(movement);
      queueCreate("STOCK_MOVEMENT", movement.id, { itemId: String(item.id), type, quantity, note: movement.note });
      saveData(); renderAll(); closeModal(); navigate("stocks"); showToast("Stok miktarı güncellendi.");
    }
    if (event.target.id === "stockRecipeForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const recipe = { id: Date.now(), treatmentType: String(form.get("treatmentType") || "").trim(), itemId: Number(form.get("itemId")), quantity: Number(form.get("quantity")) };
      if (recipe.treatmentType.length < 2 || !stockItems.some((item) => Number(item.id) === recipe.itemId) || !Number.isInteger(recipe.quantity) || recipe.quantity < 1) return showToast("Tedavi, malzeme ve miktarı kontrol edin.");
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
  });

  purgeExpiredTrash();
  queueExistingLocalRecords();
  configureEntryMode();
  if (storage.get("clinicnova.theme", "light") === "dark") document.documentElement.classList.add("dark");
  $("#notificationDot").hidden = storage.get("clinicnova.notificationsRead", false);
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
  });
  if (new URLSearchParams(window.location.search).has("sync")) setTimeout(() => syncPending(true), 500);
  else setTimeout(syncPending, 1500);
})();
