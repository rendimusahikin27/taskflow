# 🚀 TaskFlow - Realtime Kanban Board

TaskFlow adalah aplikasi manajemen tugas (Kanban Board) yang dibangun dengan **Next.js 14**, **Tailwind CSS**, dan **Supabase**. Aplikasi ini mendukung kolaborasi tim secara realtime dengan sinkronisasi data instan.

## ✨ Fitur Utama

- **Realtime Collaboration**: Perpindahan kartu, penambahan kolom, dan pembaruan checklist tersinkronisasi secara otomatis antar pengguna tanpa refresh.
- **Interactive Drag & Drop**: Pengalaman intuitif memindahkan tugas antar kolom menggunakan `@dnd-kit`.
- **Checklist System with Instant Progress**: Pantau progres tugas melalui progress bar di kartu utama yang diperbarui secara instan.
- **Dynamic Labeling**: Kustomisasi warna kartu untuk kategori tugas yang berbeda.
- **Optimistic UI**: Perubahan status checklist terasa instan bagi pengguna melalui state management yang cerdas.
- **Responsive Design**: Tampilan modern dan bersih yang nyaman digunakan di berbagai ukuran layar.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS & Lucide Icons
- **Database & Realtime**: Supabase (PostgreSQL)
- **Drag and Drop**: @dnd-kit

## 🚀 Cara Menjalankan Proyek

1. **Clone Repository**
    ```bash
    git clone [https://github.com/rendimusahikin27/taskflow.git]
    cd taskflow

2. **Install Dependensi**
    ```bash
    npm install

3. **Konfigurasi Environment** Buat file .env.local diroot folder dan masukkan kredensial Supabase kamu:
    ```bash
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

4. **Konfigurasi Database** Pastikan tabel boards, lists, cards, dan checklists sudah tersedia di Supabase. Aktifkan <b>Realtime Replication</b> untuk keempat tabel tersebut di Dashboard Supabase.

5. **Jalankan Aplikasi**
    ```bash
    npm run dev

**Arsitektur Realtime**
Proyek ini menggunakan pola Optimistic Update dan State Locking.

Saat drag-and-drop dilakukan, sistem mengunci sinkronisasi eksternal sementara (isDraggingRef) untuk mencegah kartu melompat kembali sebelum database selesai diproses.

Checklist menggunakan data pre-fetching pada level dashboard untuk memastikan progress bar muncul tanpa jeda loading.

Made with ❤️ by [Nama Kamu]