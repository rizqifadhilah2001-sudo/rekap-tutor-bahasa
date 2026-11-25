// Tutor Grow v2 — Growly-Branded PDF Progress Report Generator
// Renders clean A4 HTML using Growly Brand Kit v2.0 (full Unicode for ID/EN/JA/KO/ZH/AR),
// converts via html2canvas + jsPDF, and shares natively on Android (WhatsApp ready!) or downloads on web.

window.TutorPdfReport = {
  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  async generateAndShare({ student, lessons, scopeLabel, includeFee, evaluation, tutorName, formatMoney, langCode }) {
    const langMeta = window.getLanguageMeta(student.language);
    const totalCount = lessons.length;
    const completed = lessons.filter(l => l.effectiveStatus === 'completed' || l.effectiveStatus === 'present');
    const excused = lessons.filter(l => l.effectiveStatus === 'rescheduled' || l.effectiveStatus === 'cancelled' || l.effectiveStatus === 'excused');
    const totalMinutes = completed.reduce((s, l) => s + (Number(l.duration_minutes) || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1).replace(/\.0$/, '');
    const totalFee = lessons.reduce((s, l) => s + (Number(l.effectiveFee) || 0), 0);
    const unpaidFee = lessons.filter(l => !l.effectivePaid && Number(l.effectiveFee) > 0).reduce((s, l) => s + Number(l.effectiveFee), 0);

    const statusBadgeText = (st) => {
      const map = {
        completed: window.t('st_completed'),
        present: window.t('att_present'),
        rescheduled: window.t('st_rescheduled'),
        cancelled: window.t('st_cancelled'),
        no_show: window.t('st_no_show'),
        excused: window.t('att_excused'),
        absent: window.t('att_absent'),
        scheduled: window.t('st_scheduled')
      };
      return map[st] || st;
    };

    const statusBadgeStyle = (st) => {
      if (st === 'completed' || st === 'present') return 'background:#DCF5E1;color:#146C2E;';
      if (st === 'rescheduled' || st === 'excused') return 'background:#FFF3C4;color:#8A5A00;';
      if (st === 'cancelled' || st === 'absent' || st === 'no_show') return 'background:#FFE0E5;color:#B00020;';
      return 'background:#E8EAFA;color:#434786;';
    };

    const rowsHtml = lessons.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:#6E7196;">${this.escapeHtml(window.t('no_prev_session'))}</td></tr>`
      : lessons.map((l, idx) => `
        <tr style="border-bottom:1px solid rgba(67,71,134,0.12);background:${idx % 2 === 0 ? '#FFFFFF' : '#FCFBF6'};">
          <td style="padding:10px 12px;vertical-align:top;white-space:nowrap;font-weight:600;color:#2D2F5A;">
            ${this.escapeHtml(l.lesson_date)}<br>
            <span style="font-size:11px;font-weight:500;color:#6E7196;">${this.escapeHtml(l.start_time || '')} · ${l.duration_minutes}m</span>
          </td>
          <td style="padding:10px 10px;vertical-align:top;white-space:nowrap;">
            <span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;${statusBadgeStyle(l.effectiveStatus)}">
              ${this.escapeHtml(statusBadgeText(l.effectiveStatus))}
            </span>
            ${l.isGroup ? `<div style="font-size:10px;color:#434786;margin-top:4px;font-weight:600;">👥 ${this.escapeHtml(l.groupName || '')}</div>` : ''}
          </td>
          <td style="padding:10px 12px;vertical-align:top;color:#2D2F5A;">
            <div style="font-weight:700;margin-bottom:3px;">${this.escapeHtml(l.topic || '-')}</div>
            ${l.effectiveNote ? `<div style="font-size:12px;color:#4C5077;line-height:1.45;">${this.escapeHtml(l.effectiveNote)}</div>` : ''}
          </td>
          <td style="padding:10px 12px;vertical-align:top;color:#434786;font-size:12px;line-height:1.45;">
            ${this.escapeHtml(l.homework || '-')}
          </td>
        </tr>
      `).join('');

    const feeSectionHtml = includeFee ? `
      <div style="margin-top:18px;background:#FFFFFF;border:1px solid rgba(67,71,134,0.14);border-radius:14px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#6E7196;font-weight:700;">${this.escapeHtml(window.t('fee_section'))}</div>
          ${student.billing_type === 'package'
            ? `<div style="font-size:13px;color:#2D2F5A;margin-top:4px;font-weight:600;">${this.escapeHtml(student.package_name || window.t('package_badge'))}: ${Math.max(0, (student.package_total || 0) - (student.package_used || 0))} / ${student.package_total || 0} ${this.escapeHtml(window.t('package_remaining'))}</div>`
            : `<div style="font-size:13px;color:#2D2F5A;margin-top:4px;font-weight:600;">Total: ${this.escapeHtml(formatMoney(totalFee))}</div>`
          }
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#6E7196;font-weight:600;">${this.escapeHtml(window.t('unpaid_balance'))}</div>
          <div style="font-family:'Nunito',sans-serif;font-size:20px;font-weight:900;color:${unpaidFee > 0 ? '#C80730' : '#146C2E'};">
            ${unpaidFee > 0 ? this.escapeHtml(formatMoney(unpaidFee)) : this.escapeHtml(window.t('paid'))}
          </div>
        </div>
      </div>
    ` : '';

    const evalHtml = evaluation && evaluation.trim() ? `
      <div style="margin-top:18px;background:#FFFFFF;border-left:5px solid ${langMeta.primary};border-top:1px solid rgba(67,71,134,0.12);border-right:1px solid rgba(67,71,134,0.12);border-bottom:1px solid rgba(67,71,134,0.12);border-radius:12px;padding:16px 18px;">
        <div style="font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;color:#2D2F5A;margin-bottom:6px;">✨ ${this.escapeHtml(window.t('tutor_evaluation'))}</div>
        <div style="font-size:13px;color:#2D2F5A;line-height:1.65;white-space:pre-line;">${this.escapeHtml(evaluation.trim())}</div>
      </div>
    ` : '';

    const todayStr = new Date().toISOString().slice(0, 10);
    const headerTextColor = langMeta.textOnPrimary || '#2D2F5A';

    const container = document.createElement('div');
    container.id = 'tg-pdf-render-host';
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#FFFDF7;color:#2D2F5A;font-family:"Montserrat",sans-serif;padding:0;box-sizing:border-box;z-index:-1;';
    container.innerHTML = `
      <div style="background:#FFFDF7;padding:28px 32px 32px;min-height:1120px;box-sizing:border-box;display:flex;flex-direction:column;">
        <!-- Growly Brand Header -->
        <div style="background:${langMeta.primary};color:${headerTextColor};border-radius:18px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="background:#FFFFFF;border-radius:14px;padding:6px 8px;display:flex;align-items:center;justify-content:center;width:58px;height:58px;box-shadow:0 4px 12px rgba(45,47,90,0.12);">
              <img src="./logo.png" alt="Tutor Grow" style="width:46px;height:46px;object-fit:contain;" />
            </div>
            <div>
              <div style="font-family:'Nunito',sans-serif;font-size:24px;font-weight:900;letter-spacing:-0.5px;line-height:1.1;">Tutor Grow</div>
              <div style="font-size:12px;font-weight:600;opacity:0.9;margin-top:2px;">Language Teaching Journal · Progress Report</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="display:inline-block;background:rgba(255,253,247,0.92);color:#2D2F5A;padding:5px 14px;border-radius:999px;font-family:'Nunito',sans-serif;font-weight:800;font-size:12px;">
              ${langMeta.flag} ${this.escapeHtml(student.language)}
            </div>
            <div style="font-size:11px;margin-top:6px;opacity:0.9;font-weight:600;">${this.escapeHtml(scopeLabel)}</div>
          </div>
        </div>

        <!-- Student & Tutor Info -->
        <div style="margin-top:18px;background:#FFFFFF;border:1px solid rgba(67,71,134,0.12);border-radius:16px;padding:16px 20px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-size:11px;color:#6E7196;text-transform:uppercase;font-weight:700;">${this.escapeHtml(window.t('student_name'))}</div>
            <div style="font-family:'Nunito',sans-serif;font-size:20px;font-weight:900;color:#2D2F5A;margin-top:2px;">${this.escapeHtml(student.name)}</div>
            ${student.level ? `<div style="font-size:12px;color:#434786;font-weight:600;margin-top:2px;">Level / Target: ${this.escapeHtml(student.level)}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:#6E7196;text-transform:uppercase;font-weight:700;">Tutor</div>
            <div style="font-family:'Nunito',sans-serif;font-size:16px;font-weight:800;color:#2D2F5A;margin-top:2px;">${this.escapeHtml(tutorName || 'Tutor Grow')}</div>
            <div style="font-size:12px;color:#6E7196;margin-top:2px;">${this.escapeHtml(todayStr)}</div>
          </div>
        </div>

        <!-- KPI Strip -->
        <div style="margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          <div style="background:#FFFFFF;border:1px solid rgba(67,71,134,0.12);border-radius:14px;padding:12px;text-align:center;">
            <div style="font-family:'Nunito',sans-serif;font-size:22px;font-weight:900;color:#434786;">${totalCount}</div>
            <div style="font-size:11px;color:#6E7196;font-weight:600;margin-top:2px;">Total Sesi</div>
          </div>
          <div style="background:#FFFFFF;border:1px solid rgba(67,71,134,0.12);border-radius:14px;padding:12px;text-align:center;">
            <div style="font-family:'Nunito',sans-serif;font-size:22px;font-weight:900;color:#146C2E;">${completed.length}</div>
            <div style="font-size:11px;color:#6E7196;font-weight:600;margin-top:2px;">${this.escapeHtml(window.t('st_completed'))}</div>
          </div>
          <div style="background:#FFFFFF;border:1px solid rgba(67,71,134,0.12);border-radius:14px;padding:12px;text-align:center;">
            <div style="font-family:'Nunito',sans-serif;font-size:22px;font-weight:900;color:#B27400;">${excused.length}</div>
            <div style="font-size:11px;color:#6E7196;font-weight:600;margin-top:2px;">${this.escapeHtml(window.t('st_rescheduled'))}</div>
          </div>
          <div style="background:#FFFFFF;border:1px solid rgba(67,71,134,0.12);border-radius:14px;padding:12px;text-align:center;">
            <div style="font-family:'Nunito',sans-serif;font-size:22px;font-weight:900;color:#2D2F5A;">${totalHours}h</div>
            <div style="font-size:11px;color:#6E7196;font-weight:600;margin-top:2px;">${this.escapeHtml(window.t('teaching_hours'))}</div>
          </div>
        </div>

        <!-- Lesson Journal Table -->
        <div style="margin-top:18px;background:#FFFFFF;border:1px solid rgba(67,71,134,0.12);border-radius:16px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
            <thead>
              <tr style="background:#434786;color:#FFFDF7;text-align:left;font-family:'Nunito',sans-serif;">
                <th style="padding:11px 12px;font-weight:800;">${this.escapeHtml(window.t('date'))}</th>
                <th style="padding:11px 10px;font-weight:800;">Status</th>
                <th style="padding:11px 12px;font-weight:800;">${this.escapeHtml(window.t('topic_label'))} & ${this.escapeHtml(window.t('progress_label'))}</th>
                <th style="padding:11px 12px;font-weight:800;">${this.escapeHtml(window.t('homework_label'))}</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>

        ${evalHtml}
        ${feeSectionHtml}

        <!-- Footer -->
        <div style="margin-top:auto;padding-top:22px;text-align:center;font-size:11px;color:#6E7196;border-top:1px solid rgba(67,71,134,0.10);">
          Generated with <strong>Tutor Grow</strong> · Language Teaching Journal (${this.escapeHtml(langCode.toUpperCase())})
        </div>
      </div>
    `;

    document.body.appendChild(container);
    try {
      // Wait briefly for logo image decode
      const imgs = container.querySelectorAll('img');
      await Promise.all(Array.from(imgs).map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));

      if (!window.html2canvas || !window.jspdf) {
        throw new Error('PDF library belum termuat. Pastikan koneksi internet tersedia atau gunakan versi APK.');
      }

      const canvas = await window.html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFDF7'
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.94);

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 2) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = (student.name || 'Student').replace(/[^a-zA-Z0-9_-]+/g, '_');
      const safeScope = (scopeLabel || todayStr).replace(/[^a-zA-Z0-9_-]+/g, '_');
      const fileName = `Rapor_TutorGrow_${safeName}_${safeScope}.pdf`;

      const Cap = window.Capacitor;
      if (Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.Plugins && Cap.Plugins.Filesystem && Cap.Plugins.Share) {
        const dataUri = pdf.output('datauristring');
        const base64 = dataUri.split(',')[1];
        const saved = await Cap.Plugins.Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: 'CACHE'
        });
        await Cap.Plugins.Share.share({
          title: `Rapor ${student.name} (${scopeLabel})`,
          text: `Rapor progres belajar ${student.name} — ${scopeLabel} (Tutor Grow)`,
          url: saved.uri,
          dialogTitle: window.t('pdf_title')
        });
      } else {
        pdf.save(fileName);
      }
      return true;
    } finally {
      container.remove();
    }
  }
};
