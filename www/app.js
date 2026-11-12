const STORAGE_KEY = 'rekap_tutor_bahasa_v1';

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const today = new Date();
let activeYear = today.getFullYear();
let activeMonth = today.getMonth(); // 0-11
let sessionStatusFilter = 'all';
let sessionStudentFilter = 'all';

function getTodayISO() {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDemoData() {
  const ym = `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}`;
  return {
    students: [
      {
        id: 'st-1',
        name: 'Alya Rahmawati',
        language: '🇯🇵 Bahasa Jepang',
        level: 'JLPT N5',
        rate: 120000,
        phone: '081234567890'
      },
      {
        id: 'st-2',
        name: 'Kevin Wijaya',
        language: '🇬🇧 Bahasa Inggris',
        level: 'IELTS Speaking',
        rate: 150000,
        phone: '081398765432'
      },
      {
        id: 'st-3',
        name: 'Putri Maharani',
        language: '🇨🇳 Bahasa Mandarin',
        level: 'HSK 2',
        rate: 130000,
        phone: '081522334455'
      }
    ],
    sessions: [
      {
        id: 'ses-1',
        studentId: 'st-1',
        date: `${ym}-04`,
        duration: 60,
        fee: 120000,
        paid: true,
        topic: 'Hiragana, Katakana & Perkenalan Diri (Jikoshoukai)',
        notes: 'Pelafalan bagus, lanjut latihan partikel dasar.'
      },
      {
        id: 'ses-2',
        studentId: 'st-2',
        date: `${ym}-07`,
        duration: 90,
        fee: 225000,
        paid: false,
        topic: 'IELTS Speaking Part 2: Cue Card & Fluency',
        notes: 'Perlu memperkaya idiom dan kosakata penghubung.'
      },
      {
        id: 'ses-3',
        studentId: 'st-1',
        date: `${ym}-10`,
        duration: 60,
        fee: 120000,
        paid: false,
        topic: 'Minna no Nihongo Bab 2 - Pola Kalimat Kore/Sore/Are',
        notes: 'PR mengerjakan latihan halaman 24.'
      },
      {
        id: 'ses-4',
        studentId: 'st-3',
        date: `${ym}-11`,
        duration: 60,
        fee: 130000,
        paid: true,
        topic: 'Nada Mandarin (4 Tones) & Percakapan Belanja',
        notes: 'Nada ke-2 dan ke-3 semakin stabil.'
      }
    ]
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const demo = getDemoData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
  } catch (e) {
    return getDemoData();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function formatDateID(isoDate) {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${day} ${MONTHS_ID[monthIdx] || ''} ${parts[0]}`;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function isSameActiveMonth(isoDate) {
  if (!isoDate) return false;
  const [y, m] = isoDate.split('-').map(Number);
  return y === activeYear && (m - 1) === activeMonth;
}

function getStudentById(id) {
  return state.students.find((s) => s.id === id);
}

function renderAll() {
  document.getElementById('activeMonthLabel').textContent = `${MONTHS_ID[activeMonth]} ${activeYear}`;
  populateStudentDropdowns();
  renderDashboard();
  renderSessionsTab();
  renderStudentsTab();
  renderFinanceTab();
}

function populateStudentDropdowns() {
  const selectModal = document.getElementById('sessionStudentId');
  const selectFilter = document.getElementById('sessionStudentFilter');

  selectModal.innerHTML = state.students.length
    ? state.students.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.language)})</option>`).join('')
    : '<option value="">-- Tambah Murid Terlebih Dahulu --</option>';

  const prevVal = selectFilter.value || 'all';
  selectFilter.innerHTML = `<option value="all">Semua Murid</option>` +
    state.students.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  selectFilter.value = state.students.some((s) => s.id === prevVal) ? prevVal : 'all';
}

function renderDashboard() {
  const monthSessions = state.sessions
    .filter((s) => isSameActiveMonth(s.date))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalFee = monthSessions.reduce((acc, s) => acc + Number(s.fee || 0), 0);
  const paidFee = monthSessions.filter((s) => s.paid).reduce((acc, s) => acc + Number(s.fee || 0), 0);
  const unpaidFee = totalFee - paidFee;
  const totalMinutes = monthSessions.reduce((acc, s) => acc + Number(s.duration || 0), 0);
  const hoursFormatted = (totalMinutes / 60).toFixed(totalMinutes % 60 === 0 ? 0 : 1);

  document.getElementById('statTotalFee').textContent = formatRupiah(totalFee);
  document.getElementById('statPaidFee').textContent = formatRupiah(paidFee);
  document.getElementById('statUnpaidFee').textContent = formatRupiah(unpaidFee);
  document.getElementById('statSessionsCount').textContent = `${monthSessions.length} Sesi`;
  document.getElementById('statTotalHours').textContent = `${hoursFormatted} Jam`;
  document.getElementById('statActiveStudents').textContent = `${state.students.length} Murid`;

  const recentContainer = document.getElementById('recentSessionsList');
  const recent = monthSessions.slice(0, 4);

  if (recent.length === 0) {
    recentContainer.innerHTML = `<div class="empty-state">Belum ada sesi mengajar pada ${MONTHS_ID[activeMonth]} ${activeYear}.<br/>Klik <b>+ Catat Sesi Mengajar</b> untuk menambahkan.</div>`;
    return;
  }

  recentContainer.innerHTML = recent.map(renderSessionCardHTML).join('');
}

function renderSessionCardHTML(session) {
  const st = getStudentById(session.studentId);
  const studentName = st ? st.name : 'Murid Terhapus';
  const language = st ? st.language : 'Bahasa';
  const badgeClass = session.paid ? 'paid' : 'unpaid';
  const badgeText = session.paid ? '✓ Lunas' : '⏳ Belum Bayar';

  return `
    <div class="item-card">
      <div class="session-top">
        <div>
          <div class="student-title">${escapeHtml(studentName)}</div>
          <span class="lang-tag">${escapeHtml(language)}</span>
        </div>
        <button class="status-badge ${badgeClass}" data-action="toggle-paid" data-id="${session.id}" title="Klik untuk ubah status bayar">
          ${badgeText}
        </button>
      </div>
      <div class="session-topic">${escapeHtml(session.topic)}</div>
      ${session.notes ? `<div class="session-notes">📝 ${escapeHtml(session.notes)}</div>` : ''}
      <div class="session-footer">
        <span>📅 ${formatDateID(session.date)} • ${session.duration} mnt</span>
        <span class="session-fee">${formatRupiah(session.fee)}</span>
      </div>
      <div class="card-actions">
        <button class="btn-xs" data-action="edit-session" data-id="${session.id}">✏️ Edit</button>
        <button class="btn-xs primary" data-action="toggle-paid" data-id="${session.id}">
          ${session.paid ? 'Tandai Belum Bayar' : '✓ Tandai Lunas'}
        </button>
      </div>
    </div>
  `;
}

function renderSessionsTab() {
  const listEl = document.getElementById('allSessionsList');
  let filtered = state.sessions
    .filter((s) => isSameActiveMonth(s.date))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sessionStatusFilter === 'paid') {
    filtered = filtered.filter((s) => s.paid);
  } else if (sessionStatusFilter === 'unpaid') {
    filtered = filtered.filter((s) => !s.paid);
  }

  if (sessionStudentFilter !== 'all') {
    filtered = filtered.filter((s) => s.studentId === sessionStudentFilter);
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Tidak ada sesi yang sesuai filter pada ${MONTHS_ID[activeMonth]} ${activeYear}.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(renderSessionCardHTML).join('');
}

function renderStudentsTab() {
  const query = (document.getElementById('studentSearchInput').value || '').toLowerCase().trim();
  const listEl = document.getElementById('studentsList');

  const filtered = state.students.filter((s) =>
    s.name.toLowerCase().includes(query) ||
    s.language.toLowerCase().includes(query) ||
    (s.level || '').toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Belum ada data murid yang cocok.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map((st) => {
    const allStudentSessions = state.sessions.filter((s) => s.studentId === st.id);
    const unpaidCount = allStudentSessions.filter((s) => !s.paid).length;
    return `
      <div class="item-card">
        <div class="session-top">
          <div>
            <div class="student-title">${escapeHtml(st.name)}</div>
            <span class="lang-tag">${escapeHtml(st.language)} ${st.level ? `• ${escapeHtml(st.level)}` : ''}</span>
          </div>
          <span class="session-fee">${formatRupiah(st.rate)}/jam</span>
        </div>
        <div class="session-footer" style="margin-top:8px;">
          <span>Total: ${allStudentSessions.length} sesi (${unpaidCount} belum lunas)</span>
          <span>${st.phone ? '📱 ' + escapeHtml(st.phone) : ''}</span>
        </div>
        <div class="card-actions">
          <button class="btn-xs primary" data-action="quick-session-student" data-id="${st.id}">＋ Catat Sesi</button>
          <button class="btn-xs" data-action="edit-student" data-id="${st.id}">✏️ Edit Murid</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderFinanceTab() {
  const listEl = document.getElementById('financeStudentList');
  const monthSessions = state.sessions.filter((s) => isSameActiveMonth(s.date));

  if (state.students.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Tambahkan murid terlebih dahulu.</div>`;
    return;
  }

  const cards = state.students.map((st) => {
    const stSessions = monthSessions.filter((s) => s.studentId === st.id);
    if (stSessions.length === 0) return '';

    const total = stSessions.reduce((a, b) => a + Number(b.fee || 0), 0);
    const unpaid = stSessions.filter((s) => !s.paid).reduce((a, b) => a + Number(b.fee || 0), 0);
    const unpaidCount = stSessions.filter((s) => !s.paid).length;

    return `
      <div class="item-card">
        <div class="session-top">
          <div>
            <div class="student-title">${escapeHtml(st.name)}</div>
            <span class="lang-tag">${escapeHtml(st.language)} • ${stSessions.length} Sesi</span>
          </div>
          <span class="status-badge ${unpaid === 0 ? 'paid' : 'unpaid'}">
            ${unpaid === 0 ? '✓ Semua Lunas' : `Tagihan: ${formatRupiah(unpaid)}`}
          </span>
        </div>
        <div class="session-footer" style="margin-top:8px;">
          <span>Total Honor Bulan Ini: <b>${formatRupiah(total)}</b></span>
        </div>
        <div class="card-actions">
          ${unpaidCount > 0 ? `<button class="btn-xs success" data-action="mark-all-paid" data-id="${st.id}">✓ Lunasi Semua (${unpaidCount})</button>` : ''}
          <button class="btn-xs primary" data-action="share-wa" data-id="${st.id}">📲 Salin / Kirim Rekap WA</button>
        </div>
      </div>
    `;
  }).filter(Boolean);

  if (cards.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Belum ada tagihan atau sesi mengajar pada ${MONTHS_ID[activeMonth]} ${activeYear}.</div>`;
    return;
  }

  listEl.innerHTML = cards.join('');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Modal Helpers */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function openSessionModal(sessionId = null, prefillStudentId = null) {
  if (state.students.length === 0) {
    showToast('Tambahkan murid terlebih dahulu!');
    openStudentModal();
    return;
  }

  populateStudentDropdowns();
  const deleteBtn = document.getElementById('btnDeleteSession');

  if (sessionId) {
    const ses = state.sessions.find((s) => s.id === sessionId);
    if (!ses) return;
    document.getElementById('modalSessionTitle').textContent = 'Edit Sesi Mengajar';
    document.getElementById('sessionId').value = ses.id;
    document.getElementById('sessionStudentId').value = ses.studentId;
    document.getElementById('sessionDate').value = ses.date;
    document.getElementById('sessionDuration').value = String(ses.duration);
    document.getElementById('sessionFee').value = ses.fee;
    document.getElementById('sessionPaid').value = String(ses.paid);
    document.getElementById('sessionTopic').value = ses.topic;
    document.getElementById('sessionNotes').value = ses.notes || '';
    deleteBtn.classList.remove('hidden');
  } else {
    document.getElementById('modalSessionTitle').textContent = 'Catat Sesi Mengajar';
    document.getElementById('sessionId').value = '';
    const targetStudentId = prefillStudentId || state.students[0].id;
    document.getElementById('sessionStudentId').value = targetStudentId;
    document.getElementById('sessionDate').value = getTodayISO();
    document.getElementById('sessionDuration').value = '60';
    const st = getStudentById(targetStudentId);
    document.getElementById('sessionFee').value = st ? st.rate : 100000;
    document.getElementById('sessionPaid').value = 'false';
    document.getElementById('sessionTopic').value = '';
    document.getElementById('sessionNotes').value = '';
    deleteBtn.classList.add('hidden');
  }

  openModal('modalSession');
}

function autoCalculateSessionFee() {
  const sessionId = document.getElementById('sessionId').value;
  if (sessionId) return; // Don't overwrite custom fee when editing unless student/duration changes
  const st = getStudentById(document.getElementById('sessionStudentId').value);
  const duration = Number(document.getElementById('sessionDuration').value || 60);
  if (st) {
    const calculated = Math.round((st.rate * duration) / 60);
    document.getElementById('sessionFee').value = calculated;
  }
}

function openStudentModal(studentId = null) {
  const deleteBtn = document.getElementById('btnDeleteStudent');
  if (studentId) {
    const st = getStudentById(studentId);
    if (!st) return;
    document.getElementById('modalStudentTitle').textContent = 'Edit Data Murid';
    document.getElementById('studentId').value = st.id;
    document.getElementById('studentName').value = st.name;
    document.getElementById('studentLanguage').value = st.language;
    document.getElementById('studentLevel').value = st.level || '';
    document.getElementById('studentRate').value = st.rate;
    document.getElementById('studentPhone').value = st.phone || '';
    deleteBtn.classList.remove('hidden');
  } else {
    document.getElementById('modalStudentTitle').textContent = 'Tambah Murid Baru';
    document.getElementById('studentId').value = '';
    document.getElementById('studentName').value = '';
    document.getElementById('studentLanguage').value = '🇬🇧 Bahasa Inggris';
    document.getElementById('studentLevel').value = '';
    document.getElementById('studentRate').value = 120000;
    document.getElementById('studentPhone').value = '';
    deleteBtn.classList.add('hidden');
  }
  openModal('modalStudent');
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-view').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));

  const targetView = document.getElementById(`view-${tabName}`);
  const targetNav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (targetView) targetView.classList.add('active');
  if (targetNav) targetNav.classList.add('active');
}

function generateWhatsAppRecap(studentId) {
  const st = getStudentById(studentId);
  if (!st) return;
  const sessions = state.sessions
    .filter((s) => s.studentId === studentId && isSameActiveMonth(s.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = sessions.reduce((acc, s) => acc + Number(s.fee || 0), 0);
  const unpaid = sessions.filter((s) => !s.paid).reduce((acc, s) => acc + Number(s.fee || 0), 0);

  const lines = [
    `*REKAP LES ${st.language.toUpperCase()}*`,
    `Murid: ${st.name}`,
    `Periode: ${MONTHS_ID[activeMonth]} ${activeYear}`,
    `--------------------------------`,
    ...sessions.map((s, idx) =>
      `${idx + 1}. ${formatDateID(s.date)} (${s.duration}m) - ${s.topic} [${formatRupiah(s.fee)} - ${s.paid ? 'Lunas' : 'Belum Bayar'}]`
    ),
    `--------------------------------`,
    `Total Sesi: ${sessions.length} pertemuan`,
    `Total Honor: *${formatRupiah(total)}*`,
    `Sisa Tagihan: *${formatRupiah(unpaid)}*`,
    `\nTerima kasih! 🙏`
  ];

  const text = lines.join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Rekap disalin ke Clipboard!');
    }).catch(() => {});
  }

  if (st.phone) {
    let cleanPhone = st.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  } else {
    showToast('Teks rekap berhasil disalin!');
  }
}

/* Event Listeners Setup */
document.addEventListener('DOMContentLoaded', () => {
  renderAll();

  // Bottom Nav
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.goto));
  });

  // Month Navigation
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    activeMonth--;
    if (activeMonth < 0) {
      activeMonth = 11;
      activeYear--;
    }
    renderAll();
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    activeMonth++;
    if (activeMonth > 11) {
      activeMonth = 0;
      activeYear++;
    }
    renderAll();
  });

  // Open Modals
  document.getElementById('fabAddSession').addEventListener('click', () => openSessionModal());
  document.getElementById('btnQuickAddSession').addEventListener('click', () => openSessionModal());
  document.getElementById('btnQuickAddStudent').addEventListener('click', () => openStudentModal());
  document.getElementById('btnAddStudentTop').addEventListener('click', () => openStudentModal());
  document.getElementById('btnSettings').addEventListener('click', () => openModal('modalSettings'));

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.getElementById('sessionStudentId').addEventListener('change', autoCalculateSessionFee);
  document.getElementById('sessionDuration').addEventListener('change', autoCalculateSessionFee);

  // Save Session
  document.getElementById('formSession').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('sessionId').value;
    const payload = {
      id: id || 'ses-' + Date.now(),
      studentId: document.getElementById('sessionStudentId').value,
      date: document.getElementById('sessionDate').value,
      duration: Number(document.getElementById('sessionDuration').value),
      fee: Number(document.getElementById('sessionFee').value),
      paid: document.getElementById('sessionPaid').value === 'true',
      topic: document.getElementById('sessionTopic').value.trim(),
      notes: document.getElementById('sessionNotes').value.trim()
    };

    const [y, m] = payload.date.split('-').map(Number);
    activeYear = y;
    activeMonth = m - 1;

    if (id) {
      const idx = state.sessions.findIndex((s) => s.id === id);
      if (idx !== -1) state.sessions[idx] = payload;
    } else {
      state.sessions.unshift(payload);
    }

    saveState();
    closeModal('modalSession');
    renderAll();
    showToast('Sesi mengajar disimpan!');
  });

  // Delete Session
  document.getElementById('btnDeleteSession').addEventListener('click', () => {
    const id = document.getElementById('sessionId').value;
    if (!id) return;
    state.sessions = state.sessions.filter((s) => s.id !== id);
    saveState();
    closeModal('modalSession');
    renderAll();
    showToast('Sesi dihapus');
  });

  // Save Student
  document.getElementById('formStudent').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('studentId').value;
    const payload = {
      id: id || 'st-' + Date.now(),
      name: document.getElementById('studentName').value.trim(),
      language: document.getElementById('studentLanguage').value,
      level: document.getElementById('studentLevel').value.trim(),
      rate: Number(document.getElementById('studentRate').value),
      phone: document.getElementById('studentPhone').value.trim()
    };

    if (id) {
      const idx = state.students.findIndex((s) => s.id === id);
      if (idx !== -1) state.students[idx] = payload;
    } else {
      state.students.push(payload);
    }

    saveState();
    closeModal('modalStudent');
    renderAll();
    showToast('Data murid disimpan!');
  });

  // Delete Student
  document.getElementById('btnDeleteStudent').addEventListener('click', () => {
    const id = document.getElementById('studentId').value;
    if (!id) return;
    state.students = state.students.filter((s) => s.id !== id);
    state.sessions = state.sessions.filter((s) => s.studentId !== id);
    saveState();
    closeModal('modalStudent');
    renderAll();
    showToast('Data murid dihapus');
  });

  // Filters
  document.querySelectorAll('#sessionStatusFilter .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#sessionStatusFilter .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      sessionStatusFilter = chip.dataset.filter;
      renderSessionsTab();
    });
  });

  document.getElementById('sessionStudentFilter').addEventListener('change', (e) => {
    sessionStudentFilter = e.target.value;
    renderSessionsTab();
  });

  document.getElementById('studentSearchInput').addEventListener('input', renderStudentsTab);

  // Delegated Card Actions
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'toggle-paid') {
      const ses = state.sessions.find((s) => s.id === id);
      if (ses) {
        ses.paid = !ses.paid;
        saveState();
        renderAll();
        showToast(ses.paid ? 'Ditandai Lunas ✓' : 'Ditandai Belum Bayar');
      }
    } else if (action === 'edit-session') {
      openSessionModal(id);
    } else if (action === 'edit-student') {
      openStudentModal(id);
    } else if (action === 'quick-session-student') {
      openSessionModal(null, id);
    } else if (action === 'mark-all-paid') {
      state.sessions.forEach((s) => {
        if (s.studentId === id && isSameActiveMonth(s.date)) {
          s.paid = true;
        }
      });
      saveState();
      renderAll();
      showToast('Semua sesi murid ini ditandai Lunas!');
    } else if (action === 'share-wa') {
      generateWhatsAppRecap(id);
    }
  });

  // Backup & Restore
  document.getElementById('btnExportJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-rekap-tutor-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File backup diunduh!');
  });

  document.getElementById('inputImportJson').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (Array.isArray(parsed.students) && Array.isArray(parsed.sessions)) {
          state = parsed;
          saveState();
          renderAll();
          closeModal('modalSettings');
          showToast('Data berhasil dipulihkan!');
        } else {
          showToast('Format file tidak valid');
        }
      } catch (err) {
        showToast('Gagal membaca file backup');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('btnResetDemo').addEventListener('click', () => {
    state = getDemoData();
    saveState();
    renderAll();
    closeModal('modalSettings');
    showToast('Data direset ke contoh awal');
  });

  // Register Service Worker for offline mobile use
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
