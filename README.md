# Sistem Booking Fasilitas

Sebuah aplikasi web modern berbasis **React** (Front-End) dan **Laravel** (Back-End) untuk melakukan pemesanan (booking) fasilitas seperti lapangan olahraga, ruang pertemuan (meeting room), dan lainnya. Sistem ini dilengkapi dengan desain antarmuka bergaya *Glassmorphism*, dashboard pengelolaan admin, dan fitur ekspor laporan keuangan.

## 🚀 Fitur Utama

### 👥 Bagian Pengguna (User)
- **Katalog Fasilitas**: Menampilkan daftar fasilitas beserta harga, detail lokasi, dan kapasitas.
- **Pemesanan Interaktif**: Form booking menggunakan kalender interaktif (`FullCalendar`) yang memungkinkan pengguna menyorot (drag) jadwal untuk memesan jam secara instan.
- **Validasi Waktu**: Pengguna tidak dapat memilih waktu yang telah berlalu (past-time validation) dan sistem mencegah jadwal bentrok (overlapping schedules).
- **Riwayat Transaksi**: Panel khusus pengguna untuk melihat riwayat pemesanan dan status pemesanan mereka.

### 🛡️ Bagian Admin (SaaS-like Dashboard)
- **Ringkasan Sistem**: Menampilkan metrik seperti Total Pendapatan, Total Booking, Fasilitas Tersedia, dan jumlah antrean (Pending).
- **Manajemen Fasilitas (CRUD)**: Menambah, mengubah, atau menghapus fasilitas baru beserta kelengkapannya.
- **Kelola Pemesanan**: Menyetujui atau menolak pesanan yang baru masuk dari pengguna.
- **Laporan & Ekspor PDF**: Melihat grafik pendapatan bulanan secara interaktif (menggunakan `recharts`) dan mengekspor rincian transaksi menggunakan *library* domPDF.

## 🛠️ Teknologi yang Digunakan

### Front-End
- **React.js (Vite)**: Framework utama untuk antarmuka pengguna yang cepat dan responsif.
- **Tailwind CSS**: Digunakan untuk *styling* dan desain utilitas.
- **Zustand**: Untuk manajemen *state* ringan (contohnya mengatur sesi Login/Autentikasi).
- **React Query**: Mengelola pengambilan, *caching*, dan mutasi data dari API.
- **FullCalendar**: Integrasi kalender interaktif untuk pemilihan jadwal.
- **Recharts**: Merender grafik data statistik yang interaktif di panel Admin.
- **Lucide React**: Kumpulan ikon SVG modern dan fleksibel.

### Back-End
- **Laravel 11**: Framework utama untuk membuat RESTful API (menggunakan PHP).
- **MySQL**: Basis data relasional.
- **Laravel Sanctum**: Otentikasi ringan berbasis *Token API*.
- **domPDF**: Fitur konversi dan ekspor laporan ke format `.pdf`.

## ⚙️ Cara Menjalankan Aplikasi di Komputer Anda (Local Development)

Proyek ini terbagi menjadi dua sub-direktori, yakni `Front-End` dan `Back-End`. Pastikan Anda sudah menginstal **PHP (Composer)**, **Node.js (NPM)**, dan **MySQL** di komputer Anda.

### 1. Konfigurasi Back-End (Laravel)
```bash
cd Back-End

# Instal seluruh dependensi PHP
composer install

# Buat file Environment (salin dari .env.example)
cp .env.example .env

# Jalankan server basis data Anda (contoh: aktifkan MySQL pada XAMPP/Laragon)
# Sesuaikan nama database pada file .env (misalnya DB_DATABASE=sistem_booking)

# Buat tabel dan jalankan data awal (Seeder)
php artisan migrate --seed

# Buat kunci keamanan aplikasi
php artisan key:generate

# Jalankan server
php artisan serve
```
*Server API secara default akan berjalan di `http://127.0.0.1:8000`.*

### 2. Konfigurasi Front-End (React/Vite)
Buka jendela terminal baru, kemudian jalankan:
```bash
cd Front-End

# Instal seluruh dependensi JavaScript
npm install

# Jalankan development server
npm run dev
```
*Aplikasi Front-End akan terbuka otomatis di browser Anda (biasanya di `http://localhost:5173`).*

## 🔑 Kredensial Uji Coba
Karena *database* telah di-*seed* melalui `php artisan migrate --seed`, Anda bisa mencoba masuk menggunakan akun berikut:

**Admin:**
- Email: `admin@admin.com`
- Password: `password`

**Pengguna Biasa (User):**
- Email: `user@user.com`
- Password: `password`

---

*Dikembangkan untuk memberikan kemudahan bagi manajemen pengelolaan jadwal dan fasilitas secara digital.*
