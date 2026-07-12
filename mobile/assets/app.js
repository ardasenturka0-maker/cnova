(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const mobileConfig = window.CLINICNOVA_MOBILE_CONFIG || { mode: "production", serverUrl: "" };
  const demoMode = mobileConfig.mode === "demo";
  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* WebView storage can be unavailable in private mode. */ }
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
    { id: 4, patientId: 1, date: todayIso, time: "14:30", duration: 60, treatment: "İmplant kontrolü", doctor: "Dr. Emir Aydın", room: "Koltuk 3", status: "PENDING" },
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
    { id: 1, patient: "Ayşe Yılmaz", treatment: "İmplant", total: 42000, paid: 18500, status: "Devam ediyor" },
    { id: 2, patient: "Mehmet Demir", treatment: "Kanal tedavisi", total: 12000, paid: 7200, status: "2. seans" },
    { id: 3, patient: "Can Şahin", treatment: "Ortodonti", total: 36000, paid: 29500, status: "Kontrol bekliyor" }
  ];
  const defaultStockItems = [
    { id: 1, name: "Anestezi kartuşu", amount: 8, minimum: 20, unit: "adet" },
    { id: 2, name: "İmplant seti", amount: 14, minimum: 10, unit: "set" },
    { id: 3, name: "Cerrahi eldiven", amount: 85, minimum: 50, unit: "kutu" },
    { id: 4, name: "Kompozit dolgu", amount: 11, minimum: 8, unit: "tüp" }
  ];
  const defaultCommunicationLog = [
    { id: 1, patient: "Ayşe Yılmaz", channel: "WhatsApp", message: "Yarınki kontrol randevunuz 14:30'da.", status: "Teslim edildi" },
    { id: 2, patient: "Mehmet Demir", channel: "SMS", message: "Tedavi sonrası kontrolünüz için bizi arayabilirsiniz.", status: "Teslim edildi" },
    { id: 3, patient: "Emily Carter", channel: "E-posta", message: "Your treatment package is ready for review.", status: "Demo taslak" }
  ];
  const defaultConsentRecords = [
    { id: 1, patient: "Ayşe Yılmaz", form: "İmplant aydınlatılmış onamı", status: "İmzalandı", date: "Bugün, 09:12" },
    { id: 2, patient: "Mehmet Demir", form: "Kanal tedavisi onamı", status: "İmzalandı", date: "Dün, 15:40" },
    { id: 3, patient: "Emily Carter", form: "International treatment consent", status: "İmza bekliyor", date: "10 Temmuz" }
  ];
  const modules = [
    { name: "Tedavi planları", detail: "Vaka ve ödeme planı", icon: "i-tooth", color: "#0f766e" },
    { name: "Sağlık turizmi", detail: "Lead ve paket yönetimi", icon: "i-plane", color: "#ed6b3a" },
    { name: "Stok", detail: "Kritik seviye ve hareketler", icon: "i-box", color: "#2774c7" },
    { name: "İletişim", detail: "WhatsApp, SMS, e-posta", icon: "i-message", color: "#7257b7" },
    { name: "Raporlar", detail: "Gelir ve performans", icon: "i-chart", color: "#b76b12" },
    { name: "Dijital onam", detail: "Onam ve imza kayıtları", icon: "i-shield", color: "#16845b" },
    { name: "Çöp Kutusu", detail: "30 gün saklanan silinmiş kayıtlar", icon: "i-box", color: "#a64458" }
  ];

  let hotLeads = storage.get("clinicnova.hotLeads", defaultHotLeads);
  let treatmentPlans = storage.get("clinicnova.treatmentPlans", defaultTreatmentPlans);
  let stockItems = storage.get("clinicnova.stockItems", defaultStockItems);
  let communicationLog = storage.get("clinicnova.communicationLog", defaultCommunicationLog);
  let consentRecords = storage.get("clinicnova.consentRecords", defaultConsentRecords);
  let trashItems = storage.get("clinicnova.trashItems", []);

  const state = {
    patients: storage.get("clinicnova.patients", defaultPatients),
    appointments: storage.get("clinicnova.appointments", defaultAppointments),
    transactions: storage.get("clinicnova.transactions", defaultTransactions),
    treatmentHistory: storage.get("clinicnova.treatmentHistory", defaultTreatmentHistory),
    patientMedia: storage.get("clinicnova.patientMedia", {}),
    selectedDate: todayIso,
    patientFilter: "ALL",
    patientQuery: "",
    transactionFilter: "ALL",
    activeView: "home"
  };

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
  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toLocaleUpperCase("tr-TR")).join("");
  }
  function patientById(id) {
    return state.patients.find((patient) => patient.id === Number(id));
  }
  function statusLabel(status) {
    return ({ PLANNED: "Planlandı", ARRIVED: "Geldi", COMPLETED: "Tamamlandı", PENDING: "Onay bekliyor" })[status] || status;
  }
  function saveData() {
    storage.set("clinicnova.patients", state.patients);
    storage.set("clinicnova.appointments", state.appointments);
    storage.set("clinicnova.transactions", state.transactions);
    storage.set("clinicnova.treatmentHistory", state.treatmentHistory);
    storage.set("clinicnova.patientMedia", state.patientMedia);
    storage.set("clinicnova.hotLeads", hotLeads);
    storage.set("clinicnova.treatmentPlans", treatmentPlans);
    storage.set("clinicnova.stockItems", stockItems);
    storage.set("clinicnova.communicationLog", communicationLog);
    storage.set("clinicnova.consentRecords", consentRecords);
    storage.set("clinicnova.trashItems", trashItems);
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
    const todayAppointments = state.appointments.filter((item) => item.date === todayIso).sort((a, b) => a.time.localeCompare(b.time));
    const revenue = state.transactions.filter((item) => item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pending = state.transactions.filter((item) => item.type === "income" && outstandingAmount(item) > 0);
    $("#opportunitySummary").textContent = `${hotLeads.length} sıcak lead ve ${pending.length} geciken tahsilat bugün aksiyon bekliyor.`;
    $("#alertBanner").setAttribute("aria-label", `Gelir fırsatları hazır: ${hotLeads.length} sıcak lead ve ${pending.length} geciken tahsilat`);
    const metrics = [
      { label: "Bugünkü randevu", value: todayAppointments.length, detail: "+2 geçen haftaya göre", icon: "i-calendar", positive: true },
      { label: "Aylık tahsilat", value: currency(revenue), detail: "+%14 büyüme", icon: "i-wallet", positive: true, bars: true },
      { label: "Aktif hasta", value: state.patients.filter((item) => item.tag !== "PASSIVE").length, detail: "2 yeni kayıt", icon: "i-users" },
      { label: "Bekleyen ödeme", value: currency(pending.reduce((sum, item) => sum + outstandingAmount(item), 0)), detail: `${pending.length} ödeme planı`, icon: "i-chart" }
    ];
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
    const dates = Array.from({ length: 7 }, (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + index - 2));
    $("#dateStrip").innerHTML = dates.map((date) => {
      const iso = localDate(date);
      const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(date).replace(".", "");
      return `<button class="date-button ${iso === state.selectedDate ? "active" : ""}" data-date="${iso}"><small>${weekday}</small><strong>${date.getDate()}</strong></button>`;
    }).join("");
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
    const expense = state.transactions.filter((item) => item.type === "expense" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pending = state.transactions.filter((item) => item.type === "income" && outstandingAmount(item) > 0);
    const visibleTransactions = state.transactions.filter((item) => {
      if (state.transactionFilter === "ALL") return true;
      if (state.transactionFilter === "EXPENSE") return item.type === "expense";
      return item.status === state.transactionFilter;
    });
    $("#financePeriod").textContent = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(today);
    $("#monthlyRevenue").textContent = currency(income);
    $("#financeStats").innerHTML = [
      ["Bekleyen tahsilat", currency(pending.reduce((sum, item) => sum + outstandingAmount(item), 0)), `${pending.length} ödeme planı`],
      ["Net nakit akışı", currency(income - expense), "+%11 geçen aya göre"]
    ].map(([label, value, detail]) => `<article class="finance-stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
    $("#transactionFilterButton").textContent = ({ ALL: "Filtrele", PAID: "Ödenenler", PENDING: "Gecikenler", EXPENSE: "Giderler" })[state.transactionFilter];
    $("#transactionList").innerHTML = visibleTransactions.length ? visibleTransactions.map((item) => `<article class="transaction-card transaction-card-deletable">
      <span class="transaction-icon ${item.type === "expense" ? "expense" : item.status === "PENDING" ? "pending" : ""}">${item.type === "expense" ? "−" : item.status === "PENDING" ? "!" : "+"}</span>
      <span class="transaction-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)} · ${escapeHtml(item.date)}</small>${item.components?.length ? `<span class="transaction-lines">${item.components.map((line) => `${escapeHtml(line.name)} ${currency(line.amount)}`).join(" · ")}</span>` : ""}${outstandingAmount(item) > 0 ? `<span class="installment-note">${item.paidInstallments || 0}/${item.installmentCount || 1} taksit ödendi · Kalan ${currency(outstandingAmount(item))}</span>` : ""}</span>
      <span class="transaction-amount ${item.type === "expense" ? "expense" : outstandingAmount(item) > 0 ? "pending" : ""}">${item.type === "expense" ? "−" : "+"}${currency(item.amount)}<small>${item.type === "expense" ? "Gider" : outstandingAmount(item) > 0 ? "Kısmi ödendi" : "Ödendi"}</small></span>
      <button class="delete-button" data-delete-transaction="${item.id}" aria-label="${escapeHtml(item.name)} finans kaydını sil">Sil</button>
    </article>`).join("") : `<div class="empty-state"><strong>İşlem bulunamadı</strong><br/>Filtreyi değiştirerek diğer hareketleri görüntüleyin.</div>`;
  }

  function renderModules() {
    $("#moduleGrid").innerHTML = modules.map((module) => `<button class="module-card" data-module="${escapeHtml(module.name)}" style="--module-color:${module.color}"><span class="module-icon"><svg><use href="#${module.icon}"/></svg></span><strong>${escapeHtml(module.name)}</strong><small>${escapeHtml(module.detail)}</small></button>`).join("");
  }

  function renderAll() {
    renderDashboard();
    renderPatients();
    renderAppointments();
    renderFinance();
    renderModules();
  }

  function navigate(view) {
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
      <label class="field">E-posta<input name="email" type="email" autocomplete="email" placeholder="hasta@mail.com" /></label>
      <div class="modal-grid two"><label class="field">Etiket<select name="tag"><option value="NEW">Yeni</option><option value="ACTIVE">Aktif</option><option value="VIP">VIP</option></select></label><label class="field">İlgilendiği tedavi<input name="treatment" placeholder="Muayene" /></label></div>
      <label class="field">Not<textarea name="note" placeholder="Alerji, iletişim tercihi veya ilk görüşme notu"></textarea></label>
      <p class="modal-note">Kaydedilen bilgiler bu çevrimdışı APK sürümünde yalnızca cihazınızda tutulur.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Hastayı kaydet</button></div>
    </form>`);
  }

  function openAddAppointment(preferredPatientId) {
    const selectedPatientId = Number(preferredPatientId);
    const patientOptions = state.patients.map((patient) => `<option value="${patient.id}" ${patient.id === selectedPatientId ? "selected" : ""}>${escapeHtml(patient.name)}</option>`).join("");
    openModal("PLANLAMA", "Randevu oluştur", `<form id="appointmentForm" class="modal-grid">
      <label class="field">Hasta<select name="patientId" required>${patientOptions}</select></label>
      <div class="modal-grid two"><label class="field">Tarih<input name="date" type="date" value="${state.selectedDate}" required /></label><label class="field">Saat<input name="time" type="time" value="10:00" required /></label></div>
      <div class="modal-grid two"><label class="field">Tedavi<input name="treatment" value="Muayene" required /></label><label class="field">Süre<select name="duration"><option value="30">30 dakika</option><option value="45">45 dakika</option><option value="60">60 dakika</option><option value="90">90 dakika</option></select></label></div>
      <div class="modal-grid two"><label class="field">Hekim<select name="doctor"><option>Dr. Emir Aydın</option><option>Dr. Lara Er</option></select></label><label class="field">Koltuk<select name="room"><option>Koltuk 1</option><option>Koltuk 2</option><option>Koltuk 3</option></select></label></div>
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
      <label class="field">Not<input name="description" value="Tedavi planı tahsilatı" required /></label>
      <p class="modal-note">Bu çevrimdışı sürümde tahsilat cihazda saklanır. Canlı sisteme bağlandığınızda kayıt merkezi finans panelinde tutulur.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Ödemeyi kaydet</button></div>
    </form>`);
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
      <p class="modal-note"><strong>${escapeHtml(patient.phone)}</strong><br/>${escapeHtml(patient.email || "E-posta belirtilmedi")}<br/>Son ziyaret: ${escapeHtml(patient.lastVisit)}</p>
      <div class="finance-stats"><article class="finance-stat"><span>Tahsil edilen</span><strong>${currency(totalPaid)}</strong><small>${payments.length} ödeme kaydı</small></article><article class="finance-stat"><span>Kalan bakiye</span><strong>${currency(totalRemaining)}</strong><small>${appointments.length} randevu</small></article></div>
      <section class="patient-section"><div class="patient-section-title"><strong>Geçmiş tedaviler</strong><span>${history.length}</span></div><div class="history-list">${history.length ? history.map((item, index) => `<article><i>🦷</i><span><strong>${escapeHtml(item.treatment)}</strong><small>${escapeHtml(item.date)} · ${escapeHtml(item.doctor)}</small><p>${escapeHtml(item.note)}</p></span><button class="delete-button" data-delete-treatment="${index}" data-patient-id="${patient.id}" aria-label="${escapeHtml(item.treatment)} kaydını sil">Sil</button></article>`).join("") : `<p class="empty-inline">Tedavi geçmişi yok.</p>`}</div></section>
      <section class="patient-section"><div class="patient-section-title"><strong>Ödeme geçmişi</strong><span>${payments.length}</span></div><div class="history-list">${payments.length ? payments.map((item) => `<article><i>₺</i><span><strong>${currency(item.amount)} · ${escapeHtml(item.detail)}</strong><small>${escapeHtml(item.date)}${outstandingAmount(item) ? ` · Kalan ${currency(outstandingAmount(item))}` : " · Tamamlandı"}</small>${item.components?.length ? `<p>${item.components.map((line) => `${escapeHtml(line.name)}: ${currency(line.amount)}`).join(" · ")}</p>` : ""}</span><button class="delete-button" data-delete-transaction="${item.id}" data-patient-id="${patient.id}" aria-label="Ödeme kaydını sil">Sil</button></article>`).join("") : `<p class="empty-inline">Ödeme geçmişi yok.</p>`}</div></section>
      <section class="patient-section"><div class="patient-section-title"><strong>Before / After fotoğrafları</strong><span>${media.length}</span></div><div class="photo-grid">${media.length ? media.map((item) => `<figure><img src="${escapeHtml(item.dataUrl)}" alt="${escapeHtml(item.kind)} fotoğrafı"/><figcaption>${escapeHtml(item.kind)} · ${escapeHtml(item.date)}</figcaption><button class="delete-button photo-delete" data-delete-media="${item.id}" data-patient-id="${patient.id}" aria-label="${escapeHtml(item.kind)} fotoğrafını sil">Sil</button></figure>`).join("") : `<p class="empty-inline">Henüz fotoğraf eklenmedi.</p>`}</div><div class="photo-actions"><label class="button button-secondary">📷 Before çek<input class="visually-hidden" type="file" accept="image/*" capture="environment" data-patient-media="${patient.id}" data-media-kind="Before" /></label><label class="button button-secondary">📷 After çek<input class="visually-hidden" type="file" accept="image/*" capture="environment" data-patient-media="${patient.id}" data-media-kind="After" /></label><label class="button button-secondary">Dosyalardan yükle<input class="visually-hidden" type="file" accept="image/*" data-patient-media="${patient.id}" data-media-kind="Dosya" /></label></div></section>
      <div class="modal-actions"><button class="button button-secondary" data-action="add-appointment" data-patient-prefill="${patient.id}">Yeni randevu oluştur</button><button class="button button-primary" data-action="add-payment" data-patient-prefill="${patient.id}">Ödeme ekle</button></div>
    </div>`);
  }

  function openAppointmentDetail(id) {
    const appointment = state.appointments.find((item) => item.id === Number(id));
    if (!appointment) return;
    const patient = patientById(appointment.patientId);
    openModal("RANDEVU DETAYI", `${appointment.time} · ${patient?.name || "Hasta"}`, `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(appointment.treatment)}</strong><br/>${escapeHtml(appointment.doctor)} · ${escapeHtml(appointment.room)}<br/>${appointment.duration} dakika · ${statusLabel(appointment.status)}</p>
      <label class="field">Durum<select id="appointmentStatus"><option value="PLANNED" ${appointment.status === "PLANNED" ? "selected" : ""}>Planlandı</option><option value="ARRIVED" ${appointment.status === "ARRIVED" ? "selected" : ""}>Geldi</option><option value="COMPLETED" ${appointment.status === "COMPLETED" ? "selected" : ""}>Tamamlandı</option><option value="PENDING" ${appointment.status === "PENDING" ? "selected" : ""}>Onay bekliyor</option></select></label>
      <button class="button button-primary" data-save-appointment="${appointment.id}">Durumu güncelle</button>
    </div>`);
  }

  function openConnection() {
    const saved = storage.get("clinicnova.serverUrl", "");
    openModal("CANLI BAĞLANTI", "Sunucuya bağlan", `<form id="connectionForm" class="modal-grid">
      <p class="modal-note">ClinicNova web sunucunuz yayınlandığında HTTPS adresini girin. Uygulama aynı güvenli oturum ve dashboard’u mobil kabuk içinde açar.</p>
      <label class="field">Sunucu adresi<input name="url" type="url" value="${escapeHtml(saved)}" placeholder="https://clinic.example.com" required /></label>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Bağlan</button></div>
    </form>`);
  }

  function openSecurity() {
    openModal("GÜVENLİK", "Veri ve uygulama", `<div class="modal-grid">
      <p class="modal-note"><strong>Çevrimdışı demo modu</strong><br/>Eklediğiniz örnek hasta ve randevular Android WebView yerel depolamasında saklanır. Bir sunucuya bağlanmadan cihazdan dışarı gönderilmez.</p>
      <p class="modal-note"><strong>Canlı kullanım</strong><br/>Gerçek hasta verisi için TLS, güçlü oturum anahtarı, yönetilen veritabanı, şifreli yedek ve klinik KVKK/GDPR süreçleri zorunludur.</p>
      <button class="button button-secondary" data-reset-demo>Demo verilerini sıfırla</button>
    </div>`);
  }

  function openProfile() {
    const session = storage.get("clinicnova.session", {});
    openModal("PROFİL", "Derya Nova", `<div class="modal-grid">
      <p class="modal-note"><strong>Klinik sahibi</strong><br/>${escapeHtml(session.email || "owner@clinicnova.test")}<br/>Nişantaşı Klinik</p>
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
    const paidIncome = state.transactions.filter((item) => item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const expenses = state.transactions.filter((item) => item.type === "expense" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const moduleContent = {
      "Tedavi planları": `<div class="list-stack">${treatmentPlans.map((plan) => `<article class="offline-record record-deletable"><span class="record-icon">🦷</span><span class="patient-copy"><strong>${escapeHtml(plan.patient)}</strong><small>${escapeHtml(plan.treatment)} · ${escapeHtml(plan.status)}</small><span class="record-progress"><i style="width:${Math.round(plan.paid / plan.total * 100)}%"></i></span></span><span class="record-value">${currency(plan.paid)}<small>${currency(plan.total)} plan</small></span><button class="delete-button" data-delete-record="${plan.id}" data-record-kind="treatmentPlans" aria-label="${escapeHtml(plan.patient)} tedavi planını sil">Sil</button></article>`).join("") || `<p class="empty-inline">Tedavi planı yok.</p>`}</div>`,
      "Sağlık turizmi": `<div class="list-stack">${hotLeads.map((lead) => `<article class="opportunity-card record-deletable"><span class="score-badge">${lead.score}</span><span class="patient-copy"><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.country)} · ${escapeHtml(lead.treatment)}</small></span><a class="mini-action" href="tel:${escapeHtml(lead.phone.replace(/\s+/g, ""))}">Ara</a><button class="delete-button" data-delete-record="${lead.id}" data-record-kind="hotLeads" aria-label="${escapeHtml(lead.name)} lead kaydını sil">Sil</button></article>`).join("") || `<p class="empty-inline">Lead kaydı yok.</p>`}</div>`,
      "Stok": `<div class="list-stack">${stockItems.map((item) => { const critical = item.amount < item.minimum; return `<article class="offline-record record-deletable"><span class="transaction-icon ${critical ? "expense" : ""}">${critical ? "!" : "✓"}</span><span class="patient-copy"><strong>${escapeHtml(item.name)}</strong><small>Minimum ${item.minimum} ${escapeHtml(item.unit)}</small></span><span class="record-value ${critical ? "critical" : ""}">${item.amount}<small>${escapeHtml(item.unit)}</small></span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="stockItems" aria-label="${escapeHtml(item.name)} stok kaydını sil">Sil</button></article>`; }).join("") || `<p class="empty-inline">Stok kaydı yok.</p>`}</div>`,
      "İletişim": `<div class="list-stack">${communicationLog.map((item) => `<article class="offline-record record-deletable"><span class="record-channel">${escapeHtml(item.channel.slice(0, 1))}</span><span class="patient-copy"><strong>${escapeHtml(item.patient)} · ${escapeHtml(item.channel)}</strong><small>${escapeHtml(item.message)}</small></span><span class="record-state">${escapeHtml(item.status)}</span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="communicationLog" aria-label="${escapeHtml(item.patient)} iletişim kaydını sil">Sil</button></article>`).join("") || `<p class="empty-inline">İletişim kaydı yok.</p>`}<p class="modal-note">Çevrimdışı modda geçmiş ve taslaklar görüntülenir. Gerçek WhatsApp, SMS ve e-posta gönderimi canlı bağlantı ister.</p></div>`,
      "Raporlar": `<div class="modal-grid"><div class="finance-stats"><article class="finance-stat"><span>Tahsilat</span><strong>${currency(paidIncome)}</strong><small>Demo hareketleri</small></article><article class="finance-stat"><span>Net akış</span><strong>${currency(paidIncome - expenses)}</strong><small>Gelir − gider</small></article></div><div class="finance-stats"><article class="finance-stat"><span>Hasta</span><strong>${state.patients.length}</strong><small>Yerel kayıt</small></article><article class="finance-stat"><span>Randevu</span><strong>${state.appointments.length}</strong><small>Toplam plan</small></article></div><button class="button button-primary" data-go="finance">Finans ayrıntısını aç</button></div>`,
      "Dijital onam": `<div class="list-stack">${consentRecords.map((item) => `<article class="offline-record record-deletable"><span class="transaction-icon ${item.status === "İmzalandı" ? "" : "pending"}">${item.status === "İmzalandı" ? "✓" : "!"}</span><span class="patient-copy"><strong>${escapeHtml(item.patient)}</strong><small>${escapeHtml(item.form)} · ${escapeHtml(item.date)}</small></span><span class="record-state">${escapeHtml(item.status)}</span><button class="delete-button" data-delete-record="${item.id}" data-record-kind="consentRecords" aria-label="${escapeHtml(item.patient)} onam kaydını sil">Sil</button></article>`).join("") || `<p class="empty-inline">Onam kaydı yok.</p>`}<p class="modal-note">Demo kayıtları inceleme içindir. Kimlik doğrulamalı imza gönderimi ve yasal kayıt canlı sistemde yapılır.</p></div>`,
      "Çöp Kutusu": `<div class="modal-grid"><p class="modal-note">Silinen kayıtlar 30 gün burada saklanır. Süre dolunca otomatik ve kalıcı olarak temizlenir.</p><div class="list-stack">${trashItems.map((item) => `<article class="trash-record"><span class="record-icon">♻</span><span class="patient-copy"><strong>${escapeHtml(item.label)}</strong><small>${trashDaysLeft(item)} gün kaldı</small></span><button class="mini-action" data-restore-trash="${item.id}">Geri yükle</button><button class="delete-button" data-purge-trash="${item.id}" aria-label="${escapeHtml(item.label)} kaydını kalıcı sil">Kalıcı sil</button></article>`).join("") || `<p class="empty-inline">Çöp Kutusu boş.</p>`}</div>${trashItems.length ? `<button class="button button-secondary" data-empty-trash>Çöp Kutusunu boşalt</button>` : ""}</div>`
    };
    const routes = { "Tedavi planları": "treatment-plans", "Sağlık turizmi": "tourism/leads", "Stok": "stocks", "İletişim": "communication", "Raporlar": "reports", "Dijital onam": "consents" };
    const serverUrl = storage.get("clinicnova.serverUrl", "");
    const liveButton = serverUrl ? `<a class="button button-secondary" href="${escapeHtml(serverUrl.replace(/\/$/, ""))}/dashboard/${routes[name] || ""}">Canlı panelde aç</a>` : "";
    openModal("ÇEVRİMDIŞI DEMO", name, `<div class="modal-grid">${moduleContent[name] || `<p class="modal-note">Bu modül için demo bulunmuyor.</p>`}${liveButton}</div>`);
  }

  function openNotifications() {
    storage.set("clinicnova.notificationsRead", true);
    $("#notificationDot").hidden = true;
    openModal("BİLDİRİMLER", "Bugün sizden beklenenler", `<div class="list-stack">
      <button class="patient-card action-card" data-module="Stok"><span class="transaction-icon expense">!</span><span class="patient-copy"><strong>Stok seviyesi kritik</strong><small>Anestezi kartuşu minimum seviyenin altında.</small></span><svg><use href="#i-chevron"/></svg></button>
      <button class="patient-card action-card" data-transaction-filter="PENDING"><span class="transaction-icon pending">!</span><span class="patient-copy"><strong>Tahsilat gecikmesi</strong><small>2 hastanın ödeme planı bugün aksiyon bekliyor.</small></span><svg><use href="#i-chevron"/></svg></button>
      <button class="patient-card action-card" data-action="opportunities"><span class="transaction-icon">↗</span><span class="patient-copy"><strong>Yeni sağlık turizmi lead’i</strong><small>UK kaynaklı implant talebi yüksek skorlu görünüyor.</small></span><svg><use href="#i-chevron"/></svg></button>
    </div>`);
  }

  function updateNetworkBadge() {
    const badge = $("#networkBadge");
    const online = navigator.onLine;
    badge.classList.toggle("offline", !online);
    $("span", badge).textContent = online ? "Çevrimiçi" : "Çevrimdışı hazır";
  }

  function showApp() {
    $("#loginScreen").hidden = true;
    $("#appShell").hidden = false;
    renderAll();
    navigate(state.activeView);
  }
  function showLogin() {
    $("#appShell").hidden = true;
    $("#loginScreen").hidden = false;
  }

  function openLocalPreview() {
    storage.set("clinicnova.previewSession", { createdAt: Date.now() });
    showApp();
    showToast("Örnek verilerle demo açıldı.");
  }

  function normalizedServerUrl(value) {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "https:") throw new Error("HTTPS gerekli");
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  }

  function connectToServer(value) {
    try {
      const serverUrl = normalizedServerUrl(value);
      storage.set("clinicnova.serverUrl", serverUrl);
      showToast("Güvenli ClinicNova sunucusu açılıyor…");
      setTimeout(() => { window.location.href = `${serverUrl}/login?next=%2Fdashboard&mobile=android`; }, 350);
      return true;
    } catch {
      showToast("Geçerli bir HTTPS ClinicNova adresi girin.");
      return false;
    }
  }

  function configureEntryMode() {
    if (demoMode) {
      $("#previewDemoButton").hidden = true;
      $("#serverUrlField").hidden = true;
      $("#serverUrl").required = false;
      $("#demoLoginFields").hidden = false;
      $("#loginEmail").required = true;
      $("#loginPassword").required = true;
      $("#loginEmail").value = "owner@clinicnova.test";
      $("#loginPassword").value = "password123";
      $("#loginTitle").textContent = "Kliniğiniz cebinizde.";
      $("#loginDescription").textContent = "Bugünün operasyonunu, hastalarınızı ve tahsilat akışını çevrimdışı demo verileriyle deneyin.";
      $("#loginSubmitLabel").textContent = "Demo girişi";
      $("#loginSecureNote").textContent = "Demo kayıtları yalnızca cihazda tutulur; gerçek hasta verisi kullanmayın.";
      return;
    }

    $("#serverUrlField").hidden = false;
    $("#previewDemoButton").hidden = false;
    $("#serverUrl").required = true;
    $("#demoLoginFields").hidden = true;
    $("#loginEmail").required = false;
    $("#loginPassword").required = false;
    const configuredUrl = mobileConfig.serverUrl || storage.get("clinicnova.serverUrl", "");
    $("#serverUrl").value = configuredUrl;
    const offlineFallback = new URLSearchParams(window.location.search).has("offline");
    if (configuredUrl && !offlineFallback) connectToServer(configuredUrl);
  }

  $("#todayLabel").textContent = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(today);
  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!demoMode) {
      connectToServer($("#serverUrl").value);
      return;
    }
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    if (!email.includes("@") || password.length < 8) return showToast("E-posta ve şifreyi kontrol edin.");
    storage.set("clinicnova.session", { email, createdAt: Date.now() });
    showApp();
    showToast("Hoş geldiniz, Derya.");
  });
  $("#previewDemoButton").addEventListener("click", openLocalPreview);

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, [data-go], [data-action]");
    if (!target) return;
    if (target.dataset.go) { closeModal(); return navigate(target.dataset.go); }
    if (target.dataset.date) { state.selectedDate = target.dataset.date; renderAppointments(); return; }
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
        if (payload.treatmentHistory?.length) state.treatmentHistory[payload.patient.id] = payload.treatmentHistory;
        if (payload.media?.length) state.patientMedia[payload.patient.id] = payload.media;
      }
      if (trashItem.kind === "appointment") state.appointments.push(payload);
      if (trashItem.kind === "transaction") state.transactions.unshift(payload);
      if (trashItem.kind === "treatmentHistory") (state.treatmentHistory[payload.patientId] ||= []).splice(payload.index, 0, payload.item);
      if (trashItem.kind === "media") (state.patientMedia[payload.patientId] ||= []).unshift(payload.item);
      if (trashItem.kind === "treatmentPlans") treatmentPlans.unshift(payload);
      if (trashItem.kind === "hotLeads") hotLeads.unshift(payload);
      if (trashItem.kind === "stockItems") stockItems.unshift(payload);
      if (trashItem.kind === "communicationLog") communicationLog.unshift(payload);
      if (trashItem.kind === "consentRecords") consentRecords.unshift(payload);
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
      const moduleByKind = { treatmentPlans: "Tedavi planları", hotLeads: "Sağlık turizmi", stockItems: "Stok", communicationLog: "İletişim", consentRecords: "Dijital onam" };
      if (!moduleByKind[kind] || !window.confirm("Bu kayıt silinsin mi?")) return;
      const sourceByKind = { treatmentPlans, hotLeads, stockItems, communicationLog, consentRecords };
      const deletedRecord = sourceByKind[kind].find((item) => item.id === id);
      if (deletedRecord) moveToTrash(kind, deletedRecord.name || deletedRecord.patient || deletedRecord.form || "Silinen kayıt", deletedRecord);
      if (kind === "treatmentPlans") treatmentPlans = treatmentPlans.filter((item) => item.id !== id);
      if (kind === "hotLeads") hotLeads = hotLeads.filter((item) => item.id !== id);
      if (kind === "stockItems") stockItems = stockItems.filter((item) => item.id !== id);
      if (kind === "communicationLog") communicationLog = communicationLog.filter((item) => item.id !== id);
      if (kind === "consentRecords") consentRecords = consentRecords.filter((item) => item.id !== id);
      const originalOpener = modalOpener;
      saveData();
      if (kind === "hotLeads") renderDashboard();
      openModule(moduleByKind[kind]); modalOpener = originalOpener; showToast("Kayıt silindi."); return;
    }
    if (target.dataset.deletePatient) {
      const patientId = Number(target.dataset.deletePatient);
      const patient = patientById(patientId);
      if (!patient || !window.confirm(`${patient.name} ve bağlı randevu, ödeme, tedavi ve fotoğraf kayıtları silinsin mi?`)) return;
      moveToTrash("patientBundle", patient.name, { patient, appointments: state.appointments.filter((item) => item.patientId === patientId), transactions: state.transactions.filter((item) => item.patientId === patientId), treatmentHistory: state.treatmentHistory[patientId] || [], media: state.patientMedia[patientId] || [] });
      state.patients = state.patients.filter((item) => item.id !== patientId);
      state.appointments = state.appointments.filter((item) => item.patientId !== patientId);
      state.transactions = state.transactions.filter((item) => item.patientId !== patientId);
      delete state.treatmentHistory[patientId];
      delete state.patientMedia[patientId];
      saveData(); renderAll(); closeModal(); showToast("Hasta ve bağlı kayıtları silindi."); return;
    }
    if (target.dataset.deleteAppointment) {
      const appointmentId = Number(target.dataset.deleteAppointment);
      if (!window.confirm("Bu randevu silinsin mi?")) return;
      const deletedAppointment = state.appointments.find((item) => item.id === appointmentId);
      if (deletedAppointment) moveToTrash("appointment", `${patientById(deletedAppointment.patientId)?.name || "Hasta"} randevusu`, deletedAppointment);
      state.appointments = state.appointments.filter((item) => item.id !== appointmentId);
      saveData(); renderAll(); closeModal(); showToast("Randevu silindi."); return;
    }
    if (target.dataset.deleteTransaction) {
      const transactionId = Number(target.dataset.deleteTransaction);
      const patientId = Number(target.dataset.patientId);
      if (!window.confirm("Bu finans kaydı silinsin mi?")) return;
      const deletedTransaction = state.transactions.find((item) => item.id === transactionId);
      if (deletedTransaction) moveToTrash("transaction", `${deletedTransaction.name} · ${deletedTransaction.detail}`, deletedTransaction);
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
      if (deletedTreatment) moveToTrash("treatmentHistory", `${patientById(patientId)?.name || "Hasta"} · ${deletedTreatment.treatment}`, { patientId, index, item: deletedTreatment });
      state.treatmentHistory[patientId] = (state.treatmentHistory[patientId] || []).filter((_, itemIndex) => itemIndex !== index);
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
    if (target.dataset.patient) return openPatientDetail(target.dataset.patient);
    if (target.dataset.appointment) return openAppointmentDetail(target.dataset.appointment);
    if (target.dataset.module) return openModule(target.dataset.module);
    if (target.dataset.transactionFilter) {
      state.transactionFilter = target.dataset.transactionFilter;
      closeModal(); navigate("finance"); showToast("Finans filtresi uygulandı."); return;
    }
    if (target.hasAttribute("data-close-modal")) return closeModal();
    if (target.dataset.saveAppointment) {
      const appointment = state.appointments.find((item) => item.id === Number(target.dataset.saveAppointment));
      if (appointment) appointment.status = $("#appointmentStatus").value;
      saveData(); renderAll(); closeModal(); showToast("Randevu durumu güncellendi."); return;
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
      trashItems = [];
      state.transactionFilter = "ALL";
      storage.set("clinicnova.notificationsRead", false);
      $("#notificationDot").hidden = false;
      saveData(); renderAll(); closeModal(); showToast("Demo verileri sıfırlandı."); return;
    }
    const action = target.dataset.action;
    if (action === "add-patient") { closeModal(); return openAddPatient(); }
    if (action === "add-appointment") { closeModal(); return openAddAppointment(target.dataset.patientPrefill); }
    if (action === "add-payment") { closeModal(); return openAddPayment(target.dataset.patientPrefill); }
    if (action === "profile") return openProfile();
    if (action === "opportunities") return openRevenueOpportunities();
    if (action === "finance-report") return openFinanceReport();
    if (action === "transaction-filter") return openTransactionFilter();
    if (action === "connect") return openConnection();
    if (action === "security") return openSecurity();
    if (action === "logout") { storage.set("clinicnova.session", null); storage.set("clinicnova.previewSession", null); closeModal(); showLogin(); showToast("Oturum kapatıldı."); return; }
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
  window.addEventListener("online", updateNetworkBadge);
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

  document.addEventListener("submit", (event) => {
    if (event.target.id === "patientForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      state.patients.unshift({
        id: Date.now(), name: form.get("name").trim(), phone: form.get("phone").trim(), email: form.get("email").trim(),
        tag: form.get("tag"), lastVisit: "Yeni kayıt", treatment: form.get("treatment").trim() || "Muayene", color: state.patients.length % palette.length
      });
      saveData(); renderAll(); closeModal(); navigate("patients"); showToast("Hasta başarıyla kaydedildi.");
    }
    if (event.target.id === "appointmentForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      state.appointments.push({
        id: Date.now(), patientId: Number(form.get("patientId")), date: form.get("date"), time: form.get("time"), duration: Number(form.get("duration")),
        treatment: form.get("treatment").trim(), doctor: form.get("doctor"), room: form.get("room"), status: "PLANNED"
      });
      state.selectedDate = form.get("date"); saveData(); renderAll(); closeModal(); navigate("appointments"); showToast("Randevu başarıyla oluşturuldu.");
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
      state.transactions.unshift({
        id: Date.now(), patientId: patient.id, name: patient.name, detail: `${form.get("description").trim()} · ${form.get("method")}`,
        amount, totalAmount, remainingAmount, installmentCount, paidInstallments, components, type: "income", status: remainingAmount > 0 ? "PENDING" : "PAID", date: "Şimdi"
      });
      state.transactionFilter = "ALL";
      saveData(); renderAll(); closeModal(); navigate("finance"); showToast(remainingAmount > 0 ? `Ödeme kaydedildi · ${currency(remainingAmount)} bakiye kaldı.` : "Ödeme tamamen tahsil edildi.");
    }
    if (event.target.id === "connectionForm") {
      event.preventDefault();
      const url = new FormData(event.target).get("url").trim().replace(/\/$/, "");
      connectToServer(url);
    }
  });

  purgeExpiredTrash();
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
  } else if ((demoMode && storage.get("clinicnova.session", null)) || storage.get("clinicnova.previewSession", null)) showApp(); else showLogin();
})();
