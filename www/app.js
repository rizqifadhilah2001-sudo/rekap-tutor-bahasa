// Tutor Grow v2 — Language Teaching Journal (Supabase Online Multi-User App)
(function () {
  'use strict';

  const CFG = window.TUTOR_GROW_CONFIG;
  let sb = null;

  const SWATCH_COLORS = [
    '#434786', '#002CA6', '#A3E6A9', '#BDB2FF',
    '#FFAFCC', '#A0C4FF', '#C80730', '#F7C97E',
    '#7ED9B8', '#FF9F68'
  ];

  const WA_PLACEHOLDERS = [
    '{nama_murid}', '{nama_ortu}', '{bahasa}', '{periode}',
    '{jumlah_sesi}', '{total_jam}', '{total_tagihan}',
    '{status_paket}', '{rincian_sesi}', '{nama_tutor}'
  ];

  // Application State
  const state = {
    user: null,
    profile: {
      full_name: '',
      avatar_data: null,
      ui_language: localStorage.getItem('tg_ui_lang') || 'id',
      currency: 'IDR',
      monthly_goal: 0,
      first_day_of_week: 1,
      dark_theme: false,
      show_payment_dots: true,
      reminders_enabled: true,
      reminder_minutes: 30,
      wa_template: null
    },
    students: [],
    groups: [],
    lessons: [],
    activeTab: 'calendar',
    authMode: 'login',
    // Calendar state
    calMode: 'month',
    calCursor: new Date(),
    selectedDate: toDateStr(new Date()),
    // Students filter
    stuFilter: 'all',
    stuSearch: '',
    // Stats state
    statPeriod: 'month',
    statOffset: 0,
    // Lesson modal transient state
    lessonType: 'student',
    selectedDuration: 60,
    tempGroupAttendees: [],
    // PDF modal state
    pdfScope: 'month'
  };

  // ================= UTILITIES =================
  const $ = (id) => document.getElementById(id);

  function toDateStr(d) {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseDateStr(str) {
    const [y, m, d] = String(str || '').split('-').map(Number);
    return new Date(y || 2026, (m || 1) - 1, d || 1);
  }

  function addDays(str, n) {
    const d = parseDateStr(str);
    d.setDate(d.getDate() + n);
    return toDateStr(d);
  }

  function addMinutesToTime(timeStr, mins) {
    const [h, m] = String(timeStr || '16:00').split(':').map(Number);
    const total = ((h || 0) * 60 + (m || 0) + (Number(mins) || 60)) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function diffMinutes(startStr, endStr) {
    const [sh, sm] = String(startStr || '16:00').split(':').map(Number);
    const [eh, em] = String(endStr || '17:00').split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name || '?').slice(0, 2).toUpperCase();
  }

  function formatMoney(amount) {
    const cur = CFG.CURRENCIES.find(c => c.code === state.profile.currency) || CFG.CURRENCIES[0];
    const num = Number(amount) || 0;
    try {
      const formatted = new Intl.NumberFormat(cur.locale, {
        minimumFractionDigits: cur.decimals,
        maximumFractionDigits: cur.decimals
      }).format(num);
      return `${cur.symbol}${cur.code === 'IDR' ? ' ' : ''}${formatted}`;
    } catch {
      return `${cur.symbol} ${Math.round(num)}`;
    }
  }

  function formatCompactMoney(amount) {
    const num = Number(amount) || 0;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return String(Math.round(num));
  }

  function showLoading(on) {
    $('loadingBar').classList.toggle('hidden', !on);
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  function openModal(id) {
    $(id).classList.remove('hidden');
  }
  function closeModal(id) {
    $(id).classList.add('hidden');
  }

  function applyTheme() {
    document.body.classList.toggle('dark-theme', !!state.profile.dark_theme);
  }

  function applyLanguage(lang) {
    window.currentLang = lang || 'id';
    localStorage.setItem('tg_ui_lang', window.currentLang);
    $('authLangSelect').value = window.currentLang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = window.t(key);
    });

    // Update dynamic placeholders & select options
    $('studentSearchInput').placeholder = window.t('search_students');
    $('lessonTopic').placeholder = window.t('topic_ph');
    $('lessonProgress').placeholder = window.t('progress_ph');
    $('lessonHomework').placeholder = window.t('homework_ph');
    $('pdfEvaluation').placeholder = window.t('tutor_eval_ph');

    const statusSel = $('lessonStatus');
    if (statusSel) {
      statusSel.options[0].textContent = window.t('st_scheduled');
      statusSel.options[1].textContent = window.t('st_completed');
      statusSel.options[2].textContent = window.t('st_rescheduled');
      statusSel.options[3].textContent = window.t('st_cancelled');
      statusSel.options[4].textContent = window.t('st_no_show');
    }

    const billSel = $('stuBillingType');
    if (billSel) {
      billSel.options[0].textContent = window.t('bill_per_session');
      billSel.options[1].textContent = window.t('bill_package');
    }

    const grpFeeSel = $('grpFeeMode');
    if (grpFeeSel) {
      grpFeeSel.options[0].textContent = window.t('fee_flat');
      grpFeeSel.options[1].textContent = window.t('fee_per_student');
    }

    renderAuthTexts();
  }

  function populateLanguageSelect(selectEl) {
    const opts = CFG.LANGUAGES.map(l => `<option value="${esc(l.id)}">${l.flag} ${esc(l.id)}</option>`).join('');
    selectEl.innerHTML = opts + `<option value="__custom__">🌐 Other / Lainnya...</option>`;
  }

  function populateCurrencySelect() {
    $('setCurrency').innerHTML = CFG.CURRENCIES.map(c => `<option value="${c.code}">${c.code} (${c.symbol})</option>`).join('');
  }

  function renderSwatches(containerId, hiddenInputId, selectedColor) {
    const container = $(containerId);
    const input = $(hiddenInputId);
    input.value = selectedColor || SWATCH_COLORS[0];
    container.innerHTML = SWATCH_COLORS.map(c => `
      <button type="button" class="swatch ${c.toLowerCase() === input.value.toLowerCase() ? 'active' : ''}"
        style="background:${c}" data-color="${c}"></button>
    `).join('');
    container.querySelectorAll('.swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.color;
        container.querySelectorAll('.swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // ================= PACKAGE & HISTORY HELPERS =================
  function getStudentPackageUsed(student) {
    if (!student || student.billing_type !== 'package') return 0;
    return state.lessons.filter(l =>
      l.lesson_type === 'student' &&
      l.student_id === student.id &&
      l.uses_package &&
      (l.status === 'completed' || l.status === 'no_show') &&
      (!student.package_name || !l.package_label || l.package_label === student.package_name)
    ).length;
  }

  function getStudentAllLessons(studentId) {
    const groupMap = new Map(state.groups.map(g => [g.id, g]));
    const result = [];
    for (const l of state.lessons) {
      if (l.lesson_type === 'student' && l.student_id === studentId) {
        result.push({
          ...l,
          isGroup: false,
          effectiveStatus: l.status,
          effectiveFee: Number(l.fee) || 0,
          effectivePaid: !!l.paid,
          effectiveNote: l.progress_notes || ''
        });
      } else if (l.lesson_type === 'group' && Array.isArray(l.attendees)) {
        const att = l.attendees.find(a => a.student_id === studentId);
        if (att) {
          const grp = groupMap.get(l.group_id);
          const presentCount = l.attendees.filter(a => a.status === 'present').length || 1;
          const shareFee = grp && grp.fee_mode === 'per_student'
            ? (att.status === 'present' ? Math.round((Number(l.fee) || 0) / presentCount) : 0)
            : 0;
          result.push({
            ...l,
            isGroup: true,
            groupName: grp ? grp.name : 'Group',
            effectiveStatus: l.status === 'scheduled' ? 'scheduled' : (att.status || 'present'),
            effectiveFee: shareFee,
            effectivePaid: !!l.paid,
            effectiveNote: att.note || l.progress_notes || ''
          });
        }
      }
    }
    return result.sort((a, b) => `${b.lesson_date} ${b.start_time}`.localeCompare(`${a.lesson_date} ${a.start_time}`));
  }

  function getStudentLastCompleted(studentId) {
    const all = getStudentAllLessons(studentId);
    return all.find(l => l.effectiveStatus === 'completed' || l.effectiveStatus === 'present') || null;
  }

  function getStudentUnpaidTotal(student) {
    let total = 0;
    if (student.billing_type === 'package' && !student.package_paid && Number(student.package_price) > 0) {
      total += Number(student.package_price);
    }
    const lessons = state.lessons.filter(l =>
      l.lesson_type === 'student' &&
      l.student_id === student.id &&
      !l.uses_package &&
      !l.paid &&
      (l.status === 'completed' || l.status === 'no_show')
    );
    total += lessons.reduce((s, l) => s + (Number(l.fee) || 0), 0);
    return total;
  }

  // ================= SUPABASE & CLOUD SYNC =================
  function initSupabase() {
    if (!window.supabase || !window.supabase.createClient) {
      showToast('Supabase SDK gagal dimuat. Cek koneksi internet.');
      return false;
    }
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return true;
  }

  function saveLocalCache() {
    if (!state.user) return;
    try {
      localStorage.setItem(`tg_cache_${state.user.id}`, JSON.stringify({
        profile: state.profile,
        students: state.students,
        groups: state.groups,
        lessons: state.lessons
      }));
    } catch (e) { /* ignore quota */ }
  }

  function loadLocalCache() {
    if (!state.user) return false;
    try {
      const raw = localStorage.getItem(`tg_cache_${state.user.id}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed.profile) state.profile = { ...state.profile, ...parsed.profile };
      if (Array.isArray(parsed.students)) state.students = parsed.students;
      if (Array.isArray(parsed.groups)) state.groups = parsed.groups;
      if (Array.isArray(parsed.lessons)) state.lessons = parsed.lessons;
      return true;
    } catch {
      return false;
    }
  }

  async function syncFromCloud(silent = false) {
    if (!sb || !state.user) return;
    showLoading(true);
    try {
      const uid = state.user.id;
      const [profRes, stuRes, grpRes, lesRes] = await Promise.all([
        sb.from('tutor_profiles').select('*').eq('id', uid).maybeSingle(),
        sb.from('students').select('*').eq('user_id', uid).order('name', { ascending: true }),
        sb.from('tutor_groups').select('*').eq('user_id', uid).order('name', { ascending: true }),
        sb.from('lessons').select('*').eq('user_id', uid).order('lesson_date', { ascending: false }).order('start_time', { ascending: true })
      ]);

      if (profRes.error) throw profRes.error;
      if (stuRes.error) throw stuRes.error;
      if (grpRes.error) throw grpRes.error;
      if (lesRes.error) throw lesRes.error;

      if (profRes.data) {
        state.profile = { ...state.profile, ...profRes.data };
      } else {
        const fallbackName = state.user.user_metadata?.full_name || state.user.email?.split('@')[0] || 'Tutor';
        state.profile.full_name = fallbackName;
        await sb.from('tutor_profiles').upsert({ id: uid, full_name: fallbackName, ui_language: window.currentLang });
      }

      state.students = stuRes.data || [];
      state.groups = grpRes.data || [];
      state.lessons = lesRes.data || [];

      applyLanguage(state.profile.ui_language || window.currentLang);
      applyTheme();
      saveLocalCache();
      renderAll();

      if (window.TutorNotifications) {
        window.TutorNotifications.syncReminders(state.lessons, state.students, state.groups, state.profile);
      }
      if (!silent) showToast(window.t('synced_ok'));
    } catch (err) {
      console.error('Cloud sync error:', err);
      const hasCache = loadLocalCache();
      applyTheme();
      renderAll();
      if (hasCache) {
        showToast(window.t('offline_mode'));
      } else {
        showToast(err.message || 'Gagal sinkronisasi ke server.');
      }
    } finally {
      showLoading(false);
    }
  }

  async function saveProfileToCloud(patch) {
    state.profile = { ...state.profile, ...patch };
    saveLocalCache();
    if (!sb || !state.user) return;
    const { error } = await sb.from('tutor_profiles').upsert({
      id: state.user.id,
      ...state.profile,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  // ================= AUTH UI =================
  function setAuthAlert(msg, type = 'error') {
    const el = $('authAlert');
    if (!msg) {
      el.classList.add('hidden');
      return;
    }
    el.textContent = msg;
    el.className = `auth-alert ${type}`;
  }

  function renderAuthTexts() {
    const isSignUp = state.authMode === 'signup';
    $('authTitle').textContent = window.t(isSignUp ? 'create_account' : 'welcome_back');
    $('authDesc').textContent = window.t(isSignUp ? 'signup_sub' : 'auth_sub');
    $('authSubmitBtn').textContent = window.t(isSignUp ? 'signup_btn' : 'login_btn');
    $('authSwitchText').textContent = window.t(isSignUp ? 'have_account' : 'no_account');
    $('authSwitchBtn').textContent = window.t(isSignUp ? 'login_link' : 'signup_link');
    $('authNameWrap').classList.toggle('hidden', !isSignUp);
    $('authConfirmWrap').classList.toggle('hidden', !isSignUp);
    $('forgotRow').classList.toggle('hidden', isSignUp);
    $('authName').required = isSignUp;
    $('authPasswordConfirm').required = isSignUp;
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthAlert('');
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    if (password.length < 6) {
      setAuthAlert(window.t('password_min'));
      return;
    }
    const btn = $('authSubmitBtn');
    btn.disabled = true;
    showLoading(true);
    try {
      if (state.authMode === 'signup') {
        const name = $('authName').value.trim();
        const confirmPw = $('authPasswordConfirm').value;
        if (password !== confirmPw) {
          setAuthAlert(window.t('password_mismatch'));
          return;
        }
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: CFG.WEB_APP_URL,
            data: { full_name: name || email.split('@')[0] }
          }
        });
        if (error) throw error;
        if (data.session) {
          await enterApp(data.user);
        } else {
          setAuthAlert(window.t('signup_verify_email'), 'success');
          state.authMode = 'login';
          renderAuthTexts();
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await enterApp(data.user);
      }
    } catch (err) {
      setAuthAlert(err.message || 'Authentication failed');
    } finally {
      btn.disabled = false;
      showLoading(false);
    }
  }

  async function handleForgotPassword() {
    setAuthAlert('');
    const email = $('authEmail').value.trim();
    if (!email) {
      setAuthAlert(window.t('enter_email_first'));
      return;
    }
    showLoading(true);
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: CFG.WEB_APP_URL
      });
      if (error) throw error;
      setAuthAlert(window.t('reset_sent'), 'success');
    } catch (err) {
      setAuthAlert(err.message);
    } finally {
      showLoading(false);
    }
  }

  async function enterApp(user) {
    state.user = user;
    $('authScreen').classList.add('hidden');
    $('mainApp').classList.remove('hidden');
    loadLocalCache();
    applyTheme();
    renderAll();
    await syncFromCloud(true);
  }

  function exitApp() {
    state.user = null;
    state.students = [];
    state.groups = [];
    state.lessons = [];
    $('mainApp').classList.add('hidden');
    $('authScreen').classList.remove('hidden');
    setAuthAlert('');
  }

  // ================= RENDER ALL =================
  function renderAll() {
    renderHeader();
    renderCalendarView();
    renderStudentsView();
    renderStatsView();
    renderAccountView();
  }

  function switchTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
    $(`view-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    renderHeader();
    if (tab === 'stats') renderStatsView();
  }

  function renderHeader() {
    const titles = {
      calendar: window.t('monthly_income'),
      students: window.t('nav_students'),
      stats: window.t('statistics'),
      account: window.t('account')
    };
    $('headerPageTitle').textContent = titles[state.activeTab] || CFG.APP_NAME;
    $('headerPageSub').textContent = CFG.APP_SUBTITLE;

    // Monthly actual income for goal pill
    const now = state.calCursor;
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthPaid = state.lessons
      .filter(l => l.lesson_date.startsWith(ym) && l.paid && l.status !== 'cancelled' && l.status !== 'rescheduled')
      .reduce((s, l) => s + (Number(l.fee) || 0), 0);
    const goal = Number(state.profile.monthly_goal) || 0;
    const pct = goal > 0 ? Math.min(100, Math.round((monthPaid / goal) * 100)) : 0;

    $('goalPillText').textContent = goal > 0
      ? `${formatCompactMoney(monthPaid)} / ${formatCompactMoney(goal)} ${window.t('goal_label')}`
      : `${formatMoney(monthPaid)}`;
    $('goalBarFill').style.width = `${pct}%`;
  }

  // ================= TAB 1: CALENDAR =================
  function renderCalendarView() {
    const months = window.t('months_full');
    const daysShort = window.t('days_short');
    const firstDay = Number(state.profile.first_day_of_week) === 0 ? 0 : 1;
    const orderedWeekdays = firstDay === 1
      ? [...daysShort.slice(1), daysShort[0]]
      : daysShort;

    $('calWeekdays').innerHTML = orderedWeekdays.map(d => `<span>${d}</span>`).join('');
    $('calModeMonth').classList.toggle('active', state.calMode === 'month');
    $('calModeWeek').classList.toggle('active', state.calMode === 'week');
    $('calLegend').classList.toggle('hidden', !state.profile.show_payment_dots);

    // Map lessons by date
    const byDate = new Map();
    for (const l of state.lessons) {
      if (l.status === 'cancelled' || l.status === 'rescheduled') continue;
      if (!byDate.has(l.lesson_date)) byDate.set(l.lesson_date, []);
      byDate.get(l.lesson_date).push(l);
    }

    const todayStr = toDateStr(new Date());
    let cells = [];

    if (state.calMode === 'month') {
      const y = state.calCursor.getFullYear();
      const m = state.calCursor.getMonth();
      $('calMonthLabel').textContent = `${months[m]} ${y}`;

      const firstOfMonth = new Date(y, m, 1);
      let startOffset = firstOfMonth.getDay() - firstDay;
      if (startOffset < 0) startOffset += 7;
      const startDate = new Date(y, m, 1 - startOffset);

      for (let i = 0; i < 42; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        cells.push({ date: d, str: toDateStr(d), otherMonth: d.getMonth() !== m });
      }
    } else {
      const sel = parseDateStr(state.selectedDate);
      let diff = sel.getDay() - firstDay;
      if (diff < 0) diff += 7;
      const weekStart = new Date(sel);
      weekStart.setDate(sel.getDate() - diff);
      $('calMonthLabel').textContent = `${months[sel.getMonth()]} ${sel.getFullYear()}`;
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        cells.push({ date: d, str: toDateStr(d), otherMonth: false });
      }
    }

    $('calGrid').innerHTML = cells.map(c => {
      const dayLessons = byDate.get(c.str) || [];
      let dotsHtml = '';
      if (state.profile.show_payment_dots && dayLessons.length > 0) {
        const hasPaid = dayLessons.some(l => l.paid);
        const hasUnpaid = dayLessons.some(l => !l.paid && (l.status === 'completed' || l.status === 'no_show'));
        const hasSched = dayLessons.some(l => l.status === 'scheduled' && !l.paid);
        dotsHtml = `<div class="cal-dots">
          ${hasPaid ? '<span class="cal-dot paid"></span>' : ''}
          ${hasUnpaid ? '<span class="cal-dot unpaid"></span>' : ''}
          ${hasSched ? '<span class="cal-dot sched"></span>' : ''}
        </div>`;
      } else {
        dotsHtml = '<div class="cal-dots"></div>';
      }
      const cls = [
        'cal-cell',
        c.otherMonth ? 'other-month' : '',
        c.str === todayStr ? 'today' : '',
        c.str === state.selectedDate ? 'selected' : ''
      ].join(' ');
      return `<button type="button" class="${cls}" data-date="${c.str}"><span>${c.date.getDate()}</span>${dotsHtml}</button>`;
    }).join('');

    $('calGrid').querySelectorAll('.cal-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedDate = btn.dataset.date;
        const d = parseDateStr(state.selectedDate);
        state.calCursor = new Date(d.getFullYear(), d.getMonth(), 1);
        renderCalendarView();
        renderHeader();
      });
    });

    // Quick Start card for brand new tutors
    const hasStu = state.students.length > 0 || state.groups.length > 0;
    const hasLes = state.lessons.length > 0;
    const hasPaid = state.lessons.some(l => l.paid);
    const doneCount = [hasStu, hasLes, hasPaid].filter(Boolean).length;
    const qsCard = $('quickStartCard');
    if (doneCount < 3) {
      qsCard.classList.remove('hidden');
      qsCard.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span class="sq-icon" style="background:var(--primary-soft);">🚀</span>
          <div>
            <div style="font-family:var(--font-display);font-weight:900;font-size:15px;">${esc(window.t('quick_start'))}</div>
            <div style="font-size:12px;color:var(--text-muted);">${doneCount} / 3</div>
          </div>
        </div>
        <div class="qs-item ${hasStu ? 'done' : ''}" id="qsStep1">
          <span><span class="qs-check">${hasStu ? '✓' : ''}</span>${esc(window.t('qs_student'))}</span><span>›</span>
        </div>
        <div class="qs-item ${hasLes ? 'done' : ''}" id="qsStep2">
          <span><span class="qs-check">${hasLes ? '✓' : ''}</span>${esc(window.t('qs_lesson'))}</span><span>›</span>
        </div>
        <div class="qs-item ${hasPaid ? 'done' : ''}" id="qsStep3">
          <span><span class="qs-check">${hasPaid ? '✓' : ''}</span>${esc(window.t('qs_paid'))}</span><span>›</span>
        </div>
      `;
      $('qsStep1').onclick = () => openStudentModal(null);
      $('qsStep2').onclick = () => openLessonModal(null);
      $('qsStep3').onclick = () => {
        const unpaid = state.lessons.find(l => !l.paid);
        if (unpaid) openLessonModal(unpaid);
        else openLessonModal(null);
      };
    } else {
      qsCard.classList.add('hidden');
    }

    // Selected date heading & lessons
    const selDt = parseDateStr(state.selectedDate);
    $('selectedDateHeading').textContent = `${daysShort[selDt.getDay()]}, ${selDt.getDate()} ${months[selDt.getMonth()]} ${selDt.getFullYear()}`;

    const dayList = state.lessons
      .filter(l => l.lesson_date === state.selectedDate)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

    const listWrap = $('selectedDateLessons');
    if (dayList.length === 0) {
      listWrap.innerHTML = `
        <div class="empty-state card">
          <div class="empty-ico">🗓️</div>
          <div>${esc(window.t('no_lessons_date'))}</div>
          <button type="button" id="emptyAddLessonBtn" class="btn btn-primary btn-sm" style="margin-top:12px;">+ ${esc(window.t('add_lesson_here'))}</button>
        </div>
      `;
      $('emptyAddLessonBtn').onclick = () => openLessonModal(null, state.selectedDate);
      return;
    }

    const stuMap = new Map(state.students.map(s => [s.id, s]));
    const grpMap = new Map(state.groups.map(g => [g.id, g]));

    listWrap.innerHTML = dayList.map(l => {
      const entity = l.lesson_type === 'group' ? grpMap.get(l.group_id) : stuMap.get(l.student_id);
      const name = entity ? entity.name : '(Deleted)';
      const lang = entity ? entity.language : 'Other';
      const langMeta = window.getLanguageMeta(lang);
      const borderCol = entity?.color || langMeta.primary;
      const statusBadge = renderStatusBadge(l.status);
      const payBadge = (l.status === 'cancelled' || l.status === 'rescheduled')
        ? ''
        : (l.paid
          ? `<span class="badge badge-paid">✓ ${esc(window.t('paid'))}</span>`
          : `<span class="badge badge-unpaid">${esc(window.t('unpaid'))}</span>`);

      return `
        <div class="lesson-card" style="border-left-color:${esc(borderCol)};" data-lid="${l.id}">
          <div class="lesson-card-top">
            <div>
              <div class="lesson-time">🕒 ${esc(l.start_time)} – ${esc(l.end_time)} (${l.duration_minutes}m)</div>
              <div class="lesson-title">${l.lesson_type === 'group' ? '👥 ' : ''}${esc(name)}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:var(--font-display);font-weight:900;font-size:15px;">${formatMoney(l.fee)}</div>
              ${l.uses_package ? `<span class="badge badge-neutral">🎫 ${esc(window.t('package_badge'))}</span>` : ''}
            </div>
          </div>
          <div class="lesson-meta">
            <span class="badge" style="background:${langMeta.primary};color:${langMeta.textOnPrimary};">${langMeta.flag} ${esc(lang)}</span>
            ${statusBadge}
            ${payBadge}
          </div>
          ${(l.topic || l.homework) ? `
            <div class="lesson-topic-preview">
              ${l.topic ? `<div><strong>📘</strong> ${esc(l.topic)}</div>` : ''}
              ${l.homework ? `<div style="margin-top:2px;"><strong>📌 PR:</strong> ${esc(l.homework)}</div>` : ''}
            </div>
          ` : ''}
          <div class="lesson-quick-actions" onclick="event.stopPropagation()">
            ${l.status === 'scheduled' ? `<button type="button" class="btn btn-primary btn-sm quick-complete" data-lid="${l.id}">✓ ${esc(window.t('complete_now'))}</button>` : ''}
            ${(l.status !== 'cancelled' && l.status !== 'rescheduled') ? `<button type="button" class="btn btn-secondary btn-sm quick-pay" data-lid="${l.id}">${l.paid ? '↩️ ' + esc(window.t('unpaid')) : '💰 ' + esc(window.t('paid'))}</button>` : ''}
            ${l.lesson_type === 'student' && entity ? `<button type="button" class="btn btn-wa btn-sm quick-wa" data-sid="${entity.id}">💬 WA</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    listWrap.querySelectorAll('.lesson-card').forEach(card => {
      card.addEventListener('click', () => {
        const les = state.lessons.find(x => x.id === card.dataset.lid);
        if (les) openLessonModal(les);
      });
    });
    listWrap.querySelectorAll('.quick-complete').forEach(btn => {
      btn.addEventListener('click', () => quickUpdateLesson(btn.dataset.lid, { status: 'completed' }));
    });
    listWrap.querySelectorAll('.quick-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        const les = state.lessons.find(x => x.id === btn.dataset.lid);
        if (les) quickUpdateLesson(les.id, { paid: !les.paid });
      });
    });
    listWrap.querySelectorAll('.quick-wa').forEach(btn => {
      btn.addEventListener('click', () => {
        const stu = state.students.find(x => x.id === btn.dataset.sid);
        if (stu) sendStudentWhatsApp(stu);
      });
    });
  }

  function renderStatusBadge(st) {
    const map = {
      scheduled: ['badge-sched', window.t('st_scheduled')],
      completed: ['badge-paid', window.t('st_completed')],
      rescheduled: ['badge-warn', window.t('st_rescheduled')],
      cancelled: ['badge-unpaid', window.t('st_cancelled')],
      no_show: ['badge-unpaid', window.t('st_no_show')]
    };
    const [cls, txt] = map[st] || ['badge-neutral', st];
    return `<span class="badge ${cls}">${esc(txt)}</span>`;
  }

  async function quickUpdateLesson(id, patch) {
    const idx = state.lessons.findIndex(l => l.id === id);
    if (idx === -1) return;
    showLoading(true);
    try {
      const { data, error } = await sb.from('lessons').update(patch).eq('id', id).select().single();
      if (error) throw error;
      state.lessons[idx] = data;
      saveLocalCache();
      renderAll();
      if (window.TutorNotifications) {
        window.TutorNotifications.syncReminders(state.lessons, state.students, state.groups, state.profile);
      }
      showToast(window.t('saved_toast'));
    } catch (err) {
      showToast(err.message);
    } finally {
      showLoading(false);
    }
  }

  // ================= TAB 2: STUDENTS & GROUPS =================
  function renderStudentsView() {
    const q = state.stuSearch.toLowerCase().trim();
    const listWrap = $('studentsGroupsList');
    const items = [];

    if (state.stuFilter === 'all' || state.stuFilter === 'groups') {
      state.groups
        .filter(g => !q || g.name.toLowerCase().includes(q) || g.language.toLowerCase().includes(q))
        .forEach(g => items.push({ kind: 'group', data: g }));
    }
    if (state.stuFilter === 'all' || state.stuFilter === 'students') {
      state.students
        .filter(s => !q || s.name.toLowerCase().includes(q) || s.language.toLowerCase().includes(q) || (s.level || '').toLowerCase().includes(q))
        .forEach(s => items.push({ kind: 'student', data: s }));
    }

    if (items.length === 0) {
      listWrap.innerHTML = `<div class="empty-state card"><div class="empty-ico">🎓</div><div>${esc(window.t('empty_students'))}</div></div>`;
      return;
    }

    listWrap.innerHTML = items.map(item => {
      if (item.kind === 'group') {
        const g = item.data;
        const lm = window.getLanguageMeta(g.language);
        const count = Array.isArray(g.member_ids) ? g.member_ids.length : 0;
        return `
          <div class="entity-card" style="border-color:${esc(g.color || lm.primary)};" data-kind="group" data-id="${g.id}">
            <div class="avatar-circle" style="background:${esc(g.color || lm.primary)};">👥</div>
            <div class="entity-body">
              <div class="entity-name">${esc(g.name)}</div>
              <div class="entity-sub">${lm.flag} ${esc(g.language)} · ${count} ${esc(window.t('tab_students'))} · ${g.fee_mode === 'per_student' ? 'Per Murid' : 'Flat'}</div>
            </div>
            <div class="entity-right">
              <div style="font-family:var(--font-display);font-weight:900;font-size:13.5px;">${formatMoney(g.rate)}</div>
              <div style="font-size:11px;color:var(--text-muted);">/ 60m</div>
            </div>
          </div>
        `;
      } else {
        const s = item.data;
        const lm = window.getLanguageMeta(s.language);
        const unpaid = getStudentUnpaidTotal(s);
        let rightBadge = '';
        if (s.billing_type === 'package') {
          const used = getStudentPackageUsed(s);
          const rem = Math.max(0, (Number(s.package_total) || 0) - used);
          rightBadge = `<span class="badge ${rem <= 1 ? 'badge-unpaid' : 'badge-paid'}">🎫 ${rem}/${s.package_total || 0}</span>`;
        } else {
          rightBadge = `<div style="font-family:var(--font-display);font-weight:900;font-size:13.5px;">${formatMoney(s.hourly_rate)}/h</div>`;
        }
        return `
          <div class="entity-card" style="border-color:${esc(s.color || lm.primary)};" data-kind="student" data-id="${s.id}">
            <div class="avatar-circle" style="background:${esc(s.color || lm.primary)};">${esc(initials(s.name))}</div>
            <div class="entity-body">
              <div class="entity-name">${esc(s.name)}</div>
              <div class="entity-sub">${lm.flag} ${esc(s.language)}${s.level ? ' · ' + esc(s.level) : ''}</div>
              ${unpaid > 0 ? `<div style="margin-top:4px;"><span class="badge badge-unpaid">${esc(window.t('unpaid_balance'))}: ${formatMoney(unpaid)}</span></div>` : ''}
            </div>
            <div class="entity-right">${rightBadge}</div>
          </div>
        `;
      }
    }).join('');

    listWrap.querySelectorAll('.entity-card').forEach(el => {
      el.addEventListener('click', () => {
        if (el.dataset.kind === 'student') {
          const s = state.students.find(x => x.id === el.dataset.id);
          if (s) openStudentDetail(s);
        } else {
          const g = state.groups.find(x => x.id === el.dataset.id);
          if (g) openGroupDetail(g);
        }
      });
    });
  }

  // ================= STUDENT DETAIL (ANOTHER SESSION + PDF + WA) =================
  function openStudentDetail(student) {
    const lm = window.getLanguageMeta(student.language);
    const allLessons = getStudentAllLessons(student.id);
    const lastDone = getStudentLastCompleted(student.id);
    const unpaid = getStudentUnpaidTotal(student);
    const used = getStudentPackageUsed(student);
    const rem = Math.max(0, (Number(student.package_total) || 0) - used);

    $('detailModalTitle').textContent = student.name;
    $('detailModalBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div class="avatar-circle" style="background:${esc(student.color || lm.primary)};width:52px;height:52px;font-size:19px;">${esc(initials(student.name))}</div>
        <div style="flex:1;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <span class="badge" style="background:${lm.primary};color:${lm.textOnPrimary};">${lm.flag} ${esc(student.language)}</span>
            ${student.level ? `<span class="badge badge-neutral">${esc(student.level)}</span>` : ''}
          </div>
          <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px;">
            ${student.phone ? '📱 ' + esc(student.phone) : ''} ${student.parent_name ? '· 👤 ' + esc(student.parent_name) : ''}
          </div>
        </div>
        <button type="button" id="detEditStudent" class="cal-nav-btn">✏️</button>
      </div>

      <!-- Another Session: Last Lesson Context Card -->
      <div class="context-card" style="border-left-color:${lm.primary};">
        <div class="context-card-title">
          <span>✨ ${esc(window.t('last_session_ctx'))}</span>
          ${lastDone ? `<span style="font-size:11px;color:var(--text-muted);">${esc(lastDone.lesson_date)}</span>` : ''}
        </div>
        ${lastDone ? `
          <div class="context-row"><strong>${esc(window.t('last_topic'))}:</strong> ${esc(lastDone.topic || '-')}</div>
          <div class="context-row"><strong>${esc(window.t('next_homework'))}:</strong> ${esc(lastDone.homework || '-')}</div>
          ${lastDone.effectiveNote ? `<div class="context-row"><strong>${esc(window.t('last_progress'))}:</strong> ${esc(lastDone.effectiveNote)}</div>` : ''}
        ` : `<div class="context-row">${esc(window.t('no_prev_session'))}</div>`}
      </div>

      <!-- Package or Unpaid Summary -->
      ${student.billing_type === 'package' ? `
        <div class="card" style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:800;font-family:var(--font-display);">🎫 ${esc(student.package_name || window.t('package_badge'))}</div>
            <div style="font-size:12.5px;color:var(--text-muted);">
              ${esc(window.t('package_remaining'))}: <strong>${rem} / ${student.package_total || 0}</strong>
              ${rem <= 1 ? `· <span style="color:var(--danger);font-weight:700;">${esc(window.t('package_low'))}</span>` : ''}
            </div>
          </div>
          <button type="button" id="detRenewPkg" class="btn btn-secondary btn-sm">🔄 Top-up</button>
        </div>
      ` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <button type="button" id="detAddLesson" class="btn btn-primary btn-sm">+ ${esc(window.t('add_lesson_here'))}</button>
        <button type="button" id="detPdfBtn" class="btn btn-secondary btn-sm">📄 ${esc(window.t('pdf_report'))}</button>
        <button type="button" id="detWaBtn" class="btn btn-wa btn-sm">💬 ${esc(window.t('send_wa'))}</button>
        ${unpaid > 0
          ? `<button type="button" id="detMarkAllPaid" class="btn btn-secondary btn-sm">💰 ${esc(window.t('mark_all_paid'))} (${formatCompactMoney(unpaid)})</button>`
          : `<div class="badge badge-paid" style="justify-content:center;padding:8px;">✓ ${esc(window.t('paid'))}</div>`}
      </div>

      <div class="section-label">${esc(window.t('session_history'))} (${allLessons.length})</div>
      <div>
        ${allLessons.length === 0
          ? `<div class="empty-state">${esc(window.t('no_prev_session'))}</div>`
          : allLessons.slice(0, 30).map(l => `
            <div class="card" style="padding:12px;margin-bottom:8px;cursor:pointer;" data-open-lid="${l.id}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-family:var(--font-display);">${esc(l.lesson_date)} · ${esc(l.start_time)} (${l.duration_minutes}m)</strong>
                ${renderStatusBadge(l.effectiveStatus)}
              </div>
              ${l.isGroup ? `<div style="font-size:11.5px;color:var(--primary);font-weight:700;margin-top:3px;">👥 ${esc(l.groupName)}</div>` : ''}
              ${l.topic ? `<div style="font-size:13px;font-weight:600;margin-top:5px;">📘 ${esc(l.topic)}</div>` : ''}
              ${l.effectiveNote ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${esc(l.effectiveNote)}</div>` : ''}
              ${l.homework ? `<div style="font-size:12px;color:var(--primary);margin-top:3px;">📌 PR: ${esc(l.homework)}</div>` : ''}
            </div>
          `).join('')}
      </div>
    `;

    $('detEditStudent').onclick = () => { closeModal('detailModal'); openStudentModal(student); };
    $('detAddLesson').onclick = () => { closeModal('detailModal'); openLessonModal(null, state.selectedDate, 'student', student.id); };
    $('detPdfBtn').onclick = () => { closeModal('detailModal'); openPdfModal(student); };
    $('detWaBtn').onclick = () => sendStudentWhatsApp(student);

    if ($('detRenewPkg')) {
      $('detRenewPkg').onclick = () => openRenewPackagePrompt(student);
    }
    if ($('detMarkAllPaid')) {
      $('detMarkAllPaid').onclick = async () => {
        showLoading(true);
        try {
          const unpaidIds = state.lessons
            .filter(l => l.lesson_type === 'student' && l.student_id === student.id && !l.paid && (l.status === 'completed' || l.status === 'no_show'))
            .map(l => l.id);
          if (unpaidIds.length > 0) {
            const { error } = await sb.from('lessons').update({ paid: true }).in('id', unpaidIds);
            if (error) throw error;
          }
          if (student.billing_type === 'package' && !student.package_paid) {
            const { error } = await sb.from('students').update({ package_paid: true }).eq('id', student.id);
            if (error) throw error;
          }
          await syncFromCloud(true);
          closeModal('detailModal');
          showToast(window.t('saved_toast'));
        } catch (err) {
          showToast(err.message);
        } finally {
          showLoading(false);
        }
      };
    }

    $('detailModalBody').querySelectorAll('[data-open-lid]').forEach(card => {
      card.addEventListener('click', () => {
        const les = state.lessons.find(x => x.id === card.dataset.openLid);
        if (les) { closeModal('detailModal'); openLessonModal(les); }
      });
    });

    openModal('detailModal');
  }

  function openRenewPackagePrompt(student) {
    $('quickModalTitle').textContent = window.t('renew_package');
    $('quickModalBody').innerHTML = `
      <form id="renewPkgForm">
        <div class="field">
          <label>${esc(window.t('package_name'))}</label>
          <input type="text" id="rpName" required value="${esc(student.package_name || 'Paket 8 Sesi')} (Baru)" />
        </div>
        <div class="row-2">
          <div class="field">
            <label>${esc(window.t('package_total'))}</label>
            <input type="number" id="rpTotal" min="1" required value="${student.package_total || 8}" />
          </div>
          <div class="field">
            <label>${esc(window.t('package_price'))}</label>
            <input type="number" id="rpPrice" min="0" required value="${student.package_price || 800000}" />
          </div>
        </div>
        <label class="checkbox-row">
          <input type="checkbox" id="rpPaid" checked />
          <span>${esc(window.t('package_paid_label'))}</span>
        </label>
        <button type="submit" class="btn btn-primary btn-full">${esc(window.t('save'))}</button>
      </form>
    `;
    $('renewPkgForm').onsubmit = async (e) => {
      e.preventDefault();
      showLoading(true);
      try {
        const patch = {
          billing_type: 'package',
          package_name: $('rpName').value.trim(),
          package_total: Number($('rpTotal').value) || 8,
          package_used: 0,
          package_price: Number($('rpPrice').value) || 0,
          package_paid: $('rpPaid').checked
        };
        const { error } = await sb.from('students').update(patch).eq('id', student.id);
        if (error) throw error;
        await syncFromCloud(true);
        closeModal('quickModal');
        closeModal('detailModal');
        showToast(window.t('saved_toast'));
      } catch (err) {
        showToast(err.message);
      } finally {
        showLoading(false);
      }
    };
    openModal('quickModal');
  }

  function openGroupDetail(group) {
    const lm = window.getLanguageMeta(group.language);
    const members = (group.member_ids || []).map(id => state.students.find(s => s.id === id)).filter(Boolean);
    const grpLessons = state.lessons.filter(l => l.lesson_type === 'group' && l.group_id === group.id);

    $('detailModalTitle').textContent = group.name;
    $('detailModalBody').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div class="avatar-circle" style="background:${esc(group.color || lm.primary)};width:52px;height:52px;">👥</div>
        <div style="flex:1;">
          <span class="badge" style="background:${lm.primary};color:${lm.textOnPrimary};">${lm.flag} ${esc(group.language)}</span>
          <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px;">
            ${group.fee_mode === 'per_student' ? window.t('fee_per_student') : window.t('fee_flat')} · <strong>${formatMoney(group.rate)}</strong>
          </div>
        </div>
        <button type="button" id="detEditGroup" class="cal-nav-btn">✏️</button>
      </div>

      <button type="button" id="detAddGroupLesson" class="btn btn-primary btn-full btn-sm" style="margin-bottom:14px;">+ ${esc(window.t('add_lesson_here'))} (${esc(group.name)})</button>

      <div class="section-label">${esc(window.t('group_members'))} (${members.length})</div>
      <div class="card" style="padding:10px 12px;">
        ${members.length === 0 ? `<div style="color:var(--text-muted);font-size:13px;">-</div>` : members.map(m => `
          <div style="padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <strong>${esc(m.name)}</strong>
            <span style="font-size:12px;color:var(--text-muted);">${esc(m.level || '')}</span>
          </div>
        `).join('')}
      </div>

      <div class="section-label">${esc(window.t('session_history'))} (${grpLessons.length})</div>
      ${grpLessons.slice(0, 20).map(l => `
        <div class="card" style="padding:12px;margin-bottom:8px;cursor:pointer;" data-open-lid="${l.id}">
          <div style="display:flex;justify-content:space-between;">
            <strong>${esc(l.lesson_date)} · ${esc(l.start_time)} (${l.duration_minutes}m)</strong>
            <span>${formatMoney(l.fee)}</span>
          </div>
          <div style="margin-top:5px;display:flex;gap:6px;">${renderStatusBadge(l.status)} <span class="badge ${l.paid ? 'badge-paid' : 'badge-unpaid'}">${l.paid ? window.t('paid') : window.t('unpaid')}</span></div>
          ${l.topic ? `<div style="font-size:12.5px;margin-top:5px;">📘 ${esc(l.topic)}</div>` : ''}
        </div>
      `).join('')}
    `;

    $('detEditGroup').onclick = () => { closeModal('detailModal'); openGroupModal(group); };
    $('detAddGroupLesson').onclick = () => { closeModal('detailModal'); openLessonModal(null, state.selectedDate, 'group', group.id); };
    $('detailModalBody').querySelectorAll('[data-open-lid]').forEach(c => {
      c.addEventListener('click', () => {
        const les = state.lessons.find(x => x.id === c.dataset.openLid);
        if (les) { closeModal('detailModal'); openLessonModal(les); }
      });
    });
    openModal('detailModal');
  }

  // ================= MODAL: ADD / EDIT LESSON =================
  function openLessonModal(lesson = null, presetDate = null, presetType = null, presetEntityId = null) {
    $('lessonId').value = lesson ? lesson.id : '';
    $('lessonModalTitle').textContent = lesson ? window.t('lesson_details') : window.t('add_lesson_here');
    $('lessonDeleteBtn').classList.toggle('hidden', !lesson);
    $('repeatLessonWrap').classList.toggle('hidden', !!lesson);

    // Populate student & group dropdowns
    $('lessonStudentId').innerHTML = state.students.length
      ? state.students.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.language)})</option>`).join('')
      : `<option value="">-- ${esc(window.t('add_student'))} --</option>`;

    $('lessonGroupId').innerHTML = state.groups.length
      ? state.groups.map(g => `<option value="${g.id}">👥 ${esc(g.name)} (${esc(g.language)})</option>`).join('')
      : `<option value="">-- ${esc(window.t('add_group'))} --</option>`;

    const type = lesson ? lesson.lesson_type : (presetType || (state.students.length ? 'student' : (state.groups.length ? 'group' : 'student')));
    setLessonType(type);

    if (lesson) {
      if (lesson.lesson_type === 'student' && lesson.student_id) $('lessonStudentId').value = lesson.student_id;
      if (lesson.lesson_type === 'group' && lesson.group_id) $('lessonGroupId').value = lesson.group_id;
      $('lessonDate').value = lesson.lesson_date;
      $('lessonStart').value = lesson.start_time || '16:00';
      $('lessonEnd').value = lesson.end_time || '17:00';
      setDurationUI(Number(lesson.duration_minutes) || 60, false);
      $('lessonStatus').value = lesson.status || 'scheduled';
      $('lessonFee').value = Number(lesson.fee) || 0;
      $('lessonPaid').checked = !!lesson.paid;
      $('lessonUsesPackage').checked = !!lesson.uses_package;
      $('lessonPackageTag').value = lesson.package_label || '';
      $('lessonTopic').value = lesson.topic || '';
      $('lessonProgress').value = lesson.progress_notes || '';
      $('lessonHomework').value = lesson.homework || '';
      state.tempGroupAttendees = Array.isArray(lesson.attendees) ? JSON.parse(JSON.stringify(lesson.attendees)) : [];
    } else {
      if (presetType === 'student' && presetEntityId) $('lessonStudentId').value = presetEntityId;
      if (presetType === 'group' && presetEntityId) $('lessonGroupId').value = presetEntityId;
      $('lessonDate').value = presetDate || state.selectedDate || toDateStr(new Date());
      $('lessonStart').value = '16:00';
      $('lessonStatus').value = 'scheduled';
      $('lessonRepeatToggle').checked = false;
      $('repeatWeeksWrap').classList.add('hidden');
      $('lessonPaid').checked = false;
      $('lessonTopic').value = '';
      $('lessonProgress').value = '';
      $('lessonHomework').value = '';
      state.tempGroupAttendees = [];
      setDurationUI(60, false);
    }

    refreshLessonEntityContext(!lesson);
    openModal('lessonModal');
  }

  function setLessonType(type) {
    state.lessonType = type;
    $('lTypeStudent').classList.toggle('active', type === 'student');
    $('lTypeGroup').classList.toggle('active', type === 'group');
    $('lessonStudentWrap').classList.toggle('hidden', type !== 'student');
    $('lessonGroupWrap').classList.toggle('hidden', type !== 'group');
    $('groupAttendanceWrap').classList.toggle('hidden', type !== 'group');
  }

  function setDurationUI(mins, recalc = true) {
    state.selectedDuration = Number(mins) || 60;
    const presets = [30, 45, 60, 90, 120];
    const isPreset = presets.includes(state.selectedDuration);
    $('durationChips').querySelectorAll('.chip').forEach(c => {
      const val = c.dataset.dur;
      c.classList.toggle('active', isPreset ? Number(val) === state.selectedDuration : val === 'custom');
    });
    const man = $('lessonDurationManual');
    man.classList.toggle('hidden', isPreset);
    if (!isPreset) man.value = state.selectedDuration;

    $('lessonEnd').value = addMinutesToTime($('lessonStart').value, state.selectedDuration);
    if (recalc) recalcLessonFee();
  }

  function refreshLessonEntityContext(autoCalcFee = true) {
    const ctxBanner = $('lessonContextBanner');
    const pkgWrap = $('packageUseWrap');

    if (state.lessonType === 'student') {
      const sid = $('lessonStudentId').value;
      const stu = state.students.find(s => s.id === sid);
      if (!stu) {
        ctxBanner.classList.add('hidden');
        pkgWrap.classList.add('hidden');
        return;
      }

      // Another Session context strip
      const last = getStudentLastCompleted(stu.id);
      if (last) {
        ctxBanner.classList.remove('hidden');
        ctxBanner.innerHTML = `
          <div class="context-card-title"><span>✨ ${esc(window.t('last_session_ctx'))}</span><span>${esc(last.lesson_date)}</span></div>
          <div class="context-row"><strong>${esc(window.t('last_topic'))}:</strong> ${esc(last.topic || '-')}</div>
          <div class="context-row"><strong>${esc(window.t('next_homework'))}:</strong> ${esc(last.homework || '-')}</div>
        `;
      } else {
        ctxBanner.classList.add('hidden');
      }

      // Package options
      if (stu.billing_type === 'package') {
        const used = getStudentPackageUsed(stu);
        const rem = Math.max(0, (Number(stu.package_total) || 0) - used);
        pkgWrap.classList.remove('hidden');
        $('packageUseLabel').textContent = `${window.t('use_package_quota')} (${rem}/${stu.package_total || 0})`;
        if (autoCalcFee) {
          $('lessonUsesPackage').checked = rem > 0;
          $('lessonPackageTag').value = stu.package_name || '';
          $('lessonPaid').checked = !!stu.package_paid;
        }
      } else {
        pkgWrap.classList.add('hidden');
        if (autoCalcFee) {
          $('lessonUsesPackage').checked = false;
          $('lessonPackageTag').value = '';
        }
      }
    } else {
      ctxBanner.classList.add('hidden');
      pkgWrap.classList.add('hidden');
      const gid = $('lessonGroupId').value;
      const grp = state.groups.find(g => g.id === gid);
      if (grp) {
        const memberIds = Array.isArray(grp.member_ids) ? grp.member_ids : [];
        if (state.tempGroupAttendees.length === 0 || autoCalcFee) {
          state.tempGroupAttendees = memberIds.map(mid => {
            const st = state.students.find(s => s.id === mid);
            const existing = state.tempGroupAttendees.find(a => a.student_id === mid);
            return existing || { student_id: mid, name: st ? st.name : 'Student', status: 'present', note: '' };
          });
        }
        renderGroupAttendanceChecklist();
      } else {
        $('groupAttendanceList').innerHTML = '';
      }
    }

    if (autoCalcFee) recalcLessonFee();
  }

  function renderGroupAttendanceChecklist() {
    const wrap = $('groupAttendanceList');
    if (state.tempGroupAttendees.length === 0) {
      wrap.innerHTML = `<div style="font-size:12.5px;color:var(--text-muted);">${esc(window.t('no_students_for_group'))}</div>`;
      return;
    }
    wrap.innerHTML = state.tempGroupAttendees.map((a, i) => `
      <div class="att-row">
        <strong style="font-size:13px;">${esc(a.name)}</strong>
        <div class="att-btns">
          <button type="button" class="att-btn present ${a.status === 'present' ? 'active' : ''}" data-idx="${i}" data-st="present">${esc(window.t('att_present'))}</button>
          <button type="button" class="att-btn excused ${a.status === 'excused' ? 'active' : ''}" data-idx="${i}" data-st="excused">${esc(window.t('att_excused'))}</button>
          <button type="button" class="att-btn absent ${a.status === 'absent' ? 'active' : ''}" data-idx="${i}" data-st="absent">${esc(window.t('att_absent'))}</button>
        </div>
      </div>
    `).join('');

    wrap.querySelectorAll('.att-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        state.tempGroupAttendees[idx].status = btn.dataset.st;
        renderGroupAttendanceChecklist();
        recalcLessonFee();
      });
    });
  }

  function recalcLessonFee() {
    const status = $('lessonStatus').value;
    if (status === 'cancelled' || status === 'rescheduled') {
      $('lessonFee').value = 0;
      return;
    }
    const mins = Number(state.selectedDuration) || 60;
    if (state.lessonType === 'student') {
      const stu = state.students.find(s => s.id === $('lessonStudentId').value);
      if (!stu) return;
      if ($('lessonUsesPackage').checked && stu.billing_type === 'package' && Number(stu.package_total) > 0) {
        $('lessonFee').value = Math.round((Number(stu.package_price) || 0) / Number(stu.package_total));
      } else {
        $('lessonFee').value = Math.round((Number(stu.hourly_rate) || 0) * (mins / 60));
      }
    } else {
      const grp = state.groups.find(g => g.id === $('lessonGroupId').value);
      if (!grp) return;
      const base = (Number(grp.rate) || 0) * (mins / 60);
      if (grp.fee_mode === 'per_student') {
        const presentCount = state.tempGroupAttendees.filter(a => a.status === 'present').length;
        $('lessonFee').value = Math.round(base * presentCount);
      } else {
        $('lessonFee').value = Math.round(base);
      }
    }
  }

  async function handleSaveLesson(e) {
    e.preventDefault();
    const id = $('lessonId').value;
    const isStu = state.lessonType === 'student';
    const stuId = isStu ? $('lessonStudentId').value : null;
    const grpId = !isStu ? $('lessonGroupId').value : null;

    if (isStu && !stuId) { showToast(window.t('choose_student')); return; }
    if (!isStu && !grpId) { showToast(window.t('choose_group')); return; }

    const basePayload = {
      user_id: state.user.id,
      lesson_type: state.lessonType,
      student_id: stuId || null,
      group_id: grpId || null,
      lesson_date: $('lessonDate').value,
      start_time: $('lessonStart').value,
      end_time: $('lessonEnd').value,
      duration_minutes: Number(state.selectedDuration) || 60,
      status: $('lessonStatus').value,
      fee: Number($('lessonFee').value) || 0,
      paid: $('lessonPaid').checked,
      uses_package: isStu && $('lessonUsesPackage').checked,
      package_label: isStu ? $('lessonPackageTag').value.trim() : '',
      topic: $('lessonTopic').value.trim(),
      progress_notes: $('lessonProgress').value.trim(),
      homework: $('lessonHomework').value.trim(),
      attendees: !isStu ? state.tempGroupAttendees : []
    };

    showLoading(true);
    try {
      if (id) {
        const { error } = await sb.from('lessons').update(basePayload).eq('id', id);
        if (error) throw error;
      } else {
        const repeatOn = $('lessonRepeatToggle').checked;
        const weeks = repeatOn ? Math.max(2, Math.min(16, Number($('lessonRepeatWeeks').value) || 4)) : 1;
        const repeatUid = repeatOn ? (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) : null;
        const rows = [];
        for (let w = 0; w < weeks; w++) {
          rows.push({
            ...basePayload,
            lesson_date: addDays(basePayload.lesson_date, w * 7),
            status: w === 0 ? basePayload.status : 'scheduled',
            paid: w === 0 ? basePayload.paid : false,
            repeat_group_id: repeatUid
          });
        }
        const { error } = await sb.from('lessons').insert(rows);
        if (error) throw error;
      }

      state.selectedDate = basePayload.lesson_date;
      await syncFromCloud(true);
      closeModal('lessonModal');
      showToast(window.t('saved_toast'));
    } catch (err) {
      showToast(err.message);
    } finally {
      showLoading(false);
    }
  }

  async function handleDeleteLesson() {
    const id = $('lessonId').value;
    if (!id || !confirm(window.t('confirm_delete'))) return;
    showLoading(true);
    try {
      const { error } = await sb.from('lessons').delete().eq('id', id);
      if (error) throw error;
      await syncFromCloud(true);
      closeModal('lessonModal');
      showToast(window.t('deleted_toast'));
    } catch (err) {
      showToast(err.message);
    } finally {
      showLoading(false);
    }
  }

  // ================= MODAL: ADD / EDIT STUDENT =================
  function openStudentModal(student = null) {
    $('stuId').value = student ? student.id : '';
    $('studentModalTitle').textContent = student ? window.t('edit_student') : window.t('add_student');
    $('stuDeleteBtn').classList.toggle('hidden', !student);

    $('stuName').value = student ? student.name : '';
    $('stuParent').value = student ? (student.parent_name || '') : '';
    $('stuLevel').value = student ? (student.level || '') : '';
    $('stuPhone').value = student ? (student.phone || '') : '';
    $('stuBillingType').value = student ? (student.billing_type || 'per_session') : 'per_session';
    $('stuRate').value = student ? (Number(student.hourly_rate) || 0) : 100000;
    $('stuPkgName').value = student ? (student.package_name || 'Paket 8 Sesi') : 'Paket 8 Sesi';
    $('stuPkgTotal').value = student ? (student.package_total || 8) : 8;
    $('stuPkgPrice').value = student ? (student.package_price || 800000) : 800000;
    $('stuPkgPaid').checked = student ? !!student.package_paid : false;
    $('stuNotes').value = student ? (student.notes || '') : '';

    const knownLang = student && CFG.LANGUAGES.some(l => l.id === student.language);
    if (student && !knownLang) {
      $('stuLang').value = '__custom__';
      $('stuLangCustomWrap').classList.remove('hidden');
      $('stuLangCustom').value = student.language;
    } else {
      $('stuLang').value = student ? student.language : 'English';
      $('stuLangCustomWrap').classList.add('hidden');
      $('stuLangCustom').value = '';
    }

    $('stuPackageFields').classList.toggle('hidden', $('stuBillingType').value !== 'package');
    const defaultCol = student ? student.color : window.getLanguageMeta($('stuLang').value).primary;
    renderSwatches('stuColorSwatches', 'stuColor', defaultCol);

    openModal('studentModal');
  }

  async function handleSaveStudent(e) {
    e.preventDefault();
    const id = $('stuId').value;
    const langSel = $('stuLang').value;
    const language = langSel === '__custom__' ? ($('stuLangCustom').value.trim() || 'Other') : langSel;

    const payload = {
      user_id: state.user.id,
      name: $('stuName').value.trim(),
      parent_name: $('stuParent').value.trim(),
      language,
      level: $('stuLevel').value.trim(),
      phone: $('stuPhone').value.trim(),
      billing_type: $('stuBillingType').value,
      hourly_rate: Number($('stuRate').value) || 0,
      package_name: $('stuPkgName').value.trim(),
      package_total: Number($('stuPkgTotal').value) || 0,
      package_price: Number($('stuPkgPrice').value) || 0,
      package_paid: $('stuPkgPaid').checked,
      color: $('stuColor').value || '#434786',
      notes: $('stuNotes').value.trim()
    };

    showLoading(true);
    try {
      if (id) {
        const { error } = await sb.from('students').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('students').insert(payload);
        if (error) throw error;
      }
      await syncFromCloud(true);
      closeModal('studentModal');
      showToast(window.t('saved_toast'));
    } catch (err) {
      showToast(err.message);
    } finally {
      showLoading(false);
    }
  }

  async function handleDeleteStudent() {
    const id = $('stuId').value;
    if (!id || !confirm(window.t('confirm_delete'))) return;
    showLoading(true);
    try {
      const { error } = await sb.from('students').delete().eq('id', id);
      if (error) throw error;
      await syncFromCloud(true);
      closeModal('studentModal');
      showToast(window.t('deleted_toast'));
    } catch (err) {
      showToast(err.message);
    } finally {
      showLoading(false);
    }
  }

  // ================= MODAL: ADD / EDIT GROUP =================
  function openGroupModal(group = null) {
    $('grpId').value = group ? group.id : '';
    $('groupModalTitle').textContent = group ? window.t('edit_group') : window.t('add_group');
    $('grpDeleteBtn').classList.toggle('hidden', !group);

    $('grpName').value = group ? group.name : '';
    $('grpLevel').value = group ? (group.level || '') : '';
    $('grpFeeMode').value = group ? (group.fee_mode || 'flat') : 'flat';
    $('grpRate').value = group ? (Number(group.rate) || 0) : 150000;
    $('grpNotes').value = group ? (group.notes || '') : '';

    const knownLang = group && CFG.LANGUAGES.some(l => l.id === group.language);
    if (group && !knownLang) {
      $('grpLang').value = '__custom__';
      $('grpLangCustomWrap').classList.remove('hidden');
      $('grpLangCustom').value = group.language;
    } else {
      $('grpLang').value = group ? group.language : 'English';
      $('grpLangCustomWrap').classList.add('hidden');
      $('grpLangCustom').value = '';
    }

    const selectedIds = new Set(group && Array.isArray(group.member_ids) ? group.member_ids : []);
    $('grpMembersList').innerHTML = state.students.length === 0
      ? `<div style="font-size:12.5px;color:var(--text-muted);">${esc(window.t('no_students_for_group'))}</div>`
      : state.students.map(s => `
        <label class="checkbox-row" style="margin-bottom:6px;">
          <input type="checkbox" class="grp-mem-cb" value="${s.id}" ${selectedIds.has(s.id) ? 'checked' : ''} />
          <span>${esc(s.name)} <small style="color:var(--text-muted);">(${esc(s.language)})</small></span>
        </label>
      `).join('');

    const defaultCol = group ? group.color : window.getLanguageMeta($('grpLang').value).primary;
    renderSwatches('grpColorSwatches', 'grpColor', defaultCol);

    openModal('groupModal');
  }

  async function handleSaveGroup(e) {
    e.preventDefault();
    const id = $('grpId').value;
    const langSel = $('grpLang').value;
    const language = langSel === '__custom__' ? ($('grpLangCustom').value.trim() || 'Other') : langSel;
    const memberIds = Array.from(document.querySelectorAll('.grp-mem-cb:checked')).map(cb => cb.value);

    const payload = {
      user_id: state.user.id,
      name: $('grpName').value.trim(),
      language,
      level: $('grpLevel').value.trim(),
      fee_mode: $('grpFeeMode').value,
      rate: Number($('grpRate').value) || 0,
      member_ids: memberIds,
      color: $('grpColor').value || '#002CA6',
      notes: $('grpNotes').value.trim()
    };

    showLoading(true);
    try {
      if (id) {
        const { error } = await sb.from('tutor_groups').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('tutor_groups').insert(payload);
        if (error) throw error;
      }
      await syncFromCloud(true);
      closeModal('groupModal');
      showToast(window.t('saved_toast'));
    } catch (err) {
      showToast(err.message);
    } finally {
      showLoading(false);
    }
  }

  async function handleDeleteGroup() {
    const id = $('grpId').value;
    if (!id || !confirm(window.t('confirm_delete'))) return;
    showLoading(true);
    try {
      const { error } = await sb.from('tutor_groups').delete().eq('id', id);
      if (error) throw error;
      await syncFromCloud(true);
      closeModal('groupModal');
      showToast(window.t('deleted_toast'));
    } catch (err) {
      showToast(err.message);
    } finally {
      showLoading(false);
    }
  }

  // ================= WHATSAPP RECAP (EDITABLE TEMPLATE) =================
  function getActiveWaTemplate() {
    if (state.profile.wa_template && state.profile.wa_template.trim()) {
      return state.profile.wa_template;
    }
    return CFG.DEFAULT_WA_TEMPLATES[window.currentLang] || CFG.DEFAULT_WA_TEMPLATES.id;
  }

  function normalizePhoneForWa(raw) {
    let digits = String(raw || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
    if (digits.startsWith('0')) digits = '62' + digits.slice(1);
    return digits;
  }

  function sendStudentWhatsApp(student) {
    const now = state.calCursor;
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const months = window.t('months_full');
    const periodLabel = `${months[now.getMonth()]} ${now.getFullYear()}`;

    const monthLessons = getStudentAllLessons(student.id)
      .filter(l => l.lesson_date.startsWith(ym) && (l.effectiveStatus === 'completed' || l.effectiveStatus === 'present' || l.effectiveStatus === 'no_show'))
      .reverse();

    const totalMin = monthLessons.reduce((s, l) => s + (Number(l.duration_minutes) || 0), 0);
    const totalJam = (totalMin / 60).toFixed(1).replace(/\.0$/, '');
    const unpaid = getStudentUnpaidTotal(student);

    const statusPaket = student.billing_type === 'package'
      ? `${student.package_name || 'Paket'} (Sisa ${Math.max(0, (student.package_total || 0) - getStudentPackageUsed(student))}/${student.package_total || 0})`
      : window.t('bill_per_session');

    const rincian = monthLessons.length
      ? monthLessons.map((l, i) => `${i + 1}. ${l.lesson_date} (${l.duration_minutes}m) — ${l.topic || '-'}${l.homework ? ' | PR: ' + l.homework : ''}`).join('\n')
      : '-';

    let msg = getActiveWaTemplate()
      .replaceAll('{nama_murid}', student.name)
      .replaceAll('{nama_ortu}', student.parent_name || student.name)
      .replaceAll('{bahasa}', student.language)
      .replaceAll('{periode}', periodLabel)
      .replaceAll('{jumlah_sesi}', String(monthLessons.length))
      .replaceAll('{total_jam}', totalJam)
      .replaceAll('{total_tagihan}', unpaid > 0 ? formatMoney(unpaid) : window.t('paid'))
      .replaceAll('{status_paket}', statusPaket)
      .replaceAll('{rincian_sesi}', rincian)
      .replaceAll('{nama_tutor}', state.profile.full_name || 'Tutor Grow');

    const phone = normalizePhoneForWa(student.phone);
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      navigator.clipboard?.writeText(msg).then(() => showToast(window.t('copied_toast'))).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      });
    }
  }

  // ================= PDF PROGRESS REPORT MODAL =================
  function openPdfModal(student) {
    $('pdfStudentId').value = student.id;
    const lm = window.getLanguageMeta(student.language);
    $('pdfStudentBanner').innerHTML = `
      <div class="context-card-title"><span>${lm.flag} ${esc(student.name)}</span><span>${esc(student.language)}</span></div>
      <div class="context-row">${esc(student.level || '')}</div>
    `;

    const now = state.calCursor;
    $('pdfMonthInput').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Collect distinct package labels for this student
    const pkgSet = new Set();
    if (student.package_name) pkgSet.add(student.package_name);
    state.lessons
      .filter(l => l.student_id === student.id && l.package_label)
      .forEach(l => pkgSet.add(l.package_label));
    const pkgList = Array.from(pkgSet);
    $('pdfPkgSelect').innerHTML = pkgList.length
      ? pkgList.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')
      : `<option value="">${esc(window.t('package_badge'))}</option>`;

    setPdfScope('month');
    $('pdfEvaluation').value = '';
    openModal('pdfModal');
  }

  function setPdfScope(scope) {
    state.pdfScope = scope;
    $('pdfScopeMonth').classList.toggle('active', scope === 'month');
    $('pdfScopePkg').classList.toggle('active', scope === 'package');
    $('pdfMonthWrap').classList.toggle('hidden', scope !== 'month');
    $('pdfPkgWrap').classList.toggle('hidden', scope !== 'package');
  }

  async function handleGeneratePdf(e) {
    e.preventDefault();
    const stu = state.students.find(s => s.id === $('pdfStudentId').value);
    if (!stu) return;

    const all = getStudentAllLessons(stu.id).reverse(); // chronological for report
    let filtered = [];
    let scopeLabel = '';

    if (state.pdfScope === 'month') {
      const ym = $('pdfMonthInput').value || toDateStr(new Date()).slice(0, 7);
      filtered = all.filter(l => l.lesson_date.startsWith(ym));
      const [y, m] = ym.split('-').map(Number);
      const months = window.t('months_full');
      scopeLabel = `${months[(m || 1) - 1]} ${y}`;
    } else {
      const pkg = $('pdfPkgSelect').value;
      filtered = all.filter(l => (l.package_label || '') === pkg && l.uses_package);
      scopeLabel = pkg || window.t('package_badge');
    }

    const btn = $('pdfSubmitBtn');
    btn.disabled = true;
    showLoading(true);
    try {
      await window.TutorPdfReport.generateAndShare({
        student: stu,
        lessons: filtered,
        scopeLabel,
        includeFee: $('pdfIncludeFee').checked,
        evaluation: $('pdfEvaluation').value,
        tutorName: state.profile.full_name || 'Tutor Grow',
        formatMoney,
        langCode: window.currentLang
      });
      closeModal('pdfModal');
      showToast(window.t('saved_toast'));
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Gagal membuat PDF.');
    } finally {
      btn.disabled = false;
      showLoading(false);
    }
  }

  // ================= TAB 3: STATISTICS =================
  function getStatRange(period, offset) {
    const now = new Date();
    const months = window.t('months_full');
    let start, end, prevStart, prevEnd, label, buckets = [];

    if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() + offset * 7);
      const fd = Number(state.profile.first_day_of_week) === 0 ? 0 : 1;
      let diff = d.getDay() - fd;
      if (diff < 0) diff += 7;
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
      end = new Date(start); end.setDate(start.getDate() + 6);
      prevStart = new Date(start); prevStart.setDate(start.getDate() - 7);
      prevEnd = new Date(end); prevEnd.setDate(end.getDate() - 7);
      label = `${start.getDate()} ${months[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${months[end.getMonth()].slice(0, 3)}`;
      const daysShort = window.t('days_short');
      for (let i = 0; i < 7; i++) {
        const bd = new Date(start); bd.setDate(start.getDate() + i);
        const s = toDateStr(bd);
        buckets.push({ label: daysShort[bd.getDay()], from: s, to: s });
      }
    } else if (period === 'month') {
      const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = target.getFullYear(), m = target.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      start = new Date(y, m, 1);
      end = new Date(y, m, lastDay);
      prevStart = new Date(y, m - 1, 1);
      prevEnd = new Date(y, m, 0);
      label = `${months[m]} ${y}`;
      const ranges = [[1, 7], [8, 14], [15, 21], [22, 28]];
      if (lastDay > 28) ranges.push([29, lastDay]);
      buckets = ranges.map(([a, b]) => ({
        label: `${a}-${b}`,
        from: toDateStr(new Date(y, m, a)),
        to: toDateStr(new Date(y, m, b))
      }));
    } else if (period === '3mo' || period === '6mo') {
      const span = period === '3mo' ? 3 : 6;
      const endMonth = new Date(now.getFullYear(), now.getMonth() + offset * span, 1);
      start = new Date(endMonth.getFullYear(), endMonth.getMonth() - (span - 1), 1);
      end = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0);
      prevStart = new Date(start.getFullYear(), start.getMonth() - span, 1);
      prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
      label = `${months[start.getMonth()].slice(0, 3)} – ${months[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
      for (let i = 0; i < span; i++) {
        const bm = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const bmEnd = new Date(bm.getFullYear(), bm.getMonth() + 1, 0);
        buckets.push({ label: months[bm.getMonth()].slice(0, 3), from: toDateStr(bm), to: toDateStr(bmEnd) });
      }
    } else {
      const y = now.getFullYear() + offset;
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31);
      prevStart = new Date(y - 1, 0, 1);
      prevEnd = new Date(y - 1, 11, 31);
      label = String(y);
      for (let m = 0; m < 12; m++) {
        const bm = new Date(y, m, 1);
        const bmEnd = new Date(y, m + 1, 0);
        buckets.push({ label: String(m + 1), from: toDateStr(bm), to: toDateStr(bmEnd) });
      }
    }

    return {
      from: toDateStr(start),
      to: toDateStr(end),
      prevFrom: toDateStr(prevStart),
      prevTo: toDateStr(prevEnd),
      label,
      buckets
    };
  }

  function renderStatsView() {
    document.querySelectorAll('.stat-period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === state.statPeriod));
    const range = getStatRange(state.statPeriod, state.statOffset);
    $('statPeriodLabel').textContent = range.label;

    const inRange = state.lessons.filter(l => l.lesson_date >= range.from && l.lesson_date <= range.to);
    const inPrev = state.lessons.filter(l => l.lesson_date >= range.prevFrom && l.lesson_date <= range.prevTo);

    const activeLessons = inRange.filter(l => l.status !== 'cancelled' && l.status !== 'rescheduled');
    const actualIncome = activeLessons.filter(l => l.paid).reduce((s, l) => s + (Number(l.fee) || 0), 0);
    const projectedIncome = activeLessons.reduce((s, l) => s + (Number(l.fee) || 0), 0);
    const prevProjected = inPrev.filter(l => l.status !== 'cancelled' && l.status !== 'rescheduled').reduce((s, l) => s + (Number(l.fee) || 0), 0);

    $('statActualIncome').textContent = formatMoney(actualIncome);
    $('statProjectedIncome').textContent = formatMoney(projectedIncome);

    const deltaEl = $('statDeltaText');
    if (prevProjected > 0) {
      const pct = Math.round(((projectedIncome - prevProjected) / prevProjected) * 100);
      deltaEl.textContent = `${pct >= 0 ? '↑ +' : '↓ '}${pct}% ${window.t('vs_prev')}`;
      deltaEl.className = `kpi-delta ${pct >= 0 ? 'up' : 'down'}`;
    } else {
      deltaEl.textContent = '';
    }

    // Bar Chart
    const bucketVals = range.buckets.map(b => {
      const sum = activeLessons
        .filter(l => l.lesson_date >= b.from && l.lesson_date <= b.to)
        .reduce((s, l) => s + (Number(l.fee) || 0), 0);
      return { ...b, val: sum };
    });
    const maxVal = Math.max(1, ...bucketVals.map(b => b.val));
    $('statChart').innerHTML = bucketVals.map(b => {
      const hPct = Math.round((b.val / maxVal) * 100);
      return `
        <div class="chart-col">
          <div class="chart-val">${b.val > 0 ? formatCompactMoney(b.val) : ''}</div>
          <div class="chart-bar" style="height:${Math.max(4, hPct)}%;opacity:${b.val > 0 ? 1 : 0.2};"></div>
          <div class="chart-lbl">${esc(b.label)}</div>
        </div>
      `;
    }).join('');

    // Detailed metrics (TutorPlan style)
    const completed = inRange.filter(l => l.status === 'completed' || l.status === 'no_show');
    const upcoming = inRange.filter(l => l.status === 'scheduled');
    const cancelled = inRange.filter(l => l.status === 'cancelled');
    const rescheduled = inRange.filter(l => l.status === 'rescheduled');
    const unpaidAmt = completed.filter(l => !l.paid).reduce((s, l) => s + (Number(l.fee) || 0), 0);
    const totalHours = (completed.reduce((s, l) => s + (Number(l.duration_minutes) || 0), 0) / 60).toFixed(1).replace(/\.0$/, '');
    const avgPrice = activeLessons.length ? Math.round(projectedIncome / activeLessons.length) : 0;

    $('statMetricsCard').innerHTML = `
      <div class="metric-row">
        <div class="metric-left"><span class="sq-icon" style="background:var(--success-bg);">💵</span> ${esc(window.t('avg_price'))}</div>
        <div class="metric-val">${formatMoney(avgPrice)}</div>
      </div>
      <div class="metric-row">
        <div class="metric-left"><span class="sq-icon" style="background:var(--primary-soft);">⏱️</span> ${esc(window.t('teaching_hours'))}</div>
        <div class="metric-val">${totalHours}h</div>
      </div>
      <div class="metric-row">
        <div class="metric-left"><span class="sq-icon" style="background:var(--warning-bg);">✖️</span> ${esc(window.t('total_cancellations'))}</div>
        <div class="metric-val">${cancelled.length}</div>
      </div>
      <div class="metric-row">
        <div class="metric-left"><span class="sq-icon" style="background:var(--warning-bg);">🔁</span> ${esc(window.t('total_reschedules'))}</div>
        <div class="metric-val">${rescheduled.length}</div>
      </div>
      <div class="metric-row">
        <div class="metric-left"><span class="sq-icon" style="background:#EDE8FF;">🎓</span> ${esc(window.t('lessons_completed'))}</div>
        <div class="metric-val">${completed.length}</div>
      </div>
      <div class="metric-row">
        <div class="metric-left"><span class="sq-icon" style="background:var(--info-bg);">📅</span> ${esc(window.t('upcoming_lessons'))}</div>
        <div class="metric-val">${upcoming.length}</div>
      </div>
      <div class="metric-row">
        <div class="metric-left"><span class="sq-icon" style="background:var(--danger-bg);">🧾</span> ${esc(window.t('unpaid_amount'))}</div>
        <div class="metric-val" style="color:${unpaidAmt > 0 ? 'var(--danger)' : 'var(--success)'};">${formatMoney(unpaidAmt)}</div>
      </div>
    `;

    // Breakdown by Groups & Students
    let breakdownHtml = '';
    if (state.groups.length > 0) {
      breakdownHtml += `<div class="section-label">${esc(window.t('groups_heading'))}</div>`;
      breakdownHtml += state.groups.map(g => {
        const gl = activeLessons.filter(l => l.lesson_type === 'group' && l.group_id === g.id);
        const earned = gl.reduce((s, l) => s + (Number(l.fee) || 0), 0);
        return `
          <div class="entity-card" style="border-color:${esc(g.color || '#434786')};" data-stat-grp="${g.id}">
            <div class="avatar-circle" style="background:${esc(g.color || '#434786')};">${esc(initials(g.name))}</div>
            <div class="entity-body">
              <div class="entity-name">${esc(g.name)}</div>
              <div class="entity-sub">${gl.length} sesi</div>
            </div>
            <div class="entity-right"><strong>${formatMoney(earned)}</strong></div>
          </div>
        `;
      }).join('');
    }
    if (state.students.length > 0) {
      breakdownHtml += `<div class="section-label">${esc(window.t('students_heading'))}</div>`;
      breakdownHtml += state.students.map(st => {
        const sl = activeLessons.filter(l => l.lesson_type === 'student' && l.student_id === st.id);
        const earned = sl.reduce((s, l) => s + (Number(l.fee) || 0), 0);
        return `
          <div class="entity-card" style="border-color:${esc(st.color || '#434786')};" data-stat-stu="${st.id}">
            <div class="avatar-circle" style="background:${esc(st.color || '#434786')};">${esc(initials(st.name))}</div>
            <div class="entity-body">
              <div class="entity-name">${esc(st.name)}</div>
              <div class="entity-sub">${sl.length} sesi · ${esc(st.language)}</div>
            </div>
            <div class="entity-right"><strong>${formatMoney(earned)}</strong></div>
          </div>
        `;
      }).join('');
    }
    $('statBreakdownWrap').innerHTML = breakdownHtml;

    $('statBreakdownWrap').querySelectorAll('[data-stat-stu]').forEach(el => {
      el.addEventListener('click', () => {
        const s = state.students.find(x => x.id === el.dataset.statStu);
        if (s) openStudentDetail(s);
      });
    });
    $('statBreakdownWrap').querySelectorAll('[data-stat-grp]').forEach(el => {
      el.addEventListener('click', () => {
        const g = state.groups.find(x => x.id === el.dataset.statGrp);
        if (g) openGroupDetail(g);
      });
    });
  }

  // ================= TAB 4: ACCOUNT & SETTINGS =================
  function renderAccountView() {
    const name = state.profile.full_name || state.user?.email?.split('@')[0] || 'Tutor';
    $('accountName').textContent = name;
    $('accountEmail').textContent = state.user?.email || '';
    const av = $('accountAvatar');
    if (state.profile.avatar_data) {
      av.innerHTML = `<img src="${state.profile.avatar_data}" alt="Avatar" />`;
    } else {
      av.textContent = initials(name);
    }
  }

  function openSettingsModal() {
    $('setUiLang').value = state.profile.ui_language || window.currentLang;
    $('setCurrency').value = state.profile.currency || 'IDR';
    $('setFirstDay').value = String(state.profile.first_day_of_week ?? 1);
    $('setDarkTheme').checked = !!state.profile.dark_theme;
    $('setPaymentDots').checked = state.profile.show_payment_dots !== false;
    $('setReminders').checked = state.profile.reminders_enabled !== false;
    $('setReminderMin').value = String(state.profile.reminder_minutes || 30);
    openModal('settingsModal');
  }

  async function handleSaveSettings() {
    showLoading(true);
    try {
      const patch = {
        ui_language: $('setUiLang').value,
        currency: $('setCurrency').value,
        first_day_of_week: Number($('setFirstDay').value),
        dark_theme: $('setDarkTheme').checked,
        show_payment_dots: $('setPaymentDots').checked,
        reminders_enabled: $('setReminders').checked,
        reminder_minutes: Number($('setReminderMin').value) || 30
      };
      await saveProfileToCloud(patch);
      applyLanguage(patch.ui_language);
      applyTheme();
      renderAll();
      if (window.TutorNotifications) {
        await window.TutorNotifications.syncReminders(state.lessons, state.students, state.groups, state.profile);
      }
      closeModal('settingsModal');
      showToast(window.t('saved_toast'));
    } catch (err) {
      showToast(err.message);
    } finally {
      showLoading(false);
    }
  }

  function openWaTemplateModal() {
    $('waTemplateInput').value = getActiveWaTemplate();
    $('waPlaceholderChips').innerHTML = WA_PLACEHOLDERS.map(p =>
      `<button type="button" class="chip wa-ph-chip" data-ph="${p}" style="font-size:11.5px;padding:5px 10px;">${p}</button>`
    ).join('');
    $('waPlaceholderChips').querySelectorAll('.wa-ph-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const ta = $('waTemplateInput');
        const start = ta.selectionStart || ta.value.length;
        const end = ta.selectionEnd || ta.value.length;
        ta.value = ta.value.slice(0, start) + btn.dataset.ph + ta.value.slice(end);
        ta.focus();
      });
    });
    openModal('waTemplateModal');
  }

  function openGoalModal() {
    $('quickModalTitle').textContent = window.t('set_goal');
    $('quickModalBody').innerHTML = `
      <form id="goalForm">
        <div class="field">
          <label>${esc(window.t('monthly_income'))} (${esc(state.profile.currency)})</label>
          <input type="number" id="goalInput" min="0" step="any" value="${Number(state.profile.monthly_goal) || 0}" required />
        </div>
        <button type="submit" class="btn btn-primary btn-full">${esc(window.t('save'))}</button>
      </form>
    `;
    $('goalForm').onsubmit = async (e) => {
      e.preventDefault();
      showLoading(true);
      try {
        await saveProfileToCloud({ monthly_goal: Number($('goalInput').value) || 0 });
        renderHeader();
        closeModal('quickModal');
        showToast(window.t('saved_toast'));
      } catch (err) {
        showToast(err.message);
      } finally {
        showLoading(false);
      }
    };
    openModal('quickModal');
  }

  function openEditProfileModal() {
    $('quickModalTitle').textContent = window.t('edit_profile');
    $('quickModalBody').innerHTML = `
      <form id="profileEditForm">
        <div class="field">
          <label>${esc(window.t('full_name'))}</label>
          <input type="text" id="profNameInput" required value="${esc(state.profile.full_name || '')}" />
        </div>
        <button type="button" id="profPickPhotoBtn" class="btn btn-secondary btn-full" style="margin-bottom:12px;">📷 ${esc(window.t('change_photo'))}</button>
        <button type="submit" class="btn btn-primary btn-full">${esc(window.t('save'))}</button>
      </form>
    `;
    $('profPickPhotoBtn').onclick = () => $('avatarFileInput').click();
    $('profileEditForm').onsubmit = async (e) => {
      e.preventDefault();
      showLoading(true);
      try {
        await saveProfileToCloud({ full_name: $('profNameInput').value.trim() });
        renderAccountView();
        closeModal('quickModal');
        showToast(window.t('saved_toast'));
      } catch (err) {
        showToast(err.message);
      } finally {
        showLoading(false);
      }
    };
    openModal('quickModal');
  }

  function openChangePasswordModal() {
    $('quickModalTitle').textContent = window.t('change_password');
    $('quickModalBody').innerHTML = `
      <form id="changePwForm">
        <div class="field">
          <label>${esc(window.t('new_password'))}</label>
          <input type="password" id="newPw1" required minlength="6" />
        </div>
        <div class="field">
          <label>${esc(window.t('confirm_password'))}</label>
          <input type="password" id="newPw2" required minlength="6" />
        </div>
        <button type="submit" class="btn btn-primary btn-full">${esc(window.t('save'))}</button>
      </form>
    `;
    $('changePwForm').onsubmit = async (e) => {
      e.preventDefault();
      const p1 = $('newPw1').value;
      const p2 = $('newPw2').value;
      if (p1 !== p2) { showToast(window.t('password_mismatch')); return; }
      showLoading(true);
      try {
        const { error } = await sb.auth.updateUser({ password: p1 });
        if (error) throw error;
        closeModal('quickModal');
        showToast(window.t('saved_toast'));
      } catch (err) {
        showToast(err.message);
      } finally {
        showLoading(false);
      }
    };
    openModal('quickModal');
  }

  function handleAvatarFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const size = 180;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        try {
          await saveProfileToCloud({ avatar_data: dataUrl });
          renderAccountView();
          showToast(window.t('saved_toast'));
        } catch (err) {
          showToast(err.message);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleExportJson() {
    const payload = {
      app: 'Tutor Grow v2',
      exported_at: new Date().toISOString(),
      profile: state.profile,
      students: state.students,
      groups: state.groups,
      lessons: state.lessons
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tutor-grow-backup-${toDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(window.t('saved_toast'));
  }

  // ================= EVENT BINDINGS & INIT =================
  function bindEvents() {
    // Modal close buttons & backdrop click
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-overlay').forEach(ov => {
      ov.addEventListener('click', (e) => {
        if (e.target === ov) ov.classList.add('hidden');
      });
    });

    // Auth
    $('authLangSelect').addEventListener('change', (e) => applyLanguage(e.target.value));
    $('authForm').addEventListener('submit', handleAuthSubmit);
    $('forgotPwBtn').addEventListener('click', handleForgotPassword);
    $('authSwitchBtn').addEventListener('click', () => {
      state.authMode = state.authMode === 'login' ? 'signup' : 'login';
      setAuthAlert('');
      renderAuthTexts();
    });
    $('togglePwBtn').addEventListener('click', () => {
      const inp = $('authPassword');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Bottom Nav & FAB
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    $('fabMain').addEventListener('click', () => {
      if (state.activeTab === 'students') openStudentModal(null);
      else openLessonModal(null, state.selectedDate);
    });
    $('goalPill').addEventListener('click', openGoalModal);

    // Calendar controls
    $('calModeMonth').addEventListener('click', () => { state.calMode = 'month'; renderCalendarView(); });
    $('calModeWeek').addEventListener('click', () => { state.calMode = 'week'; renderCalendarView(); });
    $('calPrevBtn').addEventListener('click', () => {
      if (state.calMode === 'month') {
        state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth() - 1, 1);
      } else {
        state.selectedDate = addDays(state.selectedDate, -7);
        const d = parseDateStr(state.selectedDate);
        state.calCursor = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      renderCalendarView();
      renderHeader();
    });
    $('calNextBtn').addEventListener('click', () => {
      if (state.calMode === 'month') {
        state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth() + 1, 1);
      } else {
        state.selectedDate = addDays(state.selectedDate, 7);
        const d = parseDateStr(state.selectedDate);
        state.calCursor = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      renderCalendarView();
      renderHeader();
    });
    $('todayJumpBtn').addEventListener('click', () => {
      const now = new Date();
      state.selectedDate = toDateStr(now);
      state.calCursor = new Date(now.getFullYear(), now.getMonth(), 1);
      renderCalendarView();
      renderHeader();
    });

    // Students & Groups controls
    document.querySelectorAll('.stu-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        state.stuFilter = btn.dataset.filter;
        document.querySelectorAll('.stu-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderStudentsView();
      });
    });
    $('studentSearchInput').addEventListener('input', (e) => {
      state.stuSearch = e.target.value;
      renderStudentsView();
    });
    $('btnQuickAddStudent').addEventListener('click', () => openStudentModal(null));
    $('btnQuickAddGroup').addEventListener('click', () => openGroupModal(null));

    // Lesson form controls
    $('lTypeStudent').addEventListener('click', () => { setLessonType('student'); refreshLessonEntityContext(true); });
    $('lTypeGroup').addEventListener('click', () => { setLessonType('group'); refreshLessonEntityContext(true); });
    $('lessonStudentId').addEventListener('change', () => refreshLessonEntityContext(true));
    $('lessonGroupId').addEventListener('change', () => { state.tempGroupAttendees = []; refreshLessonEntityContext(true); });
    $('lessonStart').addEventListener('change', () => {
      $('lessonEnd').value = addMinutesToTime($('lessonStart').value, state.selectedDuration);
    });
    $('lessonEnd').addEventListener('change', () => {
      const d = diffMinutes($('lessonStart').value, $('lessonEnd').value);
      setDurationUI(d, true);
    });
    $('durationChips').querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.dataset.dur === 'custom') {
          $('durationChips').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          $('lessonDurationManual').classList.remove('hidden');
          $('lessonDurationManual').value = state.selectedDuration;
          $('lessonDurationManual').focus();
        } else {
          setDurationUI(Number(chip.dataset.dur), true);
        }
      });
    });
    $('lessonDurationManual').addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (val >= 5 && val <= 600) {
        state.selectedDuration = val;
        $('lessonEnd').value = addMinutesToTime($('lessonStart').value, val);
        recalcLessonFee();
      }
    });
    $('lessonRepeatToggle').addEventListener('change', (e) => {
      $('repeatWeeksWrap').classList.toggle('hidden', !e.target.checked);
    });
    $('lessonStatus').addEventListener('change', recalcLessonFee);
    $('lessonUsesPackage').addEventListener('change', recalcLessonFee);
    $('lessonForm').addEventListener('submit', handleSaveLesson);
    $('lessonDeleteBtn').addEventListener('click', handleDeleteLesson);

    // Student & Group forms
    $('stuLang').addEventListener('change', (e) => {
      $('stuLangCustomWrap').classList.toggle('hidden', e.target.value !== '__custom__');
      if (e.target.value !== '__custom__') {
        renderSwatches('stuColorSwatches', 'stuColor', window.getLanguageMeta(e.target.value).primary);
      }
    });
    $('stuBillingType').addEventListener('change', (e) => {
      $('stuPackageFields').classList.toggle('hidden', e.target.value !== 'package');
    });
    $('studentForm').addEventListener('submit', handleSaveStudent);
    $('stuDeleteBtn').addEventListener('click', handleDeleteStudent);

    $('grpLang').addEventListener('change', (e) => {
      $('grpLangCustomWrap').classList.toggle('hidden', e.target.value !== '__custom__');
      if (e.target.value !== '__custom__') {
        renderSwatches('grpColorSwatches', 'grpColor', window.getLanguageMeta(e.target.value).primary);
      }
    });
    $('groupForm').addEventListener('submit', handleSaveGroup);
    $('grpDeleteBtn').addEventListener('click', handleDeleteGroup);

    // PDF modal
    $('pdfScopeMonth').addEventListener('click', () => setPdfScope('month'));
    $('pdfScopePkg').addEventListener('click', () => setPdfScope('package'));
    $('pdfForm').addEventListener('submit', handleGeneratePdf);

    // Statistics controls
    document.querySelectorAll('.stat-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.statPeriod = btn.dataset.period;
        state.statOffset = 0;
        renderStatsView();
      });
    });
    $('statPrevBtn').addEventListener('click', () => { state.statOffset -= 1; renderStatsView(); });
    $('statNextBtn').addEventListener('click', () => { state.statOffset += 1; renderStatsView(); });

    // Account & Settings
    $('accountAvatar').addEventListener('click', () => $('avatarFileInput').click());
    $('avatarFileInput').addEventListener('change', handleAvatarFileSelected);
    $('btnEditProfile').addEventListener('click', openEditProfileModal);
    $('menuOpenSettings').addEventListener('click', openSettingsModal);
    $('btnSaveSettings').addEventListener('click', handleSaveSettings);
    $('btnTestNotif').addEventListener('click', async () => {
      const ok = await window.TutorNotifications.sendTest();
      showToast(ok ? '🔔 Notifikasi terkirim (2 detik)...' : 'Izin notifikasi ditolak / tidak didukung di browser ini.');
    });

    $('menuOpenWaTemplate').addEventListener('click', openWaTemplateModal);
    $('btnResetWaTpl').addEventListener('click', () => {
      $('waTemplateInput').value = CFG.DEFAULT_WA_TEMPLATES[window.currentLang] || CFG.DEFAULT_WA_TEMPLATES.id;
    });
    $('btnSaveWaTpl').addEventListener('click', async () => {
      showLoading(true);
      try {
        await saveProfileToCloud({ wa_template: $('waTemplateInput').value });
        closeModal('waTemplateModal');
        showToast(window.t('saved_toast'));
      } catch (err) {
        showToast(err.message);
      } finally {
        showLoading(false);
      }
    });

    $('menuSyncNow').addEventListener('click', () => syncFromCloud(false));
    $('menuExportJson').addEventListener('click', handleExportJson);
    $('menuChangePassword').addEventListener('click', openChangePasswordModal);
    $('menuSignOut').addEventListener('click', async () => {
      if (sb) await sb.auth.signOut();
      exitApp();
    });
    $('menuDeleteAccount').addEventListener('click', async () => {
      if (!confirm(window.t('delete_account_confirm'))) return;
      showLoading(true);
      try {
        const { error } = await sb.rpc('delete_my_account');
        if (error) throw error;
        await sb.auth.signOut();
        exitApp();
        showToast(window.t('deleted_toast'));
      } catch (err) {
        showToast(err.message);
      } finally {
        showLoading(false);
      }
    });
  }

  async function bootstrap() {
    populateLanguageSelect($('stuLang'));
    populateLanguageSelect($('grpLang'));
    populateCurrencySelect();
    applyLanguage(window.currentLang);
    bindEvents();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    if (!initSupabase()) return;

    showLoading(true);
    try {
      const { data } = await sb.auth.getSession();
      if (data && data.session && data.session.user) {
        await enterApp(data.session.user);
      } else {
        exitApp();
      }
    } catch (err) {
      console.error(err);
      exitApp();
    } finally {
      showLoading(false);
    }

    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        exitApp();
      } else if (event === 'PASSWORD_RECOVERY' && session?.user) {
        enterApp(session.user).then(() => openChangePasswordModal());
      } else if (event === 'SIGNED_IN' && session?.user && !state.user) {
        enterApp(session.user);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
