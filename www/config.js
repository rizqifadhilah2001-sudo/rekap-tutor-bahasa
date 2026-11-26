// Tutor Grow v2 — Configuration & Growly Brand System
window.TUTOR_GROW_CONFIG = {
  APP_NAME: 'Tutor Grow',
  APP_SUBTITLE: 'Language Teaching Journal',
  APP_VERSION: '2.0.0',
  SUPABASE_URL: 'https://qjxjnlyddcrntfxyegew.supabase.co',
  SUPABASE_KEY: 'sb_publishable_5mk0pZDg4ziazMtw6yBdAQ_m_siI4FZ',
  WEB_APP_URL: 'https://rizqifadhilah2001-sudo.github.io/rekap-tutor-bahasa/',

  // Growly Brand Kit v2.0 — Language Visual System
  LANGUAGES: [
    { id: 'English', flag: '🇬🇧', primary: '#002CA6', secondary: '#C80730', textOnPrimary: '#FFFDF7' },
    { id: 'Japanese', flag: '🇯🇵', primary: '#A3E6A9', secondary: '#A0C4FF', textOnPrimary: '#2D2F5A' },
    { id: 'Chinese (Mandarin)', flag: '🇨🇳', primary: '#BDB2FF', secondary: '#FFAFCC', textOnPrimary: '#2D2F5A' },
    { id: 'Korean', flag: '🇰🇷', primary: '#FFAFCC', secondary: '#FFFA91', textOnPrimary: '#2D2F5A' },
    { id: 'Arabic', flag: '🇸🇦', primary: '#7ED9B8', secondary: '#D9F5E8', textOnPrimary: '#2D2F5A' },
    { id: 'German', flag: '🇩🇪', primary: '#F7C97E', secondary: '#FFE9B8', textOnPrimary: '#2D2F5A' },
    { id: 'French', flag: '🇫🇷', primary: '#9BB8FF', secondary: '#D9E4FF', textOnPrimary: '#2D2F5A' },
    { id: 'Spanish', flag: '🇪🇸', primary: '#FFB59E', secondary: '#FFE1D6', textOnPrimary: '#2D2F5A' },
    { id: 'Indonesian (BIPA)', flag: '🇮🇩', primary: '#F59CA9', secondary: '#FFDCE2', textOnPrimary: '#2D2F5A' },
    { id: 'Dutch', flag: '🇳🇱', primary: '#FFC48C', secondary: '#FFE7CF', textOnPrimary: '#2D2F5A' },
    { id: 'Italian', flag: '🇮🇹', primary: '#A8E0B4', secondary: '#DCF5E1', textOnPrimary: '#2D2F5A' },
    { id: 'Russian', flag: '🇷🇺', primary: '#A8C7FA', secondary: '#DCEAFF', textOnPrimary: '#2D2F5A' },
    { id: 'Thai', flag: '🇹🇭', primary: '#C5B8FF', secondary: '#E8E3FF', textOnPrimary: '#2D2F5A' },
    { id: 'Vietnamese', flag: '🇻🇳', primary: '#FFADAD', secondary: '#FFDADA', textOnPrimary: '#2D2F5A' },
    { id: 'Turkish', flag: '🇹🇷', primary: '#F6A5B8', secondary: '#FCDCE4', textOnPrimary: '#2D2F5A' },
    { id: 'Portuguese', flag: '🇧🇷', primary: '#9EE0B5', secondary: '#DDF5E5', textOnPrimary: '#2D2F5A' },
    { id: 'Hindi', flag: '🇮🇳', primary: '#FCD299', secondary: '#FFECD1', textOnPrimary: '#2D2F5A' },
    { id: 'Malay', flag: '🇲🇾', primary: '#9FD4FF', secondary: '#DCF0FF', textOnPrimary: '#2D2F5A' }
  ],

  CURRENCIES: [
    { code: 'IDR', symbol: 'Rp', locale: 'id-ID', decimals: 0 },
    { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2 },
    { code: 'JPY', symbol: '¥', locale: 'ja-JP', decimals: 0 },
    { code: 'KRW', symbol: '₩', locale: 'ko-KR', decimals: 0 },
    { code: 'CNY', symbol: '¥', locale: 'zh-CN', decimals: 2 },
    { code: 'SGD', symbol: 'S$', locale: 'en-SG', decimals: 2 },
    { code: 'MYR', symbol: 'RM', locale: 'ms-MY', decimals: 2 },
    { code: 'EUR', symbol: '€', locale: 'de-DE', decimals: 2 }
  ],

  DEFAULT_WA_TEMPLATES: {
    id: `Halo {nama_ortu} 👋
Berikut rekap belajar *{nama_murid}* ({bahasa}) untuk periode *{periode}*:

📚 *Ringkasan*
• Total Pertemuan: {jumlah_sesi} sesi ({total_jam} jam)
• Status Paket: {status_paket}
• Total Tagihan Belum Lunas: {total_tagihan}

📝 *Rincian Sesi:*
{rincian_sesi}

Terima kasih atas kepercayaannya! 🙏
— {nama_tutor} (Tutor Grow)`,

    en: `Hello {nama_ortu} 👋
Here is the learning recap for *{nama_murid}* ({bahasa}) — *{periode}*:

📚 *Summary*
• Completed Lessons: {jumlah_sesi} sessions ({total_jam} hrs)
• Package Status: {status_paket}
• Unpaid Balance: {total_tagihan}

📝 *Session Details:*
{rincian_sesi}

Thank you for learning with me! 🙏
— {nama_tutor} (Tutor Grow)`,

    ja: `{nama_ortu}様、こんにちは 👋
*{nama_murid}*さんの*{periode}*のレッスン記録（{bahasa}）をお送りします。

📚 *まとめ*
• 完了レッスン: {jumlah_sesi}回（{total_jam}時間）
• パッケージ残高: {status_paket}
• 未払い合計: {total_tagihan}

📝 *レッスン詳細:*
{rincian_sesi}

引き続きよろしくお願いいたします！🙏
— {nama_tutor} (Tutor Grow)`,

    ko: `안녕하세요 {nama_ortu}님 👋
*{nama_murid}* 학생의 *{periode}* 수업 요약({bahasa})입니다.

📚 *요약*
• 완료 수업: {jumlah_sesi}회 ({total_jam}시간)
• 패키지 현황: {status_paket}
• 미납 금액: {total_tagihan}

📝 *수업 내역:*
{rincian_sesi}

감사합니다! 🙏
— {nama_tutor} (Tutor Grow)`,

    zh: `{nama_ortu}您好 👋
以下是 *{nama_murid}* 在 *{periode}* 的课程总结（{bahasa}）：

📚 *学习概览*
• 已完成课程：{jumlah_sesi} 节（{total_jam} 小时）
• 套餐状态：{status_paket}
• 待结算费用：{total_tagihan}

📝 *课程明细：*
{rincian_sesi}

感谢您的信任与支持！🙏
— {nama_tutor} (Tutor Grow)`
  }
};

window.getLanguageMeta = function (langName) {
  const list = window.TUTOR_GROW_CONFIG.LANGUAGES;
  const found = list.find(l => l.id.toLowerCase() === String(langName || '').toLowerCase());
  if (found) return found;
  return {
    id: langName || 'Other',
    flag: '🌐',
    primary: '#434786',
    secondary: '#BDB2FF',
    textOnPrimary: '#FFFDF7'
  };
};
