# Tutor Grow — Language Teaching Journal (v2)

Aplikasi mobile Android & PWA untuk tutor bahasa mandiri (*online multi-user* dengan **Supabase** dan identitas visual **Growly Brand Kit v2.0**).

## Fitur Utama v2
- **Online Multi-User per Tutor (Supabase Auth + RLS):** Setiap tutor punya akun sendiri dengan isolasi data otomatis.
- **Alih Bahasa UI (5 Bahasa):** Bahasa Indonesia, English, 日本語 (Japanese), 한국어 (Korean), 中文 (Mandarin).
- **Kalender Bulanan & Mingguan:** Indikator titik lunas/belum lunas/terjadwal, target pendapatan bulanan (*Monthly Goal*), dan jadwal rutin mingguan (*Repeat Lesson*).
- **Kelas Privat & Kelas Grup:** Tarif grup dapat dipilih *Flat per sesi* atau *Per murid hadir*, lengkap dengan absensi anggota grup.
- **Sistem Pembayaran Fleksibel:** Bayar per sesi maupun sistem **Paket / Kuota Sesi** (*prepaid*) dengan pengingat sisa kuota.
- **Durasi Fleksibel:** Tombol cepat `30`, `45`, `60`, `90`, `120` menit + input **Manual** (menit bebas).
- **Konteks *Another Session*:** Ringkasan materi terakhir & PR yang harus dicek langsung tampil saat membuka murid atau mencatat sesi baru.
- **Statistik Lengkap:** Grafik batang pendapatan (Minggu, Bulan, 3 Bln, 6 Bln, Tahun), Pendapatan Aktual vs Proyeksi, jam mengajar, pembatalan, reschedule, dan rincian per grup/murid.
- **Template WhatsApp Dapat Diedit:** Sesuaikan isi pesan rekap dengan variabel otomatis (`{nama_murid}`, `{periode}`, `{rincian_sesi}`, dll.).
- **Rapor Progres Belajar PDF:** Cetak & bagikan rapor bulanan atau per paket berlogo **Tutor Grow** langsung ke WhatsApp.
- **Notifikasi Pengingat Mengajar:** Pengingat lokal Android (15/30/60 menit sebelum kelas).

## Setup Database Supabase
Jalankan seluruh isi [supabase_schema.sql](./supabase_schema.sql) di **Supabase SQL Editor**.

## Build APK Otomatis
Setiap push ke branch `main` otomatis menjalankan GitHub Actions (`.github/workflows/build-apk.yml`) untuk membundel vendor offline, membuat ikon launcher Android dari `www/logo.png`, mem-build `Tutor-Grow-v2.apk`, dan menerbitkannya di **GitHub Releases**.
