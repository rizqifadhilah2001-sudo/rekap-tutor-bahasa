// Tutor Grow v2 — Android Local Notifications Helper
window.TutorNotifications = {
  getPlugin() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications
      ? window.Capacitor.Plugins.LocalNotifications
      : null;
  },

  async ensurePermission() {
    const LN = this.getPlugin();
    if (LN) {
      try {
        const perm = await LN.checkPermissions();
        if (perm.display !== 'granted') {
          const req = await LN.requestPermissions();
          return req.display === 'granted';
        }
        return true;
      } catch (e) {
        console.warn('LocalNotifications permission error:', e);
        return false;
      }
    }
    if ('Notification' in window) {
      if (Notification.permission === 'granted') return true;
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
    return false;
  },

  async syncReminders(lessons, students, groups, settings) {
    const LN = this.getPlugin();
    if (!LN) return;
    try {
      const pending = await LN.getPending();
      if (pending && pending.notifications && pending.notifications.length) {
        await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }
      if (!settings || !settings.reminders_enabled) return;

      const granted = await this.ensurePermission();
      if (!granted) return;

      const leadMin = Number(settings.reminder_minutes) || 30;
      const now = Date.now();
      const maxHorizon = now + 14 * 24 * 60 * 60 * 1000; // Next 14 days
      const studentMap = new Map(students.map(s => [s.id, s]));
      const groupMap = new Map(groups.map(g => [g.id, g]));

      const toSchedule = [];
      let notifId = 1001;

      for (const l of lessons) {
        if (l.status !== 'scheduled') continue;
        const startDt = new Date(`${l.lesson_date}T${l.start_time || '09:00'}:00`);
        if (isNaN(startDt.getTime())) continue;
        const triggerMs = startDt.getTime() - leadMin * 60 * 1000;
        if (triggerMs <= now + 5000 || triggerMs > maxHorizon) continue;

        const entity = l.lesson_type === 'group' ? groupMap.get(l.group_id) : studentMap.get(l.student_id);
        const label = entity ? entity.name : 'Class';
        const lang = entity ? entity.language : '';

        toSchedule.push({
          id: notifId++,
          title: `Tutor Grow · ${label}`,
          body: `${l.start_time} (${l.duration_minutes}m) ${lang ? '· ' + lang : ''} — ${leadMin} ${window.t('min_before')}`,
          schedule: { at: new Date(triggerMs) },
          sound: null,
          smallIcon: 'ic_launcher'
        });
        if (toSchedule.length >= 40) break;
      }

      if (toSchedule.length > 0) {
        await LN.schedule({ notifications: toSchedule });
      }
    } catch (err) {
      console.warn('Reminder sync failed:', err);
    }
  },

  async sendTest() {
    const LN = this.getPlugin();
    const granted = await this.ensurePermission();
    if (!granted) return false;

    if (LN) {
      await LN.schedule({
        notifications: [{
          id: 9999,
          title: 'Tutor Grow · Language Teaching Journal',
          body: 'Notifikasi pengingat mengajar aktif & siap digunakan!',
          schedule: { at: new Date(Date.now() + 2000) }
        }]
      });
      return true;
    }
    if ('Notification' in window) {
      new Notification('Tutor Grow', {
        body: 'Notifikasi pengingat mengajar aktif!'
      });
      return true;
    }
    return false;
  }
};
