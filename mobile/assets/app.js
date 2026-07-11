(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
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
    { id: 1, patientId: 1, name: "Ayşe Yılmaz", detail: "İmplant · Kart", amount: 18500, type: "income", status: "PAID", date: "Bugün, 11:24" },
    { id: 2, patientId: 2, name: "Mehmet Demir", detail: "Kanal tedavisi · Nakit", amount: 7200, type: "income", status: "PAID", date: "Bugün, 10:18" },
    { id: 3, patientId: null, name: "DentalLine Tedarik", detail: "Sarf malzeme", amount: 4600, type: "expense", status: "PAID", date: "Dün, 16:40" },
    { id: 4, patientId: 3, name: "Elif Kaya", detail: "Dolgu · Kart", amount: 3800, type: "income", status: "PAID", date: "Dün, 14:05" },
    { id: 5, patientId: 5, name: "Zeynep Çelik", detail: "Kontrol · Transfer", amount: 2400, type: "income", status: "PAID", date: "9 Temmuz, 12:30" },
    { id: 6, patientId: 4, name: "Can Şahin", detail: "Ortodonti · Vade 8 Temmuz", amount: 6500, type: "income", status: "PENDING", date: "3 gün gecikmiş" },
    { id: 7, patientId: 6, name: "Mert Aydın", detail: "Muayene · Vade 10 Temmuz", amount: 3200, type: "income", status: "PENDING", date: "1 gün gecikmiş" }
  ];
  const hotLeads = [
    { id: 1, name: "John Smith", country: "Birleşik Krallık", treatment: "İmplant + otel", score: 94, phone: "+44 700 000 1000" },
    { id: 2, name: "Emily Carter", country: "Birleşik Krallık", treatment: "Hollywood Smile", score: 88, phone: "+44 700 000 1001" },
    { id: 3, name: "Lukas Weber", country: "Almanya", treatment: "Zirkonyum kaplama", score: 82, phone: "+49 700 000 1002" }
  ];
  const modules = [
    { name: "Tedavi planları", detail: "Vaka ve ödeme planı", icon: "i-tooth", color: "#0f766e" },
    { name: "Sağlık turizmi", detail: "Lead ve paket yönetimi", icon: "i-plane", color: "#ed6b3a" },
    { name: "Stok", detail: "Kritik seviye ve hareketler", icon: "i-box", color: "#2774c7" },
    { name: "İletişim", detail: "WhatsApp, SMS, e-posta", icon: "i-message", color: "#7257b7" },
    { name: "Raporlar", detail: "Gelir ve performans", icon: "i-chart", color: "#b76b12" },
    { name: "Dijital onam", detail: "Onam ve imza kayıtları", icon: "i-shield", color: "#16845b" }
  ];

  const state = {
    patients: storage.get("clinicnova.patients", defaultPatients),
    appointments: storage.get("clinicnova.appointments", defaultAppointments),
    transactions: storage.get("clinicnova.transactions", defaultTransactions),
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
  }

  function renderDashboard() {
    const todayAppointments = state.appointments.filter((item) => item.date === todayIso).sort((a, b) => a.time.localeCompare(b.time));
    const revenue = state.transactions.filter((item) => item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pending = state.transactions.filter((item) => item.type === "income" && item.status === "PENDING");
    $("#opportunitySummary").textContent = `${hotLeads.length} sıcak lead ve ${pending.length} geciken tahsilat bugün aksiyon bekliyor.`;
    $("#alertBanner").setAttribute("aria-label", `Gelir fırsatları hazır: ${hotLeads.length} sıcak lead ve ${pending.length} geciken tahsilat`);
    const metrics = [
      { label: "Bugünkü randevu", value: todayAppointments.length, detail: "+2 geçen haftaya göre", icon: "i-calendar", positive: true },
      { label: "Aylık tahsilat", value: currency(revenue), detail: "+%14 büyüme", icon: "i-wallet", positive: true, bars: true },
      { label: "Aktif hasta", value: state.patients.filter((item) => item.tag !== "PASSIVE").length, detail: "2 yeni kayıt", icon: "i-users" },
      { label: "Bekleyen ödeme", value: currency(pending.reduce((sum, item) => sum + item.amount, 0)), detail: `${pending.length} geciken tahsilat`, icon: "i-chart" }
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
      return `<button class="patient-card" data-patient="${patient.id}" style="width:100%;text-align:left;color:inherit">
        <span class="patient-avatar" style="background:${background};color:${foreground}">${initials(patient.name)}</span>
        <span class="patient-copy"><strong>${escapeHtml(patient.name)}</strong><small>${escapeHtml(patient.phone)} · ${escapeHtml(patient.lastVisit)}</small><span class="patient-tags"><i class="tag">${escapeHtml(patient.tag)}</i><i class="tag">${escapeHtml(patient.treatment)}</i></span></span>
        <svg><use href="#i-chevron"/></svg>
      </button>`;
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
      return `<button class="appointment-card" data-appointment="${appointment.id}" style="width:100%;text-align:left;color:inherit">
        <span class="appointment-clock"><strong>${appointment.time}</strong><small>${appointment.duration} dk</small></span>
        <span class="appointment-main"><span class="row"><strong>${escapeHtml(patient?.name || "Hasta")}</strong><i class="status-pill ${appointment.status}">${statusLabel(appointment.status)}</i></span><p>${escapeHtml(appointment.treatment)} · ${escapeHtml(appointment.room)}</p><footer><i class="doctor-chip">${initials(appointment.doctor.replace("Dr. ", ""))}</i>${escapeHtml(appointment.doctor)}</footer></span>
      </button>`;
    }).join("") : `<div class="empty-state"><strong>Bu gün boş</strong><br/>Yeni bir randevu oluşturarak planlamaya başlayın.</div>`;
  }

  function renderFinance() {
    const income = state.transactions.filter((item) => item.type === "income" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const expense = state.transactions.filter((item) => item.type === "expense" && item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
    const pending = state.transactions.filter((item) => item.type === "income" && item.status === "PENDING");
    const visibleTransactions = state.transactions.filter((item) => {
      if (state.transactionFilter === "ALL") return true;
      if (state.transactionFilter === "EXPENSE") return item.type === "expense";
      return item.status === state.transactionFilter;
    });
    $("#financePeriod").textContent = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(today);
    $("#monthlyRevenue").textContent = currency(income);
    $("#financeStats").innerHTML = [
      ["Bekleyen tahsilat", currency(pending.reduce((sum, item) => sum + item.amount, 0)), `${pending.length} geciken bakiye`],
      ["Net nakit akışı", currency(income - expense), "+%11 geçen aya göre"]
    ].map(([label, value, detail]) => `<article class="finance-stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("");
    $("#transactionFilterButton").textContent = ({ ALL: "Filtrele", PAID: "Ödenenler", PENDING: "Gecikenler", EXPENSE: "Giderler" })[state.transactionFilter];
    $("#transactionList").innerHTML = visibleTransactions.length ? visibleTransactions.map((item) => `<article class="transaction-card">
      <span class="transaction-icon ${item.type === "expense" ? "expense" : item.status === "PENDING" ? "pending" : ""}">${item.type === "expense" ? "−" : item.status === "PENDING" ? "!" : "+"}</span>
      <span class="transaction-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail)} · ${escapeHtml(item.date)}</small></span>
      <span class="transaction-amount ${item.type === "expense" ? "expense" : item.status === "PENDING" ? "pending" : ""}">${item.type === "expense" ? "−" : "+"}${currency(item.amount)}<small>${item.type === "expense" ? "Gider" : item.status === "PENDING" ? "Gecikti" : "Ödendi"}</small></span>
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
    $$(".bottom-nav [data-go]").forEach((button) => button.classList.toggle("active", button.dataset.go === view));
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

  function openModal(eyebrow, title, content) {
    $("#modalEyebrow").textContent = eyebrow;
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = content;
    $("#modalBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => ($("#modalBody input, #modalBody select, #modalBody button") || $("#modalClose"))?.focus(), 80);
  }
  function closeModal() {
    $("#modalBackdrop").hidden = true;
    document.body.style.overflow = "";
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

  function openAddPayment() {
    const patientOptions = state.patients.map((patient) => `<option value="${patient.id}">${escapeHtml(patient.name)}</option>`).join("");
    openModal("TAHSİLAT", "Ödeme al", `<form id="paymentForm" class="modal-grid">
      <label class="field">Hasta<select name="patientId" required>${patientOptions}</select></label>
      <div class="modal-grid two"><label class="field">Tutar<input name="amount" type="number" inputmode="decimal" min="1" step="1" placeholder="0" required /></label><label class="field">Yöntem<select name="method"><option>Kart</option><option>Nakit</option><option>Transfer</option><option>Online</option></select></label></div>
      <label class="field">Açıklama<input name="description" value="Tedavi tahsilatı" required /></label>
      <p class="modal-note">Bu çevrimdışı sürümde tahsilat cihazda saklanır. Canlı sisteme bağlandığınızda kayıt merkezi finans panelinde tutulur.</p>
      <div class="modal-actions"><button type="button" class="button button-secondary" data-close-modal>Vazgeç</button><button type="submit" class="button button-primary">Ödemeyi kaydet</button></div>
    </form>`);
  }

  function openPatientDetail(id) {
    const patient = patientById(id);
    if (!patient) return;
    const count = state.appointments.filter((item) => item.patientId === patient.id).length;
    openModal("HASTA PROFİLİ", patient.name, `<div class="modal-grid">
      <p class="modal-note"><strong>${escapeHtml(patient.phone)}</strong><br/>${escapeHtml(patient.email || "E-posta belirtilmedi")}<br/>Son ziyaret: ${escapeHtml(patient.lastVisit)}</p>
      <div class="finance-stats"><article class="finance-stat"><span>Randevu</span><strong>${count}</strong><small>${escapeHtml(patient.treatment)}</small></article><article class="finance-stat"><span>Etiket</span><strong>${escapeHtml(patient.tag)}</strong><small>Aktif kayıt</small></article></div>
      <button class="button button-primary" data-action="add-appointment" data-patient-prefill="${patient.id}">Yeni randevu oluştur</button>
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
    const details = {
      "Tedavi planları": "Vaka, ücret ve taksit planlarını web paneliyle birlikte yönetin.",
      "Sağlık turizmi": "Sıcak lead, paket, otel ve transfer süreçlerini tek akışta izleyin.",
      "Stok": "Kritik malzemeleri ve stok hareketlerini takip edin.",
      "İletişim": "WhatsApp, SMS ve e-posta geçmişini hasta bazında yönetin.",
      "Raporlar": "Gelir, randevu ve ekip performansını analiz edin.",
      "Dijital onam": "Onam formlarını gönderin ve imza durumunu takip edin."
    };
    const routes = { "Tedavi planları": "treatment-plans", "Sağlık turizmi": "tourism/leads", "Stok": "stocks", "İletişim": "communication", "Raporlar": "reports", "Dijital onam": "consents" };
    const serverUrl = storage.get("clinicnova.serverUrl", "");
    openModal("MODÜL", name, `<div class="modal-grid"><p class="modal-note">${escapeHtml(details[name] || "Bu modül canlı ClinicNova paneliyle birlikte çalışır.")}</p>${serverUrl ? `<a class="button button-primary" href="${escapeHtml(serverUrl.replace(/\/$/, ""))}/dashboard/${routes[name] || ""}">Canlı panelde aç</a>` : `<button class="button button-primary" data-action="connect">Canlı sisteme bağlan</button>`}</div>`);
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

  $("#todayLabel").textContent = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(today);
  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    if (!email.includes("@") || password.length < 8) return showToast("E-posta ve şifreyi kontrol edin.");
    storage.set("clinicnova.session", { email, createdAt: Date.now() });
    showApp();
    showToast("Hoş geldiniz, Derya.");
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, [data-go], [data-action]");
    if (!target) return;
    if (target.dataset.go) { closeModal(); return navigate(target.dataset.go); }
    if (target.dataset.date) { state.selectedDate = target.dataset.date; renderAppointments(); return; }
    if (target.dataset.filter) { state.patientFilter = target.dataset.filter; $$("#patientFilters button").forEach((button) => button.classList.toggle("active", button === target)); renderPatients(); return; }
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
      state.transactionFilter = "ALL";
      storage.set("clinicnova.notificationsRead", false);
      $("#notificationDot").hidden = false;
      saveData(); renderAll(); closeModal(); showToast("Demo verileri sıfırlandı."); return;
    }
    const action = target.dataset.action;
    if (action === "add-patient") { closeModal(); return openAddPatient(); }
    if (action === "add-appointment") { closeModal(); return openAddAppointment(target.dataset.patientPrefill); }
    if (action === "add-payment") { closeModal(); return openAddPayment(); }
    if (action === "profile") return openProfile();
    if (action === "opportunities") return openRevenueOpportunities();
    if (action === "finance-report") return openFinanceReport();
    if (action === "transaction-filter") return openTransactionFilter();
    if (action === "connect") return openConnection();
    if (action === "security") return openSecurity();
    if (action === "logout") { storage.set("clinicnova.session", null); closeModal(); showLogin(); showToast("Oturum kapatıldı."); return; }
  });

  $("#patientSearch").addEventListener("input", (event) => { state.patientQuery = event.target.value; renderPatients(); });
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
    if (event.key === "Escape" && !$("#modalBackdrop").hidden) closeModal();
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
      state.transactions.unshift({
        id: Date.now(), patientId: patient.id, name: patient.name, detail: `${form.get("description").trim()} · ${form.get("method")}`,
        amount, type: "income", status: "PAID", date: "Şimdi"
      });
      state.transactionFilter = "ALL";
      saveData(); renderAll(); closeModal(); navigate("finance"); showToast("Ödeme başarıyla kaydedildi.");
    }
    if (event.target.id === "connectionForm") {
      event.preventDefault();
      const url = new FormData(event.target).get("url").trim().replace(/\/$/, "");
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") throw new Error("HTTPS gerekli");
        storage.set("clinicnova.serverUrl", parsed.href);
        showToast("Canlı sistem açılıyor…");
        setTimeout(() => { window.location.href = parsed.href; }, 450);
      } catch { showToast("Geçerli bir HTTPS adresi girin."); }
    }
  });

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
  if (storage.get("clinicnova.session", null)) showApp(); else showLogin();
})();
