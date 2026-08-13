# LAPORAN AUDIT KEAMANAN — SistemBooking

> Auditor: Senior Cybersecurity Auditor & Software Architect
> Tanggal: 13 Agustus 2026
> Ruang lingkup: seluruh source code repository (`Back-End/`, `Front-End/`), commit `main` @ branch `claude/web-security-audit-q9t5p9`
> Metodologi: static source review + threat modeling, dipetakan ke OWASP Top 10 (2021)

---

## 1. AUTO-DETECTED TECH STACK & ARCHITECTURE

### Bahasa & Framework
| Layer | Deteksi | Bukti |
|---|---|---|
| Backend | **PHP 8.3+ / Laravel 13.20.0** | `Back-End/composer.json:9-13`, `composer.lock` (`laravel/framework v13.20.0`) |
| Auth | **Laravel Sanctum 4.x** (Personal Access Token / Bearer) | `config/sanctum.php`, `routes/api.php:19`, migrasi `personal_access_tokens` |
| PDF | **barryvdh/laravel-dompdf ^3.1** | `app/Http/Controllers/Api/ReportController.php:8,38` |
| Frontend | **React 19.2 + Vite 8** (SPA) | `Front-End/package.json:21-22,32` |
| Routing FE | react-router-dom 7.18 | `src/AppRouter.jsx` |
| State | **Zustand 5 (`persist` → localStorage)** + TanStack Query 5 | `src/store/authStore.js`, `src/main.jsx` |
| HTTP client | Axios 1.18 (interceptor Bearer) | `src/api/axiosClient.js` |
| UI | CSS kustom (bukan Tailwind, meski di-declare pada Back-End) + FullCalendar 6, Recharts 3, lucide-react | `src/index.css`, `src/pages/FacilityDetail.jsx` |
| Lint | oxlint 1.71 | `.oxlintrc.json` |

### Database / ORM & Cloud Services
- **ORM:** Eloquent. Model: `User`, `Facility`, `FacilitySchedule`, `Booking`, `Payment`.
- **Driver default:** `sqlite` (`.env.example:23`) — dokumen desain menyebut MySQL/PostgreSQL, terjadi **drift** antara konfigurasi dan target deployment (lihat L-03).
- **Session/Cache/Queue:** driver `database` (`.env.example:30,38,40`).
- **Cloud services:** tidak ada integrasi aktif. Slot AWS S3 tersedia namun kosong (`.env.example:59-63`); payment gateway (Midtrans/Xendit pada dokumen desain) **belum diimplementasikan** — hanya stub.
- **Secrets:** tidak ada file `.env` yang ter-commit dan tidak ditemukan hardcoded API key/token pada source. ✅ *(satu-satunya kredensial hardcoded ada di seeder — lihat H-05)*

### Arsitektur Ringkas
```
[React SPA :5173]                          [Laravel API :8000]
   Zustand(persist:localStorage)                routes/api.php
   token ──► axios interceptor                     │
              Authorization: Bearer ───────────────┤
                                                   ├─ PUBLIC   : register, login, facilities(index/show/availability),
                                                   │             payments/callback
                                                   ├─ auth:sanctum : me, logout, bookings(index/store/cancel),
                                                   │                 bookings/{id}/pay
                                                   └─ auth:sanctum + role:admin (prefix /admin)
                                                                 : facilities CRUD, bookings(adminIndex/updateStatus),
                                                                   reports(summary/export→DomPDF)
                                                   │
                          BookingService::isSlotAvailable() ──► Eloquent ──► DB (sqlite/mysql)
```
Alur inti: SPA stateless memakai Bearer token; otorisasi role dilakukan oleh satu middleware kustom `RoleMiddleware` (`app/Http/Middleware/RoleMiddleware.php:18`) yang membandingkan `user()->role` dengan parameter route. Tidak ada Policy/Gate, tidak ada Form Request class — semua validasi inline di controller.

---

## 2. EXECUTIVE SUMMARY

Aplikasi ini memiliki **fondasi yang benar** pada beberapa titik penting: password di-hash dengan bcrypt cost 12 dan cast `hashed`, seluruh query memakai Eloquent query builder (**tidak ditemukan satu pun SQL Injection**), ownership scoping pada booking user sudah benar (`$request->user()->bookings()->findOrFail()` — **tidak ada IDOR** pada endpoint booking/payment), React meng-escape output secara default (**tidak ada `dangerouslySetInnerHTML`/`eval`** — tidak ada XSS reflected/stored yang dapat dieksploitasi), dan Blade PDF memakai `{{ }}` yang ter-escape.

Namun demikian, **lapisan logika bisnis dan konfigurasi produksi masih terbuka lebar**. Temuan paling kritis bukan pada injeksi teknis, melainkan pada **kepercayaan berlebihan terhadap input client untuk nilai uang**: harga booking (`total_price`) dikirim oleh browser dan diterima mentah oleh server, sementara endpoint pembayaran menandai transaksi `success` tanpa verifikasi gateway apa pun. Kombinasi keduanya memungkinkan **penyerang memesan fasilitas apa pun dengan harga Rp 0 dan langsung mendapat status `confirmed`** — kerugian finansial langsung tanpa perlu keahlian teknis sama sekali.

Diperparah oleh **absennya rate limiting pada seluruh API** (Laravel 11+ tidak lagi memasang `throttle` secara default dan `bootstrap/app.php` tidak menambahkannya), sehingga endpoint `/api/login` terbuka untuk brute force/credential stuffing tanpa batas — dan seeder menanam akun admin `admin@admin.com` / `password` yang dapat ditebak dalam hitungan detik.

**Verdict: BELUM LAYAK PRODUKSI.** Sebagai proyek portofolio, arsitekturnya rapi dan idiomatik; sebagai sistem yang memegang uang, ia memerlukan perbaikan pada 5 temuan High sebelum di-deploy ke publik.

### Matrix Jumlah Temuan

| Tingkat Risiko | Jumlah |
|---|---|
| 🔴 **HIGH** | **5** |
| 🟠 **MEDIUM** | **8** |
| 🟡 **LOW** | **7** |
| **Total** | **20** |

**Distribusi OWASP Top 10 (2021):**
`A01 Broken Access Control` (3) · `A02 Cryptographic Failures` (1) · `A04 Insecure Design` (6) · `A05 Security Misconfiguration` (6) · `A07 Identification & Authentication Failures` (3) · `A09 Logging & Monitoring Failures` (1)

---

## 3. TABEL AUDIT KERENTANAN

| ID | Area / File | Ringkasan Masalah | Tingkat Risiko | Dampak Potensial |
|---|---|---|---|---|
| **H-01** | `Api/BookingController.php:32,45`<br>`FacilityDetail.jsx:53,67` | `total_price` dikirim & dipercaya dari client, tidak dihitung ulang di server | 🔴 **HIGH** | Manipulasi harga → booking Rp 0 / harga negatif, kerugian finansial langsung, laporan pendapatan korup |
| **H-02** | `Api/PaymentController.php:12-38`<br>`routes/api.php:17` | Pembayaran otomatis `success` tanpa verifikasi gateway; webhook `/payments/callback` publik & tanpa verifikasi signature | 🔴 **HIGH** | Free booking untuk semua user; webhook siap dieksploitasi begitu diisi logika (payment forgery) |
| **H-03** | `bootstrap/app.php:15-19`<br>`routes/api.php:11-12` | Tidak ada rate limiting sama sekali pada API (Laravel 11+ tidak lagi default) | 🔴 **HIGH** | Brute force / credential stuffing pada `/login` tanpa batas → account takeover; spam registrasi; DoS aplikatif |
| **H-04** | `.env.example:2,4,21`<br>`composer.json:37-44` | `APP_ENV=local`, `APP_DEBUG=true`, `LOG_LEVEL=debug` sebagai default, dan `composer setup` menyalinnya ke `.env` | 🔴 **HIGH** | Stack trace + halaman Ignition di produksi membocorkan `APP_KEY`, kredensial DB, path server → jalan menuju RCE |
| **H-05** | `database/seeders/DatabaseSeeder.php:19-25` | Kredensial admin default hardcoded & lemah (`admin@admin.com` / `password`) | 🔴 **HIGH** | Pengambilalihan akun admin secara instan bila seeder dijalankan di staging/produksi |
| **M-01** | `config/sanctum.php:53`<br>`authStore.js:13-15` | Token Sanctum tanpa masa berlaku (`expiration => null`), ability `['*']`, disimpan di `localStorage` | 🟠 MEDIUM | Token bocor = akses permanen; tidak ada rotasi/kadaluarsa; tidak tahan XSS |
| **M-02** | `config/` (tidak ada `cors.php`) | Memakai default framework: `allowed_origins => ['*']` | 🟠 MEDIUM | Semua origin dapat memanggil API; memperluas permukaan serangan & abuse endpoint publik |
| **M-03** | `Api/BookingController.php:36-45`<br>`Services/BookingService.php` | TOCTOU: cek ketersediaan slot dan `create()` tidak dalam transaksi/lock, tanpa unique constraint DB | 🟠 MEDIUM | Race condition → double booking pada slot yang sama, konflik jadwal, dispute pelanggan |
| **M-04** | `Api/BookingController.php:27-45` | Tidak memvalidasi `is_active` fasilitas, jam operasional `facility_schedules`, maupun durasi maksimum | 🟠 MEDIUM | Booking fasilitas nonaktif / di luar jam buka / durasi 24 jam; bypass aturan bisnis |
| **M-05** | `app/Models/User.php:14` | `role` termasuk atribut mass-assignable, tanpa `preventSilentlyDiscardingAttributes` | 🟠 MEDIUM | Privilege escalation laten — satu refactor ke `User::create($request->all())` langsung membuka self-promote ke admin |
| **M-06** | `BookingController.php:67-73`<br>`FacilityController.php:16-22` | Query param (`status`, `date`, `type`, `search`) dipakai tanpa validasi tipe; `LIKE` tanpa escape `%`/`_` | 🟠 MEDIUM | Unhandled exception 500 (info disclosure saat debug on); wildcard scan → DoS pada tabel besar |
| **M-07** | `Api/FacilityController.php:71-77`<br>migrasi `bookings`/`payments` | Hard delete fasilitas dengan `cascadeOnDelete` ke bookings & payments | 🟠 MEDIUM | Satu request admin menghapus permanen seluruh riwayat transaksi & bukti pembayaran — tidak dapat dipulihkan |
| **M-08** | `axiosClient.js:5`<br>`.env.example:5,32` | Base URL API hardcoded `http://localhost:8000`; tidak ada enforcement HTTPS/HSTS, tanpa security headers (CSP, X-Frame-Options, X-Content-Type-Options) | 🟠 MEDIUM | Build produksi salah target; token melintas via HTTP (MITM); clickjacking; tidak ada mitigasi XSS berlapis |
| **L-01** | `Api/AuthController.php:15-27` | `phone` diterima tanpa validasi; kebijakan password hanya `min:8` (tanpa `confirmed`, `max`, cek kebocoran) | 🟡 LOW | Data kotor/oversize; password lemah lolos; konfirmasi password hanya dicek di frontend |
| **L-02** | `BookingController.php:21,75`<br>`FacilityController.php:24`<br>`ReportController.php:33-36` | Seluruh endpoint list & export memakai `get()` tanpa paginasi/limit | 🟡 LOW | Memory exhaustion & timeout seiring pertumbuhan data (terutama export PDF) |
| **L-03** | `Api/ReportController.php:18` | `selectRaw('MONTH(created_at)')` tidak portabel — gagal pada driver `sqlite` (default `.env.example`) | 🟡 LOW | Dashboard admin error 500 pada konfigurasi default; drift dengan dokumen desain (MySQL/PostgreSQL) |
| **L-04** | `Api/FacilityController.php:27-31` | `show()` tidak memfilter `is_active`, berbeda dengan `index()` | 🟡 LOW | Fasilitas yang sengaja dinonaktifkan tetap dapat diakses & dipesan lewat URL langsung |
| **L-05** | `BookingController.php:78-88`<br>`FacilityController.php:71-77` | Tidak ada audit log untuk aksi admin (ubah status, hapus fasilitas, ubah harga) | 🟡 LOW | Tidak ada jejak forensik/akuntabilitas saat terjadi insiden atau penyalahgunaan internal |
| **L-06** | migrasi `password_reset_tokens`<br>`app/Models/User.php:5` | Tabel reset password tersedia namun tidak ada endpoint; verifikasi email dinonaktifkan (`MustVerifyEmail` di-comment) | 🟡 LOW | Registrasi email palsu massal; user terkunci permanen bila lupa password |
| **L-07** | `src/AppRouter.jsx:20-32` | Gating admin di frontend bergantung pada `user.role` dari `localStorage` yang dapat diedit user | 🟡 LOW | Kosmetik — shell UI admin dapat dibuka, namun API tetap memblokir data (`RoleMiddleware` berfungsi benar) |

---

## 4. ANALISIS DETAIL & SOLUSI

---

### 🔴 H-01 — Price Manipulation via Client-Controlled `total_price` — (HIGH)
**OWASP:** A04 Insecure Design · A01 Broken Access Control

**File / Baris Kode Berdampak**
- `Back-End/app/Http/Controllers/Api/BookingController.php:32` (`'total_price' => 'required|numeric'`) dan `:45` (`create($validated)`)
- `Back-End/app/Models/Booking.php:18` (`total_price` dalam `$fillable`)
- `Front-End/src/pages/FacilityDetail.jsx:53,67` (harga dihitung di browser lalu dikirim)

**Analisis & Skenario Serangan**
Harga dihitung sepenuhnya di sisi client (`const total_price = hours * facility.price_per_hour;`) lalu dikirim sebagai bagian dari payload. Server memvalidasi bahwa nilainya `numeric` — **tetapi tidak pernah memverifikasi bahwa nilainya benar**. Server tidak pernah membaca `price_per_hour` fasilitas sama sekali pada alur pembuatan booking.

Eksploitasi tidak memerlukan tool khusus, cukup satu request:
```bash
curl -X POST https://target/api/bookings \
  -H "Authorization: Bearer <token_user_biasa>" \
  -H "Content-Type: application/json" \
  -d '{"facility_id":1,"booking_date":"2026-08-20",
       "start_time":"08:00","end_time":"22:00","total_price":0}'
```
14 jam sewa Lapangan Futsal A (seharusnya Rp 2.100.000) tercatat Rp 0. Karena `'numeric'` juga menerima bilangan negatif dan notasi ilmiah, `total_price: -5000000` juga lolos — merusak agregat `SUM(total_price)` pada `ReportController::summary()` dan membuat laporan pendapatan menjadi negatif. Digabung dengan **H-02**, booking tersebut langsung menjadi `paid` + `confirmed`.

**Solusi / Kode Perbaikan**
Harga adalah **server-authoritative value** — jangan pernah menerimanya dari client. Hitung dari sumber kebenaran (`facilities.price_per_hour`).

```php
// app/Http/Controllers/Api/BookingController.php
public function store(Request $request)
{
    $validated = $request->validate([
        'facility_id'  => ['required', 'integer', 'exists:facilities,id'],
        'booking_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
        'start_time'   => ['required', 'date_format:H:i'],
        'end_time'     => ['required', 'date_format:H:i', 'after:start_time'],
        'notes'        => ['nullable', 'string', 'max:500'],
        // 'total_price' DIHAPUS dari input — dihitung server.
    ]);

    $facility = Facility::where('is_active', true)->findOrFail($validated['facility_id']);

    $booking = $this->bookingService->book($request->user(), $facility, $validated);

    return response()->json($booking, 201);
}
```

```php
// app/Services/BookingService.php
public function calculateTotalPrice(Facility $facility, string $start, string $end): string
{
    $startAt = Carbon::createFromFormat('H:i', $start);
    $endAt   = Carbon::createFromFormat('H:i', $end);

    $hours = $startAt->diffInMinutes($endAt) / 60;

    // bcmath agar tidak ada floating point drift pada nilai uang
    return bcmul((string) $facility->price_per_hour, (string) $hours, 2);
}
```
Tambahan pertahanan berlapis: hapus `total_price` dari `$fillable` model `Booking` dan set eksplisit lewat atribut, serta aktifkan `Model::preventSilentlyDiscardingAttributes()` (lihat M-05) agar payload berisi `total_price` justru **ditolak**, bukan diabaikan diam-diam. Frontend tetap boleh menghitung harga untuk *preview*, tetapi hasil server yang berlaku.

---

### 🔴 H-02 — Payment Bypass: Auto-Success & Unsigned Public Webhook — (HIGH)
**OWASP:** A04 Insecure Design · A07 Authentication Failures

**File / Baris Kode Berdampak**
- `Back-End/app/Http/Controllers/Api/PaymentController.php:20-30` (`'status' => 'success', // auto success for now`)
- `Back-End/app/Http/Controllers/Api/PaymentController.php:35-38` (`callback()` — stub tanpa verifikasi)
- `Back-End/routes/api.php:17` (`/payments/callback` berada **di luar** grup `auth:sanctum`)

**Analisis & Skenario Serangan**
Endpoint `POST /api/bookings/{id}/pay` membuat record `Payment` dengan `status = 'success'` dan `paid_at = now()`, lalu menandai booking `payment_status = 'paid'` dan `status = 'confirmed'` — **tanpa pernah menghubungi payment gateway, tanpa nominal terverifikasi, tanpa state pending.** Setiap user terautentikasi memperoleh konfirmasi booking gratis dengan satu request:
```bash
curl -X POST https://target/api/bookings/123/pay -H "Authorization: Bearer <token>"
# → {"status":"success","paid_at":"...","amount":"0.00"}
```
`transaction_id` dibangkitkan dengan `uniqid('TRX-')` yang berbasis timestamp mikrodetik — **dapat diprediksi** dan bukan sumber entropi kriptografis, sehingga tidak layak menjadi referensi transaksi.

Endpoint kedua, `POST /api/payments/callback`, terbuka untuk publik tanpa autentikasi dan tanpa verifikasi signature. Saat ini masih inert (hanya mengembalikan pesan), tetapi ia adalah **ranjau yang menunggu diinjak**: begitu developer mengisinya dengan logika "tandai booking sebagai lunas berdasarkan body request", siapa pun di internet dapat melunasi booking mana pun dengan satu POST. Pola inilah yang menjadi penyebab kebocoran finansial paling umum pada integrasi Midtrans/Xendit.

**Solusi / Kode Perbaikan**
1. Ubah alur menjadi **pending-first**; hanya webhook terverifikasi yang boleh mengubah status menjadi lunas.
2. Verifikasi signature webhook dengan perbandingan *timing-safe*, dan cocokkan nominal terhadap nilai server.

```php
public function pay(Request $request, $id)
{
    $booking = $request->user()->bookings()->findOrFail($id);

    abort_if($booking->payment_status === 'paid', 422, 'Booking ini sudah dibayar.');
    abort_if($booking->status === 'cancelled', 422, 'Booking sudah dibatalkan.');

    $payment = Payment::create([
        'booking_id'     => $booking->id,
        'payment_method' => $request->validate([
            'payment_method' => ['required', 'in:transfer,va_bca,gopay,qris'],
        ])['payment_method'],
        'amount'         => $booking->total_price,          // nominal dari server, bukan client
        'transaction_id' => 'TRX-'.Str::uuid(),             // entropi kriptografis
        'status'         => 'pending',                      // TIDAK auto-success
    ]);

    // return redirect/snap-token dari gateway di sini
    return response()->json($payment, 201);
}

public function callback(Request $request)
{
    // 1. Verifikasi signature — WAJIB, timing-safe
    $expected = hash('sha512',
        $request->input('order_id').$request->input('status_code').
        $request->input('gross_amount').config('services.midtrans.server_key')
    );

    abort_unless(hash_equals($expected, (string) $request->input('signature_key')), 403);

    // 2. Idempoten + row lock agar callback ganda tidak diproses dua kali
    return DB::transaction(function () use ($request) {
        $payment = Payment::where('transaction_id', $request->input('order_id'))
            ->lockForUpdate()->firstOrFail();

        if ($payment->status === 'success') {
            return response()->json(['message' => 'already processed']);   // idempotent
        }

        // 3. Cocokkan nominal terhadap nilai server
        abort_unless(
            bccomp((string) $request->input('gross_amount'), (string) $payment->amount, 2) === 0,
            422, 'Amount mismatch'
        );

        if (in_array($request->input('transaction_status'), ['settlement', 'capture'], true)) {
            $payment->update(['status' => 'success', 'paid_at' => now()]);
            $payment->booking->update(['payment_status' => 'paid', 'status' => 'confirmed']);
        }

        return response()->json(['message' => 'ok']);
    });
}
```
Tambahan: batasi route callback ke IP gateway bila tersedia, dan catat setiap callback (berhasil maupun ditolak) ke log audit.

---

### 🔴 H-03 — Tidak Ada Rate Limiting pada Seluruh API — (HIGH)
**OWASP:** A07 Identification & Authentication Failures · A04 Insecure Design

**File / Baris Kode Berdampak**
- `Back-End/bootstrap/app.php:15-19` — blok `withMiddleware()` hanya mendaftarkan alias `role`, **tidak memanggil `throttleApi()`**
- `Back-End/routes/api.php:11-12` — `/register` dan `/login` tanpa middleware `throttle`

**Analisis & Skenario Serangan**
Sejak Laravel 11, middleware `throttle:api` **tidak lagi dipasang otomatis** pada grup `api` — aplikasi harus mengaktifkannya secara eksplisit. `bootstrap/app.php` di proyek ini tidak melakukannya, sehingga **seluruh endpoint API tidak memiliki batas laju sama sekali.**

Konsekuensinya berlapis:
1. **Credential stuffing / brute force** pada `POST /api/login` tanpa batas. Dengan bcrypt cost 12 (~250ms/percobaan), serangan paralel 50 koneksi tetap menghasilkan ±200 tebakan/detik. Digabung **H-05** (password admin = `password`), akun admin jatuh pada percobaan pertama daftar wordlist mana pun.
2. **User enumeration**: `AuthController::login` mengembalikan pesan generik ("Kredensial tidak valid") — ✅ sudah benar — namun `register` mengembalikan error `unique:users` yang membocorkan email mana yang telah terdaftar; tanpa throttle, seluruh basis pengguna dapat dienumerasi.
3. **Aplikasi DoS**: setiap login memicu bcrypt cost 12 yang mahal secara CPU; flood terhadap `/login` melumpuhkan server tanpa perlu volume traffic besar.
4. **Spam registrasi** tak terbatas.

**Solusi / Kode Perbaikan**
```php
// bootstrap/app.php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Cache\RateLimiting\Limit;

->withMiddleware(function (Middleware $middleware) {
    $middleware->throttleApi();                       // baseline 60 req/menit untuk seluruh API
    $middleware->alias([
        'role' => \App\Http\Middleware\RoleMiddleware::class,
    ]);
})
```
```php
// routes/api.php — throttle ketat khusus endpoint autentikasi
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/login',    [AuthController::class, 'login'])->middleware('throttle:login');
```
```php
// app/Providers/AppServiceProvider.php — boot()
RateLimiter::for('login', fn (Request $request) => [
    Limit::perMinute(5)->by($request->input('email').'|'.$request->ip()),  // per akun
    Limit::perMinute(20)->by($request->ip()),                              // per sumber
]);
```
Pertimbangkan pula `Illuminate\Auth\Events\Failed` listener untuk lockout progresif dan alerting setelah N kegagalan beruntun.

---

### 🔴 H-04 — Debug Mode & Environment `local` sebagai Default yang Ter-deploy — (HIGH)
**OWASP:** A05 Security Misconfiguration

**File / Baris Kode Berdampak**
- `Back-End/.env.example:2` (`APP_ENV=local`), `:4` (`APP_DEBUG=true`), `:21` (`LOG_LEVEL=debug`)
- `Back-End/composer.json:37-44` — script `setup` menjalankan `copy('.env.example', '.env')` lalu `migrate --force`
- `Back-End/config/app.php:42` — default framework sendiri sudah aman (`(bool) env('APP_DEBUG', false)`), tetapi ditimpa oleh nilai `.env`

**Analisis & Skenario Serangan**
Template environment yang dikirim bersama repo secara default mengaktifkan debug. Karena `composer setup` menyalin file tersebut menjadi `.env` secara otomatis, deployment yang mengikuti README akan **berjalan di produksi dengan `APP_DEBUG=true`**. Ini adalah misconfiguration paling sering dieksploitasi pada aplikasi Laravel publik.

Skenario: penyerang memicu exception apa pun — cukup dengan `GET /api/facilities?type[]=x` (lihat M-06) atau `GET /api/facilities/999999`. Halaman error Laravel/Ignition kemudian menampilkan stack trace lengkap, path absolut server, versi framework, potongan source code, **dan seluruh variabel environment** — termasuk `APP_KEY`, kredensial database, serta kunci layanan pihak ketiga. Kebocoran `APP_KEY` memungkinkan pemalsuan cookie terenkripsi dan, pada rantai eksploitasi yang telah terdokumentasi luas (mis. CVE-2018-15133 dan turunannya), **eskalasi menuju Remote Code Execution**. `LOG_LEVEL=debug` juga berpotensi mencatat payload sensitif ke `storage/logs/laravel.log`.

**Solusi / Kode Perbaikan**
```diff
# .env.example  — nilai default HARUS aman-untuk-produksi
-APP_ENV=local
+APP_ENV=production
 APP_KEY=
-APP_DEBUG=true
+APP_DEBUG=false
-APP_URL=http://localhost
+APP_URL=https://booking.example.com
-LOG_LEVEL=debug
+LOG_LEVEL=error
+
+SESSION_SECURE_COOKIE=true
+SESSION_SAME_SITE=strict
+SANCTUM_STATEFUL_DOMAINS=booking.example.com
+FRONTEND_URL=https://booking.example.com
```
Tambahkan pengaman yang gagal-secara-keras (*fail loudly*) agar kesalahan konfigurasi tidak lolos diam-diam:
```php
// app/Providers/AppServiceProvider.php — boot()
if ($this->app->isProduction() && config('app.debug')) {
    throw new \RuntimeException('APP_DEBUG harus false di lingkungan produksi.');
}

URL::forceScheme('https');                 // saat production
Model::preventLazyLoading(! $this->app->isProduction());
```
Lengkapi juga proses rilis dengan `php artisan config:cache` (yang akan gagal bila `.env` tidak konsisten) dan pastikan `.env` tidak pernah ter-commit — *hasil audit: saat ini sudah benar, tidak ada `.env` di repository.* ✅

---

### 🔴 H-05 — Kredensial Admin Default yang Lemah & Hardcoded — (HIGH)
**OWASP:** A07 Identification & Authentication Failures · A05 Security Misconfiguration

**File / Baris Kode Berdampak**
- `Back-End/database/seeders/DatabaseSeeder.php:19-25` — `admin@admin.com` / `password` dengan `role => 'admin'`
- `Back-End/database/seeders/DatabaseSeeder.php:27-34` — `user@user.com` / `password`

**Analisis & Skenario Serangan**
Kredensial admin tertanam di source code yang berada di repository publik. Email `admin@admin.com` dan password `password` menempati peringkat teratas pada hampir seluruh wordlist umum (`rockyou.txt`, SecLists). Tanpa rate limiting (**H-03**), tebakan pertama sudah berhasil.

Rantai serangan lengkap: penyerang membaca repo → mencoba `admin@admin.com:password` pada `/api/login` → memperoleh token admin dengan ability `['*']` yang **tidak pernah kedaluwarsa** (**M-01**) → akses penuh ke `/api/admin/*`: mengekspor seluruh data pelanggan ke PDF (`reports/export` berisi nama pelanggan dan seluruh riwayat transaksi), mengubah harga fasilitas, dan menghapus fasilitas beserta **seluruh riwayat booking & pembayaran** melalui cascade (**M-07**).

**Solusi / Kode Perbaikan**
```php
// database/seeders/DatabaseSeeder.php
public function run(): void
{
    // Seeder demo hanya boleh berjalan di lingkungan non-produksi
    if (app()->isProduction()) {
        $this->command->warn('Seeder demo dilewati pada environment produksi.');
        return;
    }

    User::updateOrCreate(
        ['email' => config('seeding.admin_email', 'admin@example.test')],
        [
            'name'     => 'Admin User',
            // password wajib di-inject dari environment, tidak pernah hardcoded
            'password' => env('SEED_ADMIN_PASSWORD') ?: Str::password(20),
            'role'     => 'admin',
        ]
    );
}
```
Untuk produksi, buat akun admin lewat perintah artisan interaktif (`php artisan make:admin`) yang meminta password kuat, bukan lewat seeder. Rotasikan kredensial ini segera pada instalasi mana pun yang sudah pernah menjalankan seeder, dan aktifkan 2FA untuk role admin bila memungkinkan.

---

### 🟠 M-01 — Token Tanpa Kedaluwarsa, Ability Penuh, Disimpan di `localStorage` — (MEDIUM)
**OWASP:** A02 Cryptographic Failures · A07 Authentication Failures

**File / Baris Kode Berdampak**
- `Back-End/config/sanctum.php:53` — `'expiration' => null`
- `Back-End/app/Http/Controllers/Api/AuthController.php:29,53` — `createToken('auth_token')` tanpa argumen abilities → default `['*']`
- `Front-End/src/store/authStore.js:4-16` — `persist(...)` tanpa `storage` kustom → default `localStorage`

**Analisis & Skenario Serangan**
Tiga kelemahan yang saling memperkuat. Token bersifat *bearer* murni: siapa pun yang memilikinya adalah pemiliknya. Karena `expiration => null`, token **berlaku selamanya** — token yang bocor tahun ini masih valid tahun depan. Karena disimpan di `localStorage`, token dapat dibaca oleh JavaScript mana pun yang berjalan di origin tersebut. Meskipun audit ini **tidak menemukan XSS yang dapat dieksploitasi pada kode saat ini** (React meng-escape secara default; tidak ada `dangerouslySetInnerHTML`), permukaan risiko tetap besar: 11 dependensi frontend langsung (dan ratusan transitif) berarti satu paket ter-kompromi pada supply chain sudah cukup untuk mengeksfiltrasi seluruh token pengguna secara permanen.

Setiap login juga menerbitkan token baru tanpa mencabut yang lama, sehingga `personal_access_tokens` terus bertumbuh dan tidak ada mekanisme pencabutan massal — `logout()` hanya menghapus token yang sedang dipakai (`AuthController.php:64`).

**Solusi / Kode Perbaikan**
```php
// config/sanctum.php
'expiration' => (int) env('SANCTUM_EXPIRATION', 60 * 8),   // 8 jam
```
```php
// AuthController::login — batasi ability sesuai role, beri masa berlaku eksplisit
$abilities = $user->role === 'admin' ? ['admin:manage', 'booking:write'] : ['booking:write'];

$token = $user->createToken(
    name: 'auth_token',
    abilities: $abilities,
    expiresAt: now()->addHours(8),
)->plainTextToken;
```
Jadwalkan pembersihan token kedaluwarsa (`php artisan sanctum:prune-expired --hours=24`) melalui scheduler, dan tambahkan endpoint "logout dari semua perangkat" (`$user->tokens()->delete()`).

Untuk penyimpanan, opsi paling aman adalah beralih ke **Sanctum SPA mode** dengan cookie `HttpOnly` + `SameSite=strict` (domain SPA sudah terdaftar di `config/sanctum.php:21-26`, jadi jalurnya sudah tersedia). Bila arsitektur token dipertahankan, minimal simpan token di memori (bukan `localStorage`) dan gunakan refresh token ber-cookie `HttpOnly`:
```js
// src/store/authStore.js — jangan persist token ke localStorage
persist((set) => ({ /* ... */ }), {
  name: 'auth-storage',
  partialize: (state) => ({ user: state.user }),   // token TIDAK ikut dipersist
})
```

---

### 🟠 M-02 — CORS Terbuka untuk Semua Origin — (MEDIUM)
**OWASP:** A05 Security Misconfiguration

**File / Baris Kode Berdampak**
- `Back-End/config/` — **tidak ada `cors.php`**, sehingga berlaku default framework: `'allowed_origins' => ['*']`, `'paths' => ['api/*', 'sanctum/csrf-cookie']`

**Analisis & Skenario Serangan**
Middleware `HandleCors` aktif secara global dan mengizinkan **origin mana pun** melakukan cross-origin request ke `/api/*`. Karena autentikasi memakai header `Authorization` (bukan cookie) dan `supports_credentials` default bernilai `false`, browser **tidak** akan otomatis menyertakan kredensial korban — sehingga ini **bukan** jalur pencurian data langsung, dan penilaian risiko ditahan di Medium, bukan High.

Dampak nyatanya: seluruh endpoint publik (`/facilities`, `/register`, `/login`, `/payments/callback`) dapat dipanggil dari situs mana pun sebagai proxy — memungkinkan scraping katalog, penggunaan situs pihak ketiga sebagai relay untuk brute force yang terdistribusi via browser korban (memperparah **H-03**), dan pembuatan halaman login palsu yang berfungsi penuh terhadap API asli. Risiko meningkat menjadi kritis apabila proyek kelak beralih ke Sanctum SPA mode (cookie) tanpa lebih dulu memperketat CORS — kombinasi `origins: ['*']` + `supports_credentials: true` akan melumpuhkan proteksi same-origin sepenuhnya.

**Solusi / Kode Perbaikan**
```bash
php artisan config:publish cors
```
```php
// config/cors.php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    'allowed_origins' => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', ''))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Content-Type', 'Authorization', 'X-Requested-With'],
    'exposed_headers' => [],
    'max_age' => 3600,
    'supports_credentials' => false,   // set true HANYA bila beralih ke cookie-based auth
];
```
```dotenv
# .env
CORS_ALLOWED_ORIGINS=https://booking.example.com
```
Aturan mutlak: `allowed_origins: ['*']` dan `supports_credentials: true` **tidak boleh** digunakan bersamaan.

---

### 🟠 M-03 — Race Condition (TOCTOU) pada Pengecekan Slot — (MEDIUM)
**OWASP:** A04 Insecure Design

**File / Baris Kode Berdampak**
- `Back-End/app/Http/Controllers/Api/BookingController.php:36-45` — jeda antara `isSlotAvailable()` dan `create()`
- `Back-End/app/Services/BookingService.php:11-24` — `exists()` tanpa lock
- `Back-End/database/migrations/2026_07_15_171817_create_bookings_table.php` — tidak ada unique constraint pada kombinasi slot

**Analisis & Skenario Serangan**
Klasik *time-of-check to time-of-use*. Dua request bersamaan dapat sama-sama melewati `isSlotAvailable()` sebelum salah satunya menulis ke database, sehingga keduanya berhasil membuat booking pada slot yang sama. Tidak ada transaksi, tidak ada `lockForUpdate()`, dan tidak ada constraint di level database sebagai jaring pengaman terakhir.

Tanpa rate limiting (**H-03**), penyerang dapat mengirim 50 request paralel dan memesan slot yang sama berkali-kali — atau sekadar menyebabkan kekacauan operasional (dua pelanggan tiba di lapangan yang sama). Logika interval pada `BookingService` juga tidak menangani kasus tepi dengan benar: `whereBetween` bersifat inklusif, sehingga booking `08:00–10:00` dianggap bentrok dengan `10:00–12:00` (akhir slot lama = awal slot baru), yang justru menolak booking yang sah dan mengurangi utilisasi fasilitas.

**Solusi / Kode Perbaikan**
Gunakan tiga lapis pertahanan: transaksi, lock baris, dan constraint database.
```php
// app/Services/BookingService.php
public function book(User $user, Facility $facility, array $data): Booking
{
    return DB::transaction(function () use ($user, $facility, $data) {
        // Kunci seluruh booking pada fasilitas+tanggal tersebut selama transaksi
        Booking::where('facility_id', $facility->id)
            ->where('booking_date', $data['booking_date'])
            ->lockForUpdate()
            ->get();

        if (! $this->isSlotAvailable($facility->id, $data['booking_date'], $data['start_time'], $data['end_time'])) {
            throw ValidationException::withMessages(['start_time' => 'Jadwal bentrok atau tidak tersedia.']);
        }

        return $user->bookings()->create([
            ...$data,
            'total_price' => $this->calculateTotalPrice($facility, $data['start_time'], $data['end_time']),
        ]);
    }, attempts: 3);
}

// Perbaiki logika overlap — dua interval bertumpuk jika: start < existing_end AND end > existing_start
public function isSlotAvailable($facilityId, $date, $startTime, $endTime): bool
{
    return ! Booking::where('facility_id', $facilityId)
        ->where('booking_date', $date)
        ->whereIn('status', ['pending', 'confirmed'])
        ->where('start_time', '<', $endTime)
        ->where('end_time', '>', $startTime)
        ->exists();
}
```
```php
// migrasi baru — jaring pengaman terakhir di level DB
Schema::table('bookings', function (Blueprint $table) {
    $table->index(['facility_id', 'booking_date', 'status']);   // sekaligus performa
    $table->unique(['facility_id', 'booking_date', 'start_time'], 'bookings_slot_unique');
});
```

---

### 🟠 M-04 — Aturan Bisnis Booking Tidak Ditegakkan di Server — (MEDIUM)
**OWASP:** A04 Insecure Design · A01 Broken Access Control

**File / Baris Kode Berdampak**
- `Back-End/app/Http/Controllers/Api/BookingController.php:27-45`
- Tabel `facility_schedules` (`app/Models/FacilitySchedule.php`) — **dibuat, di-seed, tetapi tidak pernah digunakan untuk validasi**
- `Front-End/src/pages/FacilityDetail.jsx:37-40,134-135` — pembatasan hanya di UI (`selectAllow`, `slotMinTime/slotMaxTime`)

**Analisis & Skenario Serangan**
Seluruh aturan bisnis hanya ditegakkan di frontend. Kalender membatasi tampilan ke pukul 06:00–23:00 dan menolak tanggal lampau melalui `selectAllow` — tetapi ini murni kosmetik; API menerima apa pun. Server tidak memeriksa:
- **`is_active`** — fasilitas yang sengaja dinonaktifkan admin tetap dapat dipesan (validasi hanya `exists:facilities,id`).
- **`facility_schedules`** — booking pukul 03:00 dini hari lolos meski fasilitas hanya buka 08:00–22:00.
- **Durasi maksimum** — `end_time` hanya wajib `after:start_time`, sehingga booking `00:01–23:59` diterima, memblokir fasilitas sepanjang hari.
- **Jumlah booking per user** — satu akun dapat memblokir seluruh slot pada seluruh fasilitas (denial of inventory).

Digabung dengan **H-01**, penyerang dapat memblokir seluruh inventaris fasilitas dengan harga Rp 0.

**Solusi / Kode Perbaikan**
Pindahkan aturan ke Form Request agar konsisten dan dapat diuji:
```php
// app/Http/Requests/StoreBookingRequest.php
public function rules(): array
{
    return [
        'facility_id'  => ['required', 'integer',
                           Rule::exists('facilities', 'id')->where('is_active', true)],
        'booking_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today',
                           'before_or_equal:'.now()->addMonths(3)->toDateString()],
        'start_time'   => ['required', 'date_format:H:i'],
        'end_time'     => ['required', 'date_format:H:i', 'after:start_time'],
        'notes'        => ['nullable', 'string', 'max:500'],
    ];
}

public function withValidator($validator): void
{
    $validator->after(function ($v) {
        $facility = Facility::find($this->facility_id);
        if (! $facility) return;

        $dow = Carbon::parse($this->booking_date)->dayOfWeek;
        $schedule = $facility->schedules()->where('day_of_week', $dow)->first();

        if (! $schedule) {
            $v->errors()->add('booking_date', 'Fasilitas tutup pada hari tersebut.');
            return;
        }

        if ($this->start_time < substr($schedule->open_time, 0, 5)
            || $this->end_time > substr($schedule->close_time, 0, 5)) {
            $v->errors()->add('start_time', "Di luar jam operasional ({$schedule->open_time}–{$schedule->close_time}).");
        }

        $hours = Carbon::createFromFormat('H:i', $this->start_time)
            ->diffInMinutes(Carbon::createFromFormat('H:i', $this->end_time)) / 60;

        if ($hours > config('booking.max_hours', 4)) {
            $v->errors()->add('end_time', 'Durasi booking maksimal '.config('booking.max_hours', 4).' jam.');
        }
    });
}
```

---

### 🟠 M-05 — `role` Mass-Assignable (Privilege Escalation Laten) — (MEDIUM)
**OWASP:** A01 Broken Access Control

**File / Baris Kode Berdampak**
- `Back-End/app/Models/User.php:14` — `#[Fillable(['name', 'email', 'password', 'role', 'phone'])]`

**Analisis & Skenario Serangan**
Kolom `role` — satu-satunya penentu otorisasi di seluruh aplikasi (`RoleMiddleware.php:18`) — termasuk atribut yang dapat di-mass-assign.

**Perlu ditegaskan secara jujur: pada kode saat ini celah ini BELUM dapat dieksploitasi.** `AuthController::register` menyusun array secara eksplisit dan meng-hardcode `'role' => 'user'` (`AuthController.php:21-27`), dan tidak ada endpoint update profil. Karena itu peringkatnya Medium, bukan High.

Namun risikonya nyata dan berbiaya rendah untuk ditutup. Begitu ada developer yang menambahkan endpoint profil dengan pola idiomatik `$user->update($request->validated())` atau `User::create($request->all())`, penyerang cukup menyisipkan `"role":"admin"` pada payload registrasi untuk mempromosikan dirinya sendiri menjadi admin. Ini adalah pola kegagalan yang tepat sama dengan **H-01** (`total_price` dipercaya dari client) — indikasi bahwa batas kepercayaan input belum ditetapkan secara sistematis pada proyek ini.

**Solusi / Kode Perbaikan**
```php
// app/Models/User.php — role TIDAK boleh mass-assignable
#[Fillable(['name', 'email', 'password', 'phone'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role'     => UserRole::class,   // enum backed, bukan string bebas
        ];
    }
}
```
```php
// AppServiceProvider::boot() — payload berisi atribut terlarang DITOLAK, bukan diabaikan diam-diam
Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());
```
Perubahan role harus melalui jalur eksplisit yang terproteksi Policy dan tercatat di audit log (**L-05**):
```php
$user->forceFill(['role' => UserRole::Admin])->save();   // eksplisit & mudah di-grep saat audit
```

---

### 🟠 M-06 — Query Parameter Tanpa Validasi & `LIKE` Tanpa Escape — (MEDIUM)
**OWASP:** A05 Security Misconfiguration · A04 Insecure Design

**File / Baris Kode Berdampak**
- `Back-End/app/Http/Controllers/Api/BookingController.php:67-73` — `$request->status`, `$request->date`
- `Back-End/app/Http/Controllers/Api/FacilityController.php:16-22` — `$request->type`, `$request->search`

**Analisis & Skenario Serangan**
**Catatan penting: ini BUKAN SQL Injection.** Eloquent melakukan parameter binding pada seluruh nilai tersebut, dan audit ini tidak menemukan satu pun titik SQLi di seluruh codebase. Masalahnya adalah *type confusion* dan *resource exhaustion*.

1. **Array injection → unhandled exception.** `GET /api/facilities?type[]=a&type[]=b` membuat `$request->type` bernilai array, sedangkan `where()` mengharapkan skalar → `TypeError`/`ErrorException` tak tertangani → HTTP 500. Dengan `APP_DEBUG=true` (**H-04**), respons tersebut memuat stack trace lengkap dan variabel environment. Inilah cara termudah bagi penyerang untuk *memicu* kebocoran H-04.
2. **`has()` vs `filled()`.** `$request->has('status')` bernilai true bahkan ketika parameter kosong (`?status=`), sehingga query menjadi `where('status', '')` dan selalu mengembalikan himpunan kosong — bug fungsional yang membingungkan admin.
3. **LIKE wildcard injection.** `'%' . $request->search . '%'` tidak meng-escape `%` dan `_`. Input `%_%_%_%_%_%` memaksa full table scan dengan backtracking berat; pada tabel besar tanpa paginasi (**L-02**) ini menjadi vektor DoS berbiaya sangat rendah bagi penyerang.

**Solusi / Kode Perbaikan**
```php
public function index(Request $request)
{
    $filters = $request->validate([
        'type'     => ['sometimes', 'string', 'in:lapangan,meeting_room'],
        'search'   => ['sometimes', 'string', 'max:100'],
        'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
    ]);

    return Facility::query()
        ->where('is_active', true)
        ->when($filters['type'] ?? null, fn ($q, $type) => $q->where('type', $type))
        ->when($filters['search'] ?? null, function ($q, $search) {
            $escaped = addcslashes($search, '%_\\');       // netralkan wildcard
            $q->where('name', 'like', "%{$escaped}%");
        })
        ->paginate($filters['per_page'] ?? 15);
}
```
Terapkan pola yang sama pada `BookingController::adminIndex` (`status` → `in:pending,confirmed,cancelled,completed`, `date` → `date_format:Y-m-d`). Untuk pencarian teks berskala besar, pertimbangkan full-text index alih-alih `LIKE '%…%'` yang tidak dapat memanfaatkan index.

---

### 🟠 M-07 — Hard Delete Fasilitas Menghancurkan Riwayat Transaksi — (MEDIUM)
**OWASP:** A04 Insecure Design

**File / Baris Kode Berdampak**
- `Back-End/app/Http/Controllers/Api/FacilityController.php:71-77`
- `database/migrations/..._create_bookings_table.php:17` — `foreignId('facility_id')->constrained()->cascadeOnDelete()`
- `database/migrations/..._create_payments_table.php:16` — `foreignId('booking_id')->constrained()->cascadeOnDelete()`

**Analisis & Skenario Serangan**
`DELETE /api/admin/facilities/{id}` melakukan penghapusan permanen. Melalui cascade dua tingkat, satu request menghapus **fasilitas → seluruh booking-nya → seluruh pembayaran terkait**. Riwayat keuangan lenyap tanpa jejak, tanpa konfirmasi, dan tanpa audit log (**L-05**).

Skenario: akun admin yang dikompromikan (sangat mungkin, lihat **H-05**) menghapus 2 fasilitas dan memusnahkan seluruh basis transaksi. Skenario yang lebih mungkin dan sama merusaknya: admin sah salah klik pada UI (`AdminFacilities.jsx`), dan data pembayaran pelanggan hilang permanen — menimbulkan masalah kepatuhan (bukti transaksi wajib disimpan) dan dispute yang tidak dapat diselesaikan.

**Solusi / Kode Perbaikan**
```php
// app/Models/Facility.php
use Illuminate\Database\Eloquent\SoftDeletes;

class Facility extends Model
{
    use HasFactory, SoftDeletes;
}
```
```php
// migrasi
Schema::table('facilities', fn (Blueprint $t) => $t->softDeletes());

// Putuskan rantai cascade — riwayat keuangan tidak boleh ikut terhapus
Schema::table('bookings', function (Blueprint $table) {
    $table->dropForeign(['facility_id']);
    $table->foreign('facility_id')->references('id')->on('facilities')->restrictOnDelete();
});
```
```php
// FacilityController::destroy — tolak penghapusan bila masih ada booking aktif
public function destroy($id)
{
    $facility = Facility::findOrFail($id);

    if ($facility->bookings()->whereIn('status', ['pending', 'confirmed'])->exists()) {
        return response()->json([
            'message' => 'Fasilitas masih memiliki booking aktif. Nonaktifkan (is_active=false) alih-alih menghapus.',
        ], 409);
    }

    $facility->delete();   // soft delete — dapat dipulihkan
    activity()->causedBy(request()->user())->performedOn($facility)->log('facility.deleted');

    return response()->json(['message' => 'Fasilitas dinonaktifkan']);
}
```

---

### 🟠 M-08 — Transport Security & Security Headers Tidak Dikonfigurasi — (MEDIUM)
**OWASP:** A05 Security Misconfiguration · A02 Cryptographic Failures

**File / Baris Kode Berdampak**
- `Front-End/src/api/axiosClient.js:5` — `baseURL: 'http://localhost:8000/api'` (hardcoded, plain HTTP)
- `Back-End/.env.example:5` — `APP_URL=http://localhost`
- `Back-End/config/session.php:172` — `'secure' => env('SESSION_SECURE_COOKIE')` → `null` bila tidak diset
- `Front-End/index.html` — tidak ada CSP; tidak ada middleware security header di backend

**Analisis & Skenario Serangan**
URL API tertanam sebagai literal di source frontend, sehingga build produksi (`npm run build`) menghasilkan bundle yang menunjuk ke `localhost` — aplikasi tidak akan berfungsi saat di-deploy, dan perbaikan tergesa-gesa saat rilis cenderung berujung pada endpoint HTTP polos. Bila API diakses via HTTP, **Bearer token melintas dalam bentuk plaintext** dan dapat disadap pada jaringan bersama (Wi-Fi publik) — digabung dengan **M-01** (token tanpa kedaluwarsa), satu penyadapan berarti akses permanen.

Selain itu tidak ada satu pun security header: tanpa `Content-Security-Policy` (mitigasi berlapis untuk XSS dan pembatas eksfiltrasi), tanpa `X-Frame-Options`/`frame-ancestors` (aplikasi dapat di-iframe → clickjacking pada tombol "Lanjutkan Booking" dan aksi admin), tanpa `X-Content-Type-Options: nosniff`, tanpa `Referrer-Policy`, dan tanpa HSTS.

**Solusi / Kode Perbaikan**
```js
// src/api/axiosClient.js — konfigurasi lewat environment Vite
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});
```
```dotenv
# Front-End/.env.production
VITE_API_BASE_URL=https://api.booking.example.com/api
```
```php
// app/Http/Middleware/SecurityHeaders.php
public function handle(Request $request, Closure $next): Response
{
    $response = $next($request);

    $response->headers->add([
        'X-Content-Type-Options'    => 'nosniff',
        'X-Frame-Options'           => 'DENY',
        'Referrer-Policy'           => 'strict-origin-when-cross-origin',
        'Permissions-Policy'        => 'geolocation=(), camera=(), microphone=()',
        'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains; preload',
        'Content-Security-Policy'   => "default-src 'self'; script-src 'self'; "
            ."style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
            ."connect-src 'self' https://api.booking.example.com; frame-ancestors 'none'; base-uri 'self'",
    ]);

    return $response;
}
```
Daftarkan pada `bootstrap/app.php` (`$middleware->append(SecurityHeaders::class)`) dan set `SESSION_SECURE_COOKIE=true` pada `.env` produksi.

---

### 🟡 L-01 — Validasi Registrasi Lemah — (LOW)
**File:** `Back-End/app/Http/Controllers/Api/AuthController.php:15-27`; `Front-End/src/pages/Register.jsx:117-121`

**Analisis.** `phone` dibaca langsung via `$request->phone` (baris 26) **tanpa masuk ke aturan `validate()`** — tidak ada batas panjang, format, maupun tipe; array atau string 10 MB akan diteruskan ke DB hingga memicu error kolom. Kebijakan password hanya `min:8` tanpa `confirmed`, tanpa batas maksimum (bcrypt memotong pada 72 byte — password panjang terpotong diam-diam), dan tanpa pengecekan kebocoran. Konfirmasi password **hanya divalidasi di frontend** (`Register.jsx:117`) sehingga sepenuhnya dapat dilewati lewat panggilan API langsung.

**Solusi.**
```php
use Illuminate\Validation\Rules\Password;

$validated = $request->validate([
    'name'     => ['required', 'string', 'max:255'],
    'email'    => ['required', 'string', 'email:rfc,dns', 'max:255', 'unique:users,email'],
    'phone'    => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s()]+$/'],
    'password' => ['required', 'confirmed', 'max:72',
                   Password::min(10)->mixedCase()->numbers()->uncompromised()],
]);

$user = User::create([...$validated, 'password' => $validated['password'], 'role' => 'user']);
```

---

### 🟡 L-02 — Tidak Ada Paginasi pada Endpoint List & Export — (LOW)
**File:** `BookingController.php:21,75`; `FacilityController.php:24`; `ReportController.php:33-36`

**Analisis.** Seluruh endpoint memuat hasil dengan `->get()` tanpa batas. `adminIndex` melakukan eager load `['user','facility']` untuk **seluruh** booking; `ReportController::export` memuat seluruh riwayat lalu me-render PDF via DomPDF (yang menyimpan seluruh dokumen di memori). Pada 50.000 booking, satu klik "Export" akan menghabiskan memori PHP dan menjatuhkan worker — DoS yang dapat dipicu tanpa niat jahat, dan disengaja tanpa rate limit (**H-03**).

**Solusi.** Gunakan `->paginate(20)` pada seluruh endpoint list; untuk export, wajibkan filter rentang tanggal dan proses lewat queue job yang mengirim hasil via email:
```php
$request->validate([
    'from' => ['required', 'date'],
    'to'   => ['required', 'date', 'after_or_equal:from', 'before:'.now()->addDay()->toDateString()],
]);
ExportBookingReport::dispatch($request->user(), $request->from, $request->to);
return response()->json(['message' => 'Laporan sedang diproses dan akan dikirim via email.'], 202);
```

---

### 🟡 L-03 — SQL Tidak Portabel: `MONTH()` pada Driver SQLite — (LOW)
**File:** `Back-End/app/Http/Controllers/Api/ReportController.php:18`

**Analisis.** `selectRaw('MONTH(created_at) as month, SUM(total_price) as revenue')` memakai fungsi khusus MySQL. Konfigurasi default proyek adalah `DB_CONNECTION=sqlite` (`.env.example:23`), dan SQLite tidak mengenal `MONTH()` → `SQLSTATE[HY000]: no such function: MONTH`. Dashboard admin akan error 500 pada instalasi default — dan dengan `APP_DEBUG=true` (**H-04**), error tersebut membocorkan detail internal. Ini juga menandakan drift antara konfigurasi repo dan dokumen desain yang menyebut MySQL/PostgreSQL.

**Solusi.** Gunakan ekspresi portabel dan samakan driver dev dengan produksi:
```php
$revenuePerMonth = Booking::query()
    ->where('payment_status', 'paid')
    ->whereBetween('created_at', [now()->startOfYear(), now()->endOfYear()])
    ->get()
    ->groupBy(fn ($b) => $b->created_at->format('n'))
    ->map(fn ($rows, $month) => ['month' => (int) $month, 'revenue' => $rows->sum('total_price')])
    ->values();
```
Sebagai alternatif yang tetap efisien di DB, gunakan `DB::raw` bercabang per driver, atau simpan kolom `period` ter-denormalisasi. Selaraskan `DB_CONNECTION` di `.env.example` dengan target produksi.

---

### 🟡 L-04 — `show()` Membocorkan Fasilitas Nonaktif — (LOW)
**File:** `Back-End/app/Http/Controllers/Api/FacilityController.php:27-31` vs `:14`

**Analisis.** `index()` memfilter `where('is_active', true)`, tetapi `show()` tidak. Fasilitas yang sengaja dinonaktifkan admin (mis. sedang renovasi) tetap dapat diakses lewat `GET /api/facilities/5` dan — karena `store()` booking juga tidak memeriksa `is_active` (**M-04**) — tetap dapat dipesan. Inkonsistensi kontrol akses antar-endpoint pada resource yang sama.

**Solusi.**
```php
public function show($id)
{
    $facility = Facility::with('schedules')->where('is_active', true)->findOrFail($id);
    return response()->json($facility);
}
```
Sebaiknya gunakan global scope atau Policy agar aturan ini otomatis konsisten di seluruh endpoint publik, sementara admin memakai `withInactive()` secara eksplisit.

---

### 🟡 L-05 — Tidak Ada Audit Log untuk Aksi Admin — (LOW)
**OWASP:** A09 Security Logging & Monitoring Failures
**File:** `BookingController.php:78-88`; `FacilityController.php:33-77`

**Analisis.** Perubahan status booking, perubahan harga fasilitas, dan penghapusan fasilitas tidak meninggalkan jejak apa pun. Bila terjadi insiden (mis. akun admin dikompromikan lewat **H-05**), tidak ada cara mengetahui apa yang diubah, oleh siapa, dan kapan — investigasi forensik menjadi mustahil dan pemulihan data (**M-07**) tanpa panduan. Kegagalan login juga tidak dicatat, sehingga brute force (**H-03**) berlangsung tanpa terdeteksi.

**Solusi.** Pasang audit trail (mis. `spatie/laravel-activitylog`) pada model `Booking`, `Facility`, dan `Payment`, serta catat event autentikasi:
```php
// AppServiceProvider::boot()
Event::listen(Failed::class, fn ($e) => Log::channel('security')->warning('auth.failed', [
    'email' => $e->credentials['email'] ?? null, 'ip' => request()->ip(),
]));
```
Kirim log ke sink terpusat di luar server aplikasi, dan pasang alert untuk lonjakan kegagalan login serta aksi destruktif admin.

---

### 🟡 L-06 — Verifikasi Email & Alur Reset Password Tidak Diimplementasikan — (LOW)
**File:** `Back-End/app/Models/User.php:5` (`// use ...MustVerifyEmail;`); migrasi `password_reset_tokens` (dibuat, tidak dipakai); `routes/api.php` (tidak ada endpoint terkait)

**Analisis.** Registrasi menerima alamat email apa pun tanpa verifikasi kepemilikan — memungkinkan pendaftaran massal dengan email palsu (diperparah tanpa rate limit, **H-03**) dan membuat notifikasi booking terkirim ke alamat yang tidak valid. Tabel `password_reset_tokens` ada di skema tetapi tidak ada endpoint yang menggunakannya, sehingga pengguna yang lupa password **terkunci permanen** dan harus dibantu manual lewat database — praktik yang justru mendorong penanganan kredensial secara tidak aman.

**Solusi.** Aktifkan `MustVerifyEmail` pada model `User`, tambahkan middleware `verified` pada route pembuatan booking, serta implementasikan endpoint `forgot-password`/`reset-password` bawaan Laravel dengan throttle ketat dan pesan respons yang seragam (agar tidak membocorkan email mana yang terdaftar).

---

### 🟡 L-07 — Gating Admin di Frontend Bergantung pada State yang Dapat Diedit — (LOW)
**File:** `Front-End/src/AppRouter.jsx:20-32`; `src/store/authStore.js:14`

**Analisis.** `ProtectedRoute` menentukan akses admin dari `user.role` yang dipersist di `localStorage` (`auth-storage`). Pengguna dapat mengubah nilainya lewat DevTools menjadi `"admin"` dan me-refresh halaman untuk membuka shell UI admin.

**Dampaknya kosmetik, bukan pelanggaran akses data.** Audit ini mengonfirmasi bahwa backend melakukan penegakan yang benar: `RoleMiddleware` (`RoleMiddleware.php:18`) memeriksa `role` dari record database pengguna terautentikasi, sehingga seluruh panggilan `/api/admin/*` tetap ditolak 403 dan halaman admin hanya menampilkan error/state kosong. Kendati demikian, kebocoran struktur UI internal memberi penyerang peta endpoint admin, dan pola ini berbahaya bila kelak ada data yang dirender dari state lokal.

**Solusi.** Jangan jadikan state client sebagai sumber kebenaran otorisasi. Verifikasi role terhadap server saat aplikasi dimuat, dan jangan persist `role`:
```jsx
const { data: me, isLoading } = useQuery({
  queryKey: ['me'],
  queryFn: async () => (await axiosClient.get('/me')).data,
  enabled: isAuthenticated,
  staleTime: 60_000,
});

if (isLoading) return <FullPageSpinner />;
if (requireAdmin && me?.role !== 'admin') return <Navigate to="/" replace />;
```

---

## 5. ACTIONABLE CHECKLIST

### 🔥 Prioritas 1 — Blocker Produksi (perbaiki sebelum deploy publik)
- [ ] **[H-01]** Hapus `total_price` dari input API; hitung di server dari `facilities.price_per_hour` × durasi menggunakan `bcmath`.
- [ ] **[H-02]** Ubah `PaymentController::pay` menjadi status `pending`; integrasikan gateway sungguhan. Tambahkan verifikasi signature `hash_equals`, pencocokan nominal, idempotensi, dan `lockForUpdate` pada `callback()`. Ganti `uniqid()` dengan `Str::uuid()`.
- [ ] **[H-03]** Aktifkan `$middleware->throttleApi()` pada `bootstrap/app.php`; tambahkan `throttle:5,1` pada `/login` & `/register` dengan RateLimiter berbasis email+IP.
- [ ] **[H-04]** Ubah default `.env.example` menjadi `APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=error`; tambahkan guard runtime yang melempar exception bila debug aktif di produksi.
- [ ] **[H-05]** Hapus kredensial hardcoded dari seeder; batasi seeder ke non-produksi; rotasikan password admin pada seluruh instalasi yang pernah di-seed.

### ⚠️ Prioritas 2 — Sebelum Rilis Pengguna Nyata
- [ ] **[M-01]** Set `SANCTUM_EXPIRATION`; batasi token abilities per role; hentikan persist token ke `localStorage`; jadwalkan `sanctum:prune-expired`.
- [ ] **[M-02]** Publish `config/cors.php` dan whitelist origin secara eksplisit lewat environment.
- [ ] **[M-03]** Bungkus pembuatan booking dalam `DB::transaction` + `lockForUpdate`; perbaiki logika overlap (`start < existing_end && end > existing_start`); tambahkan unique constraint & index pada tabel `bookings`.
- [ ] **[M-04]** Pindahkan validasi ke `StoreBookingRequest`: cek `is_active`, jam operasional `facility_schedules`, durasi maksimum, dan horizon tanggal.
- [ ] **[M-05]** Keluarkan `role` dari `#[Fillable]`; cast ke enum; aktifkan `preventSilentlyDiscardingAttributes`.
- [ ] **[M-06]** Validasi seluruh query parameter (`in:`, `date_format:`); ganti `has()` → `filled()`; escape wildcard `LIKE` dengan `addcslashes`.
- [ ] **[M-07]** Aktifkan `SoftDeletes` pada `Facility`; ubah cascade menjadi `restrictOnDelete`; tolak penghapusan bila masih ada booking aktif.
- [ ] **[M-08]** Pindahkan base URL API ke `VITE_API_BASE_URL`; tambahkan middleware security headers (CSP, HSTS, X-Frame-Options); set `SESSION_SECURE_COOKIE=true`.

### 📋 Prioritas 3 — Peningkatan Kualitas & Ketahanan
- [ ] **[L-01]** Validasi `phone`; perkuat kebijakan password (`confirmed`, `max:72`, `Password::min(10)->uncompromised()`).
- [ ] **[L-02]** Terapkan paginasi pada seluruh endpoint list; wajibkan rentang tanggal pada export dan proses lewat queue.
- [ ] **[L-03]** Ganti `MONTH()` dengan ekspresi portabel; selaraskan `DB_CONNECTION` dengan target produksi.
- [ ] **[L-04]** Filter `is_active` pada `FacilityController::show()`.
- [ ] **[L-05]** Pasang audit log untuk aksi admin dan event kegagalan autentikasi.
- [ ] **[L-06]** Aktifkan `MustVerifyEmail`; implementasikan alur reset password.
- [ ] **[L-07]** Verifikasi role melalui `/api/me` alih-alih state `localStorage`; jangan persist `role`.

### 🛡️ Rekomendasi Proses Berkelanjutan
- [ ] Tambahkan pipeline CI dengan `composer audit` dan `npm audit` untuk memantau CVE dependensi.
- [ ] Refactor seluruh validasi inline controller menjadi **Form Request classes**, dan otorisasi menjadi **Policies** — ini akan mencegah kelas kerentanan H-01, M-04, dan M-06 secara struktural.
- [ ] Tulis test regresi keamanan: booking dengan `total_price` manipulatif harus 422; user biasa mengakses `/api/admin/*` harus 403; login ke-6 dalam satu menit harus 429.
- [ ] Terapkan pemindaian rahasia (`gitleaks`) pada pre-commit hook.

---

### Catatan Positif (dipertahankan)
Beberapa keputusan pada proyek ini sudah tepat dan sebaiknya tidak diubah saat refactor:
- ✅ **Tidak ada SQL Injection** — seluruh query memakai Eloquent dengan parameter binding.
- ✅ **Tidak ada XSS yang dapat dieksploitasi** — React escaping default, tanpa `dangerouslySetInnerHTML`/`eval`; Blade PDF memakai `{{ }}`.
- ✅ **Tidak ada IDOR** pada booking/payment — ownership di-scope lewat `$request->user()->bookings()`.
- ✅ **Password hashing kuat** — bcrypt cost 12 dengan cast `hashed`.
- ✅ **Pesan login generik** — tidak membocorkan keberadaan akun pada endpoint login.
- ✅ **`password` & `remember_token` tersembunyi** dari serialisasi JSON via `#[Hidden]`.
- ✅ **Tidak ada secret ter-commit** — `.env` tidak berada di repository.
