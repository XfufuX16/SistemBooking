# Sistem Booking/Reservasi Lapangan Olahraga & Meeting Room

Dokumen ini berisi rancangan detail proyek portofolio dengan skala menengah, menggunakan **Laravel** sebagai backend (REST API) dan **React + Vite.js** sebagai frontend.

---

## 1. Deskripsi Proyek

Aplikasi web untuk booking fasilitas (lapangan olahraga, ruang meeting, dll) secara online. Terdapat dua role utama:

- **User** — mencari fasilitas, melihat jadwal, melakukan booking, melihat riwayat.
- **Admin** — mengelola data fasilitas, memverifikasi/mengelola booking, melihat laporan.

---

## 2. Tech Stack

| Bagian | Teknologi |
|---|---|
| Backend | Laravel 11, Laravel Sanctum (Auth API) |
| Database | MySQL / PostgreSQL |
| Frontend | React 18 (Vite.js), React Router, Axios |
| State Management | Zustand / React Query (TanStack Query) |
| Styling | Tailwind CSS |
| Kalender | FullCalendar (react-fullcalendar) |
| Notifikasi Email | Laravel Mail (Queue + Mailtrap saat dev) |
| Payment Gateway (opsional) | Midtrans / Xendit Sandbox |

---

## 3. Struktur Database (ERD)

### Tabel: `users`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | PK |
| name | varchar | |
| email | varchar | unique |
| password | varchar | hashed |
| role | enum('admin','user') | default 'user' |
| phone | varchar | nullable |
| created_at, updated_at | timestamp | |

### Tabel: `facilities` (data lapangan/ruangan)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | PK |
| name | varchar | contoh: "Lapangan Futsal A" |
| type | enum('lapangan','meeting_room') | |
| description | text | nullable |
| location | varchar | nullable |
| price_per_hour | decimal(10,2) | |
| capacity | int | nullable, untuk meeting room |
| image | varchar | path gambar |
| is_active | boolean | default true |
| created_at, updated_at | timestamp | |

### Tabel: `facility_schedules` (jam operasional, opsional)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | PK |
| facility_id | bigint | FK -> facilities |
| day_of_week | tinyint | 0=Minggu ... 6=Sabtu |
| open_time | time | |
| close_time | time | |

### Tabel: `bookings`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | PK |
| user_id | bigint | FK -> users |
| facility_id | bigint | FK -> facilities |
| booking_date | date | |
| start_time | time | |
| end_time | time | |
| total_price | decimal(10,2) | |
| status | enum('pending','confirmed','cancelled','completed') | default 'pending' |
| payment_status | enum('unpaid','paid','refunded') | default 'unpaid' |
| notes | text | nullable |
| created_at, updated_at | timestamp | |

### Tabel: `payments` (opsional, jika integrasi payment gateway)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | PK |
| booking_id | bigint | FK -> bookings |
| payment_method | varchar | |
| amount | decimal(10,2) | |
| transaction_id | varchar | dari payment gateway |
| status | enum('pending','success','failed') | |
| paid_at | timestamp | nullable |

**Relasi:**
- `users` 1—N `bookings`
- `facilities` 1—N `bookings`
- `facilities` 1—N `facility_schedules`
- `bookings` 1—1 `payments`

---

## 4. BACKEND — Laravel

### 4.1 Struktur Folder Penting

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Api/
│   │   │   ├── AuthController.php
│   │   │   ├── FacilityController.php
│   │   │   ├── BookingController.php
│   │   │   ├── PaymentController.php
│   │   │   └── ReportController.php
│   ├── Requests/
│   │   ├── StoreBookingRequest.php
│   │   ├── StoreFacilityRequest.php
│   ├── Resources/
│   │   ├── FacilityResource.php
│   │   ├── BookingResource.php
├── Models/
│   ├── User.php
│   ├── Facility.php
│   ├── FacilitySchedule.php
│   ├── Booking.php
│   ├── Payment.php
├── Services/
│   ├── BookingService.php   <-- logika cek jadwal bentrok ada di sini
├── Mail/
│   ├── BookingConfirmed.php
routes/
├── api.php
```

### 4.2 Autentikasi (Laravel Sanctum)

- Register & login menghasilkan token Sanctum.
- Middleware `auth:sanctum` untuk endpoint yang butuh login.
- Middleware tambahan `role:admin` (custom middleware) untuk endpoint khusus admin.

### 4.3 Daftar API Endpoint

#### Auth
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/register` | Public | Registrasi user baru |
| POST | `/api/login` | Public | Login, return token |
| POST | `/api/logout` | Auth | Hapus token aktif |
| GET | `/api/me` | Auth | Data user login |

#### Facilities (Lapangan/Ruangan)
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/facilities` | Public | List semua fasilitas + filter (type, search) |
| GET | `/api/facilities/{id}` | Public | Detail fasilitas |
| POST | `/api/facilities` | Admin | Tambah fasilitas baru |
| PUT | `/api/facilities/{id}` | Admin | Edit fasilitas |
| DELETE | `/api/facilities/{id}` | Admin | Hapus fasilitas |
| GET | `/api/facilities/{id}/availability?date=` | Public | Cek slot jam yang tersedia di tanggal tertentu |

#### Bookings
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/bookings` | Auth (user) | Riwayat booking milik user login |
| GET | `/api/admin/bookings` | Admin | Semua booking (bisa filter status, tanggal) |
| POST | `/api/bookings` | Auth (user) | Buat booking baru (validasi bentrok jadwal) |
| PUT | `/api/bookings/{id}/cancel` | Auth (user) | User batalkan booking sendiri |
| PUT | `/api/admin/bookings/{id}/status` | Admin | Ubah status booking (confirm/cancel) |

#### Payments (opsional)
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/bookings/{id}/pay` | Auth | Buat transaksi payment gateway |
| POST | `/api/payments/callback` | Public (webhook) | Callback dari Midtrans/Xendit |

#### Reports (Admin)
| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/admin/reports/summary` | Admin | Total booking, revenue per bulan |
| GET | `/api/admin/reports/export` | Admin | Export laporan ke Excel/PDF |

### 4.4 Logika Inti: Validasi Jadwal Bentrok

Ditempatkan di `app/Services/BookingService.php`:

```php
public function isSlotAvailable($facilityId, $date, $startTime, $endTime): bool
{
    $conflict = Booking::where('facility_id', $facilityId)
        ->where('booking_date', $date)
        ->whereIn('status', ['pending', 'confirmed'])
        ->where(function ($query) use ($startTime, $endTime) {
            $query->whereBetween('start_time', [$startTime, $endTime])
                  ->orWhereBetween('end_time', [$startTime, $endTime])
                  ->orWhere(function ($q) use ($startTime, $endTime) {
                      $q->where('start_time', '<=', $startTime)
                        ->where('end_time', '>=', $endTime);
                  });
        })
        ->exists();

    return !$conflict;
}
```

Panggil method ini di `BookingController@store` sebelum menyimpan booking baru.

### 4.5 Notifikasi Email

- Gunakan `Mailable` class `BookingConfirmed`.
- Dikirim via Queue (`ShouldQueue`) supaya tidak memperlambat response API.
- Trigger saat: booking dibuat (pending) dan saat status berubah jadi confirmed.

---

## 5. FRONTEND — React + Vite.js

### 5.1 Struktur Folder Penting

```
src/
├── api/
│   ├── axiosClient.js       <-- instance axios + interceptor token
│   ├── authApi.js
│   ├── facilityApi.js
│   ├── bookingApi.js
├── components/
│   ├── ui/                  <-- button, input, modal, dsb (reusable)
│   ├── layout/
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx      <-- untuk admin dashboard
│   ├── booking/
│   │   ├── BookingCalendar.jsx   <-- pakai FullCalendar
│   │   ├── BookingForm.jsx
│   │   ├── BookingCard.jsx
│   ├── facility/
│   │   ├── FacilityCard.jsx
│   │   ├── FacilityForm.jsx      <-- admin
├── pages/
│   ├── Home.jsx
│   ├── FacilityDetail.jsx
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── user/
│   │   ├── MyBookings.jsx
│   │   ├── Profile.jsx
│   ├── admin/
│   │   ├── Dashboard.jsx
│   │   ├── ManageFacilities.jsx
│   │   ├── ManageBookings.jsx
│   │   ├── Reports.jsx
├── store/
│   ├── authStore.js          <-- Zustand, simpan user & token
├── hooks/
│   ├── useAuth.js
│   ├── useBookings.js        <-- React Query
├── routes/
│   ├── AppRouter.jsx
│   ├── ProtectedRoute.jsx    <-- cek auth & role
├── App.jsx
├── main.jsx
```

### 5.2 Alur Halaman (User Flow)

1. **Home** — daftar fasilitas (card), search & filter by type.
2. **Facility Detail** — info fasilitas + kalender ketersediaan (FullCalendar, tampilkan slot terisi/kosong).
3. **Booking Form** — pilih tanggal & jam, sistem cek ketersediaan real-time ke API sebelum submit.
4. **My Bookings** — riwayat booking dengan status (pending/confirmed/cancelled), tombol batalkan.
5. **Login/Register** — form auth, redirect sesuai role setelah login.

### 5.3 Alur Halaman (Admin Flow)

1. **Dashboard** — ringkasan: total booking hari ini, revenue bulan ini, grafik sederhana (Recharts).
2. **Manage Facilities** — CRUD fasilitas (tabel + modal form + upload gambar).
3. **Manage Bookings** — tabel semua booking, filter by status/tanggal, tombol confirm/cancel.
4. **Reports** — laporan revenue per bulan, export ke Excel/PDF.

### 5.4 Komponen Kalender (FullCalendar)

- Library: `@fullcalendar/react`, `@fullcalendar/timegrid`
- Data slot booking diambil dari endpoint `GET /api/facilities/{id}/availability`
- Slot yang sudah dibooking ditampilkan sebagai event "terisi" (disabled/read-only)
- User klik slot kosong → buka modal `BookingForm`

### 5.5 State & Data Fetching

- **Zustand** — untuk auth state (user, token, role) yang perlu diakses di banyak komponen.
- **React Query (TanStack Query)** — untuk fetching data server (facilities, bookings), otomatis handle loading/error/cache/refetch.
- **Axios interceptor** — otomatis attach token Sanctum ke setiap request, dan redirect ke login jika token expired (401).

### 5.6 Routing & Proteksi Halaman

```jsx
// ProtectedRoute.jsx (konsep)
<Route element={<ProtectedRoute role="admin" />}>
  <Route path="/admin/dashboard" element={<Dashboard />} />
  <Route path="/admin/facilities" element={<ManageFacilities />} />
</Route>

<Route element={<ProtectedRoute role="user" />}>
  <Route path="/my-bookings" element={<MyBookings />} />
</Route>
```

---

## 6. Rencana Pengerjaan (Milestone)

| Minggu | Fokus |
|---|---|
| 1 | Setup project (Laravel + Sanctum, Vite + React + Tailwind), buat migration & model, ERD final |
| 2 | Backend: endpoint auth, facilities, bookings + logika validasi bentrok jadwal |
| 3 | Frontend: halaman auth, home, facility detail, kalender, booking form (integrasi API) |
| 4 | Dashboard admin (CRUD fasilitas, kelola booking, laporan), notifikasi email, testing & polish UI |

*(Opsional minggu ke-5: integrasi payment gateway Midtrans/Xendit sandbox)*

---

## 7. Fitur "Wow Factor" Tambahan (Opsional, jika waktu memungkinkan)

- 🔔 Notifikasi real-time pakai Laravel Reverb / Pusher (misal: admin dapat notif saat ada booking baru)
- 📊 Export laporan ke PDF (pakai `barryvdh/laravel-dompdf`) atau Excel (`maatwebsite/excel`)
- 💳 Integrasi payment gateway Midtrans/Xendit sandbox
- 📱 Responsive design penuh (mobile-friendly)
- 🌙 Dark mode toggle

---

## 8. Catatan Testing

- Backend: gunakan Pest/PHPUnit untuk test logika `BookingService` (kasus bentrok jadwal adalah yang paling penting untuk ditest).
- Frontend: bisa tambahkan testing dasar dengan Vitest + React Testing Library untuk komponen `BookingForm`.
