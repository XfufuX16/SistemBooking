# SECURITY AUDIT — SistemBooking

**Jenis:** Defensive code security review (white-box, static source analysis)
**Scope:** Seluruh source code repository — `Back-End/` (Laravel 13.20.0), `Front-End/` (React 19.2 / Vite 8)
**Branch:** `claude/web-security-audit-q9t5p9`
**Tanggal:** 15 Agustus 2026
**Otorisasi:** Diminta oleh pemilik/pengelola sah project. Tidak ada pengujian aktif terhadap sistem pihak ketiga; seluruh temuan diturunkan dari analisis source code, ditambah `composer audit` / `npm audit` terhadap lockfile.

---

## 1. EXECUTIVE SUMMARY

Aplikasi ini **bersih dari kelas kerentanan injeksi klasik**. Penelusuran sink secara sistematis mengonfirmasi tidak adanya command injection, path traversal, SSRF, file upload, deserialisasi tidak aman, open redirect, maupun SQL Injection — seluruh query memakai Eloquent parameter binding, dan satu-satunya `selectRaw` tidak memuat input pengguna sama sekali. CSRF juga tidak berlaku pada arsitektur ini karena autentikasi memakai header `Authorization: Bearer`, bukan cookie, dan mode stateful Sanctum tidak diaktifkan.

**Risiko sesungguhnya terletak pada logika bisnis dan konfigurasi produksi.** Dua temuan Critical berdiri sendiri dan dapat dieksploitasi oleh siapa pun yang mendaftar akun: endpoint pembayaran menandai transaksi `success` tanpa pernah menghubungi payment gateway, dan harga booking diterima mentah dari browser tanpa dihitung ulang di server. Keduanya menghasilkan kerugian finansial langsung tanpa memerlukan keahlian teknis.

Lapisan kedua adalah jalur pengambilalihan akun admin: seeder menanam kredensial `admin@admin.com` / `password`, sementara **tidak ada rate limiting sama sekali** pada API karena Laravel 11+ tidak lagi memasang middleware `throttle` secara default dan `bootstrap/app.php` tidak menambahkannya. Ditambah `APP_DEBUG=true` yang menjadi nilai default `.env.example` dan disalin otomatis oleh `composer setup`, terdapat jalur kredibel menuju kebocoran `APP_KEY` dan eskalasi ke RCE.

### Jumlah Temuan per Severity

| Severity | Jumlah | Ringkasan |
|---|---|---|
| 🔴 **Critical** | **2** | Payment bypass; price manipulation — keduanya berdampak finansial langsung |
| 🟠 **High** | **3** | Tanpa rate limiting; kredensial admin hardcoded; debug mode di default config |
| 🟡 **Medium** | **9** | Token tanpa expiry, CORS `*`, race condition, aturan bisnis tidak ditegakkan, mass assignment, type confusion, cascade delete destruktif, transport security, dependensi rentan |
| 🔵 **Low** | **7** | Validasi registrasi, paginasi, portabilitas SQL, kebocoran resource nonaktif, audit log, verifikasi email, gating frontend |
| ⚪ **Informational** | **3** | Fingerprinting framework, health endpoint publik, sink laten pada field `image` |
| | **24** | |

### Pemetaan OWASP Top 10 (2021)

`A01 Broken Access Control` (4) · `A02 Cryptographic Failures` (2) · `A04 Insecure Design` (6) · `A05 Security Misconfiguration` (7) · `A06 Vulnerable & Outdated Components` (1) · `A07 Identification & Authentication Failures` (3) · `A09 Logging & Monitoring Failures` (1)

---

## 2. TOP 5 SECURITY RISKS

| # | Risiko | Severity | Mengapa diprioritaskan |
|---|---|---|---|
| **1** | **Payment bypass** — `PaymentController::pay()` menandai `success` tanpa gateway | 🔴 Critical | Eksploitasi satu request oleh user terdaftar mana pun. Setiap booking menjadi gratis dan langsung `confirmed`. Kerugian finansial 100% dari GMV. |
| **2** | **Price manipulation** — `total_price` dipercaya dari client | 🔴 Critical | Tidak memerlukan tool khusus. Merusak integritas data keuangan secara permanen, termasuk laporan pendapatan yang dipakai pengambilan keputusan. |
| **3** | **Admin takeover chain** — kredensial seeder lemah + nol rate limiting | 🟠 High | `admin@admin.com:password` ada di wordlist teratas; tanpa throttle, tebakan pertama berhasil. Membuka seluruh `/api/admin/*`, ekspor data pelanggan, dan penghapusan riwayat transaksi. |
| **4** | **Debug mode sebagai default terdistribusi** — `APP_DEBUG=true` di `.env.example`, disalin `composer setup` | 🟠 High | Halaman Ignition membocorkan `APP_KEY` + kredensial DB. Kebocoran `APP_KEY` adalah titik awal rantai eksploitasi menuju RCE yang terdokumentasi luas pada Laravel. |
| **5** | **Token tanpa masa berlaku, ability penuh, di `localStorage`** | 🟡 Medium | Bukan titik masuk awal, melainkan **pengganda dampak**: setiap kompromi pada risiko 1–4 menjadi akses permanen yang tidak dapat dicabut secara massal. |

---

## 3. REMEDIATION PRIORITY

### 🚨 FIX IMMEDIATELY — sebelum deployment publik berikutnya
> Selama lima butir ini terbuka, sistem dapat kehilangan seluruh pendapatan dan akun admin dalam satu sesi serangan.

| ID | Tindakan | Estimasi |
|---|---|---|
| VULN-01 | Ubah `pay()` menjadi status `pending`; integrasikan gateway; verifikasi signature + nominal + idempotensi pada `callback()` | 1–2 hari |
| VULN-02 | Hapus `total_price` dari input API; hitung server-side dengan `bcmath` | 2 jam |
| VULN-03 | Aktifkan `$middleware->throttleApi()`; `throttle:5,1` pada `/login` & `/register` | 30 menit |
| VULN-04 | Hapus kredensial hardcoded dari seeder; rotasikan password admin pada semua instalasi | 1 jam |
| VULN-05 | `APP_DEBUG=false`, `APP_ENV=production` di `.env.example`; tambahkan guard runtime | 30 menit |

### ⏱️ FIX SOON — sprint berikutnya
`VULN-06` token expiry & storage · `VULN-07` CORS whitelist · `VULN-08` transaksi + lock booking · `VULN-09` penegakan aturan bisnis server-side · `VULN-10` mass assignment `role` · `VULN-11` validasi query param + escape `LIKE` · `VULN-12` soft delete + putus cascade · `VULN-13` HTTPS + security headers · `VULN-14` upgrade dependensi rentan

### 🛡️ HARDENING — backlog terencana
`VULN-15` s.d. `VULN-21` (validasi registrasi, paginasi, portabilitas SQL, filter `is_active`, audit log, verifikasi email, gating frontend) · `INFO-01` s.d. `INFO-03` (fingerprinting, health endpoint, sink laten `image`)

### 🔁 Kontrol proses berkelanjutan
- CI menjalankan `composer audit` + `npm audit` sebagai gate rilis.
- Refactor validasi inline → **Form Request**, otorisasi → **Policy**. Ini menutup VULN-02, VULN-09, dan VULN-11 secara struktural, bukan tambal per-endpoint.
- Test regresi keamanan (lihat "Cara verifikasi patch" pada tiap temuan) dijalankan di CI.

---

## 4. VERIFIED CLEAN — kategori yang diperiksa dan tidak ditemukan kerentanan

Bagian ini sama pentingnya dengan daftar temuan: ia menandai batas yang sudah diperiksa, sehingga effort remediasi tidak terbuang.

| Kategori | Hasil | Bukti / metode |
|---|---|---|
| **SQL Injection** | ✅ Tidak ditemukan | Seluruh query via Eloquent (parameter binding). Sink audit `DB::raw\|whereRaw\|orderByRaw\|havingRaw\|DB::statement\|DB::select` → hanya 1 hit: `ReportController.php:18` `selectRaw('MONTH(created_at) ...')` yang **tidak memuat input pengguna** (string literal). |
| **Command Injection** | ✅ Tidak ditemukan | Sink audit `exec\|shell_exec\|system\|passthru\|proc_open\|popen\|backtick` di `app/`, `routes/`, `config/`, `database/` → 0 hit (satu-satunya match adalah teks komentar di `config/filesystems.php:71`). |
| **Path Traversal / LFI** | ✅ Tidak ditemukan | Sink audit `file_get_contents\|file_put_contents\|fopen\|unlink\|Storage::\|->store()\|readfile\|include\|require` di `app/` & `routes/` → 0 hit. Aplikasi tidak menyentuh filesystem. |
| **Insecure File Upload** | ✅ Tidak ada permukaan | Sink audit `UploadedFile\|hasFile\|->file()\|mimes:\|multipart` → 0 hit. Tidak ada endpoint upload. Field `facilities.image` hanya `nullable\|string` (lihat INFO-03). |
| **SSRF** | ✅ Tidak ditemukan | Sink audit `Http::\|curl_\|GuzzleHttp\|fsockopen` di `app/` → 0 hit. Guzzle hanya dependensi transitif yang tidak dipanggil. DomPDF tidak diberi input HTML yang tidak ter-escape (lihat VULN-14). |
| **CSRF** | ✅ Tidak berlaku | API memakai `Authorization: Bearer` (`axiosClient.js:12-18`), bukan cookie — browser tidak melampirkannya lintas situs. `bootstrap/app.php` **tidak** memanggil `statefulApi()`, jadi mode cookie Sanctum nonaktif. `routes/web.php` hanya berisi satu route `GET /`. |
| **JWT Vulnerabilities** | ✅ Tidak berlaku | Tidak memakai JWT. Sanctum menerbitkan token acak buram yang disimpan ter-hash SHA-256. Tidak ada permukaan `alg=none`, weak secret, atau confusion attack. |
| **Open Redirect** | ✅ Tidak ditemukan | Satu-satunya redirect adalah `window.location.href = '/login'` (`axiosClient.js:27`) — path literal, bukan dari input. Tidak ada `redirect()->away()` di backend. |
| **Insecure Deserialization** | ✅ Tidak ditemukan | Sink audit `unserialize\|eval\|create_function\|extract\|call_user_func` → 0 hit. `config/session.php:231` memakai `'serialization' => 'json'`, bukan `'php'` — tidak ada permukaan gadget chain. |
| **Stored / Reflected / DOM XSS** | ✅ Tidak ditemukan | Tidak ada `dangerouslySetInnerHTML`, `innerHTML`, atau `eval` di `Front-End/src/`. React meng-escape by default. Blade PDF memakai `{{ }}` (auto-escape), bukan `{!! !!}`. |
| **IDOR / Broken Object-Level Auth** | ✅ Tidak ditemukan | Ownership di-scope pada query: `$request->user()->bookings()->findOrFail($id)` (`BookingController.php:52`, `PaymentController.php:14`). User lain mendapat 404, bukan data. |
| **Insecure Password Handling** | ✅ Aman | bcrypt cost 12 (`.env.example:16`), cast `'password' => 'hashed'` (`User.php:30`), `Hash::check` untuk verifikasi. Tidak ada MD5/SHA1/plaintext. `#[Hidden(['password','remember_token'])]` mencegah kebocoran via serialisasi JSON. |
| **Exposed Secrets / API Keys** | ✅ Tidak ditemukan | Tidak ada secret hardcoded di source. `.gitignore:3-5` memblokir `.env`, `.env.backup`, `.env.production`. Riwayat git diperiksa (`git log --all --diff-filter=A`) — **hanya `.env.example` yang pernah di-commit**, tidak pernah ada `.env` asli. Pengecualian: kredensial seeder (VULN-04). |
| **User Enumeration (login)** | ✅ Aman pada `/login` | `AuthController.php:47-51` mengembalikan pesan seragam "Kredensial tidak valid" baik untuk email tidak ada maupun password salah. (Catatan: `/register` tetap membocorkan lewat `unique:users` — lihat VULN-03.) |

---

## 5. TEMUAN DETAIL

Format tiap temuan: nama · severity · lokasi · penyebab · bukti source code · skenario eksploitasi · dampak · rekomendasi · patch aman · cara verifikasi patch.

---

### 🔴 VULN-01 — Payment Bypass: Transaksi Ditandai `success` Tanpa Verifikasi Gateway

| | |
|---|---|
| **Severity** | 🔴 **CRITICAL** |
| **OWASP / CWE** | A04 Insecure Design · CWE-840 (Business Logic Errors), CWE-345 (Insufficient Verification of Data Authenticity) |
| **Lokasi** | `Back-End/app/Http/Controllers/Api/PaymentController.php:12-33` (`pay`), `:35-38` (`callback`), `Back-End/routes/api.php:17`, `:29` |
| **Status** | **Confirmed** — dapat dipastikan dari source, tanpa perlu pengujian aktif |

**Penyebab.**
Endpoint pembayaran mengimplementasikan simulasi, bukan integrasi. Ia menuliskan `status => 'success'` sebagai nilai literal dan langsung mempromosikan booking menjadi `paid` + `confirmed` dalam request yang sama, tanpa pernah menghubungi payment gateway, tanpa state `pending`, dan tanpa bukti pembayaran apa pun. Komentar di source mengakui hal ini secara eksplisit.

**Bukti dari source code.**
```php
// PaymentController.php:20-30
$payment = Payment::create([
    'booking_id'     => $booking->id,
    'payment_method' => $request->payment_method ?? 'transfer',
    'amount'         => $booking->total_price,
    'transaction_id' => uniqid('TRX-'),
    'status'         => 'success',        // ← auto success for now
    'paid_at'        => now(),
]);

$booking->update(['payment_status' => 'paid', 'status' => 'confirmed']);
```
```php
// PaymentController.php:35-38 — webhook publik, tanpa autentikasi & tanpa verifikasi signature
public function callback(Request $request)
{
    return response()->json(['message' => 'Callback received']);
}
```
```php
// routes/api.php:17 — berada DI LUAR grup auth:sanctum
Route::post('/payments/callback', [PaymentController::class, 'callback']);
```

**Skenario eksploitasi.**
1. Penyerang mendaftar akun biasa via `POST /api/register` (registrasi terbuka, tanpa verifikasi email — VULN-20).
2. Membuat booking normal via `POST /api/bookings`.
3. Memanggil satu request:
   ```bash
   curl -X POST https://target/api/bookings/123/pay \
        -H "Authorization: Bearer <token_user_biasa>"
   # → {"status":"success","paid_at":"2026-08-15T...","amount":"2100000.00"}
   ```
4. Booking berstatus `confirmed` dan `payment_status = paid`. Tidak ada uang yang berpindah. Penyerang datang ke lokasi dengan konfirmasi yang sah menurut sistem.

Vektor kedua bersifat **laten namun berbahaya**: `/api/payments/callback` terbuka untuk publik tanpa autentikasi maupun verifikasi signature. Saat ini inert, tetapi begitu diisi logika "tandai lunas berdasarkan body request" — langkah yang pasti terjadi saat gateway diintegrasikan — siapa pun di internet dapat melunasi booking mana pun dengan satu POST. Ini adalah penyebab kebocoran finansial paling umum pada integrasi Midtrans/Xendit.

Catatan tambahan: `transaction_id` memakai `uniqid('TRX-')` yang berbasis timestamp mikrodetik — **dapat diprediksi**, bukan entropi kriptografis, sehingga tidak layak menjadi referensi transaksi yang mengikat.

**Dampak.**
- Kerugian pendapatan 100% — setiap booking dapat "dibayar" gratis oleh user mana pun.
- Integritas data keuangan hancur: `payments` berisi record `success` yang tidak berkorespondensi dengan uang masuk.
- Rekonsiliasi dengan mutasi bank menjadi mustahil.
- Ketika gateway asli diintegrasikan di atas fondasi ini, webhook tanpa signature akan memperluas eksploitasi ke penyerang tanpa autentikasi (unauthenticated).

**Rekomendasi perbaikan.**
1. Pembayaran harus **pending-first**. Hanya webhook terverifikasi yang boleh mempromosikan status menjadi lunas.
2. Verifikasi signature webhook dengan perbandingan *timing-safe* (`hash_equals`), jangan `==`.
3. Cocokkan nominal callback terhadap nilai server, bukan menerima nominal dari payload.
4. Buat callback **idempoten** dengan row lock agar pengiriman ganda tidak diproses dua kali.
5. Ganti `uniqid()` dengan `Str::uuid()`.

**Contoh patch aman.**
```php
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

public function pay(Request $request, $id)
{
    $booking = $request->user()->bookings()->findOrFail($id);

    abort_if($booking->payment_status === 'paid', 422, 'Booking ini sudah dibayar.');
    abort_if($booking->status === 'cancelled', 422, 'Booking sudah dibatalkan.');

    $validated = $request->validate([
        'payment_method' => ['required', 'in:transfer,va_bca,gopay,qris'],
    ]);

    $payment = Payment::create([
        'booking_id'     => $booking->id,
        'payment_method' => $validated['payment_method'],
        'amount'         => $booking->total_price,   // nominal dari server
        'transaction_id' => 'TRX-'.Str::uuid(),      // entropi kriptografis
        'status'         => 'pending',               // TIDAK auto-success
    ]);

    // Panggil gateway di sini, kembalikan snap-token / redirect URL
    return response()->json($payment, 201);
}

public function callback(Request $request)
{
    // 1. Verifikasi signature — WAJIB, timing-safe
    $expected = hash('sha512',
        $request->input('order_id')
        .$request->input('status_code')
        .$request->input('gross_amount')
        .config('services.midtrans.server_key')
    );

    abort_unless(hash_equals($expected, (string) $request->input('signature_key')), 403);

    // 2. Idempoten + row lock
    return DB::transaction(function () use ($request) {
        $payment = Payment::where('transaction_id', $request->input('order_id'))
            ->lockForUpdate()
            ->firstOrFail();

        if ($payment->status === 'success') {
            return response()->json(['message' => 'already processed']);
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

**Cara verifikasi patch.**
```php
// tests/Feature/PaymentSecurityTest.php
public function test_pay_tidak_langsung_melunasi_booking(): void
{
    $user = User::factory()->create();
    $booking = Booking::factory()->for($user)->create(['payment_status' => 'unpaid']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/bookings/{$booking->id}/pay", ['payment_method' => 'qris'])
        ->assertCreated()
        ->assertJsonPath('status', 'pending');       // BUKAN 'success'

    $this->assertSame('unpaid', $booking->fresh()->payment_status);
}

public function test_callback_menolak_signature_palsu(): void
{
    $this->postJson('/api/payments/callback', [
        'order_id' => 'TRX-abc', 'status_code' => '200',
        'gross_amount' => '150000.00', 'signature_key' => 'palsu',
    ])->assertForbidden();
}

public function test_callback_idempoten(): void
{
    // Kirim callback valid dua kali → payment tetap satu, booking tidak dobel-confirm
}
```
Verifikasi manual di sandbox lokal:
```bash
# Harus 403 — signature palsu ditolak
curl -i -X POST http://localhost:8000/api/payments/callback \
     -H 'Content-Type: application/json' \
     -d '{"order_id":"TRX-x","signature_key":"palsu","gross_amount":"1"}'

# Harus tetap 'unpaid' setelah pay()
php artisan tinker --execute="echo App\Models\Booking::find(1)->payment_status;"
```

---

### 🔴 VULN-02 — Price Manipulation: `total_price` Dikendalikan Client

| | |
|---|---|
| **Severity** | 🔴 **CRITICAL** |
| **OWASP / CWE** | A04 Insecure Design · A01 Broken Access Control · CWE-472 (External Control of Assumed-Immutable Web Parameter) |
| **Lokasi** | `Back-End/app/Http/Controllers/Api/BookingController.php:32` & `:45`; `Back-End/app/Models/Booking.php:18`; `Front-End/src/pages/FacilityDetail.jsx:53,67` |
| **Status** | **Confirmed** |

**Penyebab.**
Harga dihitung sepenuhnya di browser lalu dikirim sebagai bagian dari payload. Server memvalidasi bahwa nilainya `numeric` — tetapi **tidak pernah memverifikasi bahwa nilainya benar**. Pada seluruh alur `store()`, server tidak sekali pun membaca `facilities.price_per_hour`.

**Bukti dari source code.**
```jsx
// Front-End/src/pages/FacilityDetail.jsx:51-68 — harga dihitung di client
const diffMs = selectedSlot.endObj.getTime() - selectedSlot.startObj.getTime();
const hours = diffMs / (1000 * 60 * 60);
const total_price = hours * facility.price_per_hour;

const payload = { facility_id, booking_date, start_time, end_time, total_price };
await axiosClient.post('/bookings', payload);
```
```php
// Back-End/app/Http/Controllers/Api/BookingController.php:27-45
$validated = $request->validate([
    'facility_id'  => 'required|exists:facilities,id',
    // ...
    'total_price'  => 'required|numeric',     // ← hanya cek tipe, bukan kebenaran nilai
]);

$booking = $request->user()->bookings()->create($validated);   // ← disimpan apa adanya
```
```php
// Back-End/app/Models/Booking.php:12-22 — total_price mass-assignable
protected $fillable = [ 'user_id', 'facility_id', /* ... */ 'total_price', /* ... */ ];
```

**Skenario eksploitasi.**
```bash
curl -X POST https://target/api/bookings \
  -H "Authorization: Bearer <token_user_biasa>" \
  -H "Content-Type: application/json" \
  -d '{"facility_id":1,"booking_date":"2026-08-20",
       "start_time":"08:00","end_time":"22:00","total_price":0}'
```
14 jam sewa Lapangan Futsal A (seharusnya Rp 2.100.000 pada `price_per_hour = 150000`) tercatat Rp 0.

Aturan `numeric` juga menerima **bilangan negatif** dan notasi ilmiah. `total_price: -5000000` lolos validasi dan merusak agregat `SUM(total_price)` pada `ReportController::summary()` (`ReportController.php:15,18`), membuat total pendapatan menjadi negatif dan laporan tidak dapat dipercaya.

Digabung dengan **VULN-01**, booking Rp 0 tersebut langsung menjadi `paid` + `confirmed`.

**Dampak.**
- Kerugian finansial langsung dan tidak terbatas.
- Korupsi permanen pada data historis — booking lama tidak dapat direkonstruksi harganya setelah fakta.
- Laporan pendapatan (`/api/admin/reports/summary` dan ekspor PDF) menjadi menyesatkan untuk pengambilan keputusan bisnis.

**Rekomendasi perbaikan.**
Perlakukan harga sebagai **server-authoritative value**. Hapus dari input API sepenuhnya; hitung dari sumber kebenaran (`facilities.price_per_hour`) memakai `bcmath` agar tidak ada floating-point drift pada nilai uang. Keluarkan `total_price` dari `$fillable` dan aktifkan `preventSilentlyDiscardingAttributes()` agar payload yang menyertakannya **ditolak**, bukan diabaikan diam-diam.

**Contoh patch aman.**
```php
// BookingController::store — 'total_price' DIHAPUS dari daftar validasi
public function store(StoreBookingRequest $request)
{
    $validated = $request->validated();

    $facility = Facility::where('is_active', true)
        ->findOrFail($validated['facility_id']);

    $booking = $this->bookingService->book($request->user(), $facility, $validated);

    return response()->json($booking, 201);
}
```
```php
// app/Services/BookingService.php
public function calculateTotalPrice(Facility $facility, string $start, string $end): string
{
    $hours = Carbon::createFromFormat('H:i', $start)
        ->diffInMinutes(Carbon::createFromFormat('H:i', $end)) / 60;

    return bcmul((string) $facility->price_per_hour, (string) $hours, 2);
}
```
```php
// app/Models/Booking.php — total_price keluar dari fillable
protected $fillable = [
    'facility_id', 'booking_date', 'start_time', 'end_time', 'notes',
];
```
Frontend tetap boleh menghitung harga untuk **preview**, tetapi nilai server yang mengikat.

**Cara verifikasi patch.**
```php
public function test_total_price_dari_client_diabaikan(): void
{
    $facility = Facility::factory()->create(['price_per_hour' => 150000]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->postJson('/api/bookings', [
            'facility_id' => $facility->id,
            'booking_date' => now()->addDay()->toDateString(),
            'start_time' => '08:00', 'end_time' => '10:00',
            'total_price' => 0,                       // ← upaya manipulasi
        ])
        ->assertCreated()
        ->assertJsonPath('total_price', '300000.00'); // 2 jam × 150.000
}

public function test_harga_negatif_ditolak(): void
{
    // dengan preventSilentlyDiscardingAttributes aktif → 422/500, bukan tersimpan
}
```
Verifikasi manual:
```bash
# Kirim total_price:0 — respons HARUS berisi harga terhitung server, bukan 0
curl -sX POST http://localhost:8000/api/bookings -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"facility_id":1,"booking_date":"2026-08-20","start_time":"08:00",
       "end_time":"10:00","total_price":0}' | jq .total_price
```

---

### 🟠 VULN-03 — Tidak Ada Rate Limiting pada Seluruh API

| | |
|---|---|
| **Severity** | 🟠 **HIGH** |
| **OWASP / CWE** | A07 Identification & Authentication Failures · CWE-307 (Improper Restriction of Excessive Authentication Attempts), CWE-770 |
| **Lokasi** | `Back-End/bootstrap/app.php:15-19`; `Back-End/routes/api.php:11-12` |
| **Status** | **Confirmed** |

**Penyebab.**
Sejak Laravel 11, middleware `throttle:api` **tidak lagi dipasang otomatis** pada grup `api` — aplikasi harus mengaktifkannya secara eksplisit lewat `throttleApi()`. Blok `withMiddleware()` pada project ini hanya mendaftarkan alias `role` dan tidak memanggilnya, sehingga tidak ada satu pun endpoint yang memiliki batas laju.

**Bukti dari source code.**
```php
// bootstrap/app.php:15-19 — tidak ada throttleApi()
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'role' => \App\Http\Middleware\RoleMiddleware::class,
    ]);
})
```
```php
// routes/api.php:11-12 — endpoint auth tanpa middleware throttle
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login',    [AuthController::class, 'login']);
```

**Skenario eksploitasi.**
1. **Credential stuffing / brute force** pada `POST /api/login` tanpa batas. Dengan bcrypt cost 12 (±250 ms per percobaan), 50 koneksi paralel tetap menghasilkan ±200 tebakan/detik. Digabung dengan **VULN-04** (password admin adalah `password`), akun admin jatuh pada percobaan pertama dari wordlist mana pun.
2. **User enumeration via `/register`.** Endpoint login sudah benar memakai pesan seragam, namun `register` mengembalikan error validasi `unique:users` yang membedakan email terdaftar dan tidak. Tanpa throttle, seluruh basis pengguna dapat dienumerasi secara otomatis.
3. **DoS aplikatif.** Setiap login memicu bcrypt cost 12 yang mahal secara CPU; flood terhadap `/login` melumpuhkan server tanpa memerlukan volume traffic besar.
4. **Spam registrasi** tak terbatas (tidak ada verifikasi email — VULN-20).

**Dampak.**
Pengambilalihan akun (termasuk admin), kebocoran daftar pengguna terdaftar, dan penghentian layanan dengan biaya penyerang yang sangat rendah. Ini juga menghilangkan pengaman waktu yang biasanya membatasi eksploitasi temuan lain.

**Rekomendasi perbaikan.**
Pasang baseline throttle untuk seluruh API, lalu limiter yang jauh lebih ketat dan berbasis dua dimensi (akun + IP) pada endpoint autentikasi.

**Contoh patch aman.**
```php
// bootstrap/app.php
->withMiddleware(function (Middleware $middleware) {
    $middleware->throttleApi();          // baseline 60 req/menit
    $middleware->alias([
        'role' => \App\Http\Middleware\RoleMiddleware::class,
    ]);
})
```
```php
// routes/api.php
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/login',    [AuthController::class, 'login'])->middleware('throttle:login');
```
```php
// app/Providers/AppServiceProvider.php — boot()
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for('login', fn (Request $request) => [
    Limit::perMinute(5)->by($request->input('email').'|'.$request->ip()),  // per akun
    Limit::perMinute(20)->by($request->ip()),                              // per sumber
]);
```
Seragamkan juga respons `/register` agar tidak membocorkan keberadaan email (kirim pesan sukses generik dan tangani duplikasi lewat email notifikasi).

**Cara verifikasi patch.**
```php
public function test_login_dibatasi_setelah_lima_percobaan(): void
{
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/login', ['email' => 'a@b.c', 'password' => 'salah'])
             ->assertStatus(422);
    }

    $this->postJson('/api/login', ['email' => 'a@b.c', 'password' => 'salah'])
         ->assertStatus(429);            // Too Many Requests
}
```
Verifikasi manual:
```bash
# Percobaan ke-6 HARUS 429
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@admin.com","password":"salah"}'
done

# Pastikan header rate limit hadir
curl -sI http://localhost:8000/api/facilities | grep -i ratelimit
```

---

### 🟠 VULN-04 — Kredensial Admin Hardcoded & Lemah pada Seeder

| | |
|---|---|
| **Severity** | 🟠 **HIGH** — *naik ke Critical bila terkonfirmasi seeder pernah dijalankan di produksi* |
| **OWASP / CWE** | A07 Auth Failures · A05 Security Misconfiguration · CWE-798 (Use of Hard-coded Credentials), CWE-1392 (Default Credentials) |
| **Lokasi** | `Back-End/database/seeders/DatabaseSeeder.php:19-25` (admin), `:27-34` (user) |
| **Status** | **Confirmed di source** · **Needs Verification** untuk status deployment (lihat di bawah) |

**Penyebab.**
Kredensial administratif ditulis sebagai literal di source code yang berada di repository. Tidak ada guard environment yang mencegah seeder berjalan di produksi.

**Bukti dari source code.**
```php
// database/seeders/DatabaseSeeder.php:19-25
User::create([
    'name'     => 'Admin User',
    'email'    => 'admin@admin.com',
    'password' => bcrypt('password'),     // ← password wordlist teratas
    'role'     => 'admin',
    'phone'    => '081234567890',
]);
```

**Skenario eksploitasi.**
1. Penyerang membaca repository (atau sekadar menebak — kombinasi ini ada di `rockyou.txt` dan SecLists).
2. `POST /api/login` dengan `admin@admin.com` / `password`. Tanpa rate limiting (**VULN-03**), tidak ada yang menghambat.
3. Memperoleh token admin dengan ability `['*']` yang **tidak pernah kedaluwarsa** (**VULN-06**).
4. Akses penuh ke `/api/admin/*`:
   - `GET /api/admin/reports/export` → PDF berisi nama seluruh pelanggan dan riwayat transaksi (kebocoran data pribadi).
   - `PUT /api/admin/facilities/{id}` → mengubah harga seluruh fasilitas.
   - `DELETE /api/admin/facilities/{id}` → menghapus permanen fasilitas **beserta seluruh booking dan pembayarannya** lewat cascade (**VULN-12**).

**Dampak.**
Kompromi total tingkat aplikasi: kebocoran data pribadi pelanggan, manipulasi harga, dan penghancuran riwayat keuangan yang tidak dapat dipulihkan. Karena tidak ada audit log (**VULN-19**), tidak akan ada jejak forensik.

**Needs Verification — cara memverifikasi dengan aman.**
Perlu dipastikan apakah seeder pernah dijalankan pada environment produksi/staging. Jalankan **hanya pada database yang Anda miliki**, read-only:
```bash
php artisan tinker --execute="
  \$u = App\Models\User::where('email','admin@admin.com')->first();
  echo \$u ? 'ADA — dibuat: '.\$u->created_at : 'TIDAK ADA';
"
```
```sql
-- read-only, aman dijalankan di replica
SELECT id, email, role, created_at FROM users WHERE role = 'admin';
```
Jika akun tersebut ada di produksi, perlakukan sebagai **Critical** dan asumsikan kemungkinan sudah dikompromikan: rotasi password, cabut seluruh token (`DELETE FROM personal_access_tokens`), dan tinjau `bookings`/`payments` untuk perubahan mencurigakan.

**Rekomendasi perbaikan.**
Seeder demo harus menolak berjalan di produksi; password tidak boleh pernah menjadi literal di source; pembuatan admin produksi lewat perintah artisan interaktif.

**Contoh patch aman.**
```php
// database/seeders/DatabaseSeeder.php
public function run(): void
{
    if (app()->isProduction()) {
        $this->command->warn('Seeder demo dilewati pada environment produksi.');
        return;
    }

    User::updateOrCreate(
        ['email' => env('SEED_ADMIN_EMAIL', 'admin@example.test')],
        [
            'name'     => 'Admin User',
            'password' => env('SEED_ADMIN_PASSWORD') ?: Str::password(24),
            'role'     => 'admin',
        ]
    );
}
```
```php
// app/Console/Commands/MakeAdmin.php — jalur pembuatan admin untuk produksi
public function handle(): int
{
    $email    = $this->ask('Email admin');
    $password = $this->secret('Password (min. 16 karakter)');

    validator(['password' => $password], [
        'password' => ['required', Password::min(16)->mixedCase()->numbers()->uncompromised()],
    ])->validate();

    User::create(['name' => $this->ask('Nama'), 'email' => $email,
                  'password' => $password, 'role' => 'admin']);

    return self::SUCCESS;
}
```

**Cara verifikasi patch.**
```php
public function test_seeder_tidak_berjalan_di_produksi(): void
{
    app()->detectEnvironment(fn () => 'production');

    $this->seed(DatabaseSeeder::class);

    $this->assertDatabaseMissing('users', ['email' => 'admin@admin.com']);
}
```
```bash
# Pastikan tidak ada lagi kredensial literal di source
grep -rn "bcrypt('password')\|'password' *=> *'password'" Back-End/database/ && echo "MASIH ADA" || echo "BERSIH"

# Pastikan akun default sudah tidak dapat login di sandbox
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@admin.com","password":"password"}'   # harapkan 422
```

---

### 🟠 VULN-05 — Debug Mode & Environment `local` sebagai Default Terdistribusi

| | |
|---|---|
| **Severity** | 🟠 **HIGH** — *naik ke Critical bila terkonfirmasi aktif di produksi* |
| **OWASP / CWE** | A05 Security Misconfiguration · CWE-489 (Active Debug Code), CWE-215 (Insertion of Sensitive Information into Debugging Code) |
| **Lokasi** | `Back-End/.env.example:2,4,21`; `Back-End/composer.json:37-44` |
| **Status** | **Confirmed di source** · **Needs Verification** untuk status produksi |

**Penyebab.**
Template environment yang dikirim bersama repository mengaktifkan debug secara default, dan script `composer setup` menyalinnya menjadi `.env` secara otomatis. Deployment yang mengikuti dokumentasi akan berjalan dengan `APP_DEBUG=true`. Default framework sendiri sudah aman (`config/app.php:42` memakai `env('APP_DEBUG', false)`) — yang berbahaya adalah nilai `.env` yang menimpanya.

**Bukti dari source code.**
```dotenv
# .env.example:2,4,21
APP_ENV=local
APP_DEBUG=true
LOG_LEVEL=debug
```
```json
// composer.json:37-44 — setup menyalin .env.example → .env lalu langsung migrate
"setup": [
    "composer install",
    "@php -r \"file_exists('.env') || copy('.env.example', '.env');\"",
    "@php artisan key:generate",
    "@php artisan migrate --force",
    ...
]
```

**Skenario eksploitasi.**
1. Penyerang memicu exception apa pun. Titik termudah adalah **VULN-11**: `GET /api/facilities?type[]=a&type[]=b` membuat `$request->type` menjadi array sementara `where()` mengharapkan skalar → `TypeError` tak tertangani.
2. Dengan `APP_DEBUG=true`, respons berisi halaman Ignition: stack trace lengkap, path absolut server, versi framework, potongan source code, **dan seluruh variabel environment**.
3. Variabel tersebut mencakup `APP_KEY` dan kredensial database.
4. Kebocoran `APP_KEY` memungkinkan pemalsuan cookie/payload terenkripsi. Pada rantai eksploitasi Laravel yang terdokumentasi luas (kelas CVE-2018-15133 dan turunannya), ini adalah titik awal menuju **Remote Code Execution**.

`LOG_LEVEL=debug` juga berpotensi mencatat payload request sensitif ke `storage/logs/laravel.log`.

**Dampak.**
Kebocoran seluruh rahasia aplikasi dalam satu respons HTTP, dengan jalur kredibel menuju eksekusi kode jarak jauh. Ini adalah misconfiguration yang paling sering dieksploitasi pada aplikasi Laravel yang terekspos publik.

**Needs Verification — cara memverifikasi dengan aman.**
Pada domain produksi Anda sendiri, picu 404 biasa dan periksa bentuk respons — **jangan** memakai payload yang memicu exception di produksi:
```bash
curl -s https://domain-anda.com/api/facilities/999999999 | head -c 400
```
Respons aman berupa JSON ringkas (`{"message":"No query results..."}`). Bila muncul HTML Ignition, stack trace, atau nama file server → **Critical, perbaiki segera dan rotasi `APP_KEY` serta seluruh kredensial DB.**

**Rekomendasi perbaikan.**
Nilai default template harus aman-untuk-produksi, ditambah guard runtime yang gagal secara keras agar kesalahan konfigurasi tidak lolos diam-diam.

**Contoh patch aman.**
```diff
# .env.example
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
+CORS_ALLOWED_ORIGINS=https://booking.example.com
```
```php
// app/Providers/AppServiceProvider.php — boot()
if ($this->app->isProduction() && config('app.debug')) {
    throw new \RuntimeException('APP_DEBUG harus false di lingkungan produksi.');
}

if ($this->app->isProduction()) {
    URL::forceScheme('https');
}
```

**Cara verifikasi patch.**
```php
public function test_debug_mati_di_produksi(): void
{
    config(['app.debug' => true]);
    app()->detectEnvironment(fn () => 'production');

    $this->expectException(\RuntimeException::class);
    (new AppServiceProvider(app()))->boot();
}

public function test_exception_tidak_membocorkan_env(): void
{
    config(['app.debug' => false]);

    $response = $this->getJson('/api/facilities/999999');

    $response->assertNotFound();
    $response->assertDontSee('APP_KEY');
    $response->assertDontSee(base_path());
}
```
```bash
# Konfigurasi produksi harus dapat di-cache tanpa error
php artisan config:cache && php artisan about | grep -i debug   # harapkan: Debug Mode  OFF
```

---

### 🟡 VULN-06 — Token Sanctum Tanpa Masa Berlaku, Ability Penuh, Disimpan di `localStorage`

| | |
|---|---|
| **Severity** | 🟡 **MEDIUM** |
| **OWASP / CWE** | A02 Cryptographic Failures · A07 Auth Failures · CWE-613 (Insufficient Session Expiration), CWE-522 |
| **Lokasi** | `Back-End/config/sanctum.php:53`; `Back-End/app/Http/Controllers/Api/AuthController.php:29,53,64`; `Front-End/src/store/authStore.js:4-16` |
| **Status** | **Confirmed** |

**Penyebab.** Tiga kelemahan yang saling memperkuat: token tidak pernah kedaluwarsa, diterbitkan dengan ability wildcard, dan dipersist ke storage yang dapat dibaca JavaScript.

**Bukti dari source code.**
```php
// config/sanctum.php:53
'expiration' => null,                        // token berlaku selamanya
```
```php
// AuthController.php:29,53 — tanpa argumen abilities → default ['*']
$token = $user->createToken('auth_token')->plainTextToken;

// AuthController.php:64 — logout hanya mencabut token yang sedang dipakai
$request->user()->currentAccessToken()->delete();
```
```js
// Front-End/src/store/authStore.js:4-16 — persist tanpa storage kustom → localStorage
const useAuthStore = create(
  persist((set) => ({ user: null, token: null, /* ... */ }), { name: 'auth-storage' })
);
```

**Skenario eksploitasi.** Token bersifat *bearer* murni: siapa pun yang memilikinya adalah pemiliknya. Karena tidak ada expiry, token yang bocor hari ini masih valid tahun depan. Audit ini **tidak menemukan XSS yang dapat dieksploitasi pada kode saat ini**, sehingga ini bukan titik masuk mandiri — melainkan **pengganda dampak**: satu paket npm ter-kompromi pada supply chain (11 dependensi langsung, ratusan transitif) sudah cukup untuk mengeksfiltrasi seluruh token secara permanen. Setiap login juga menerbitkan token baru tanpa mencabut yang lama, dan tidak ada mekanisme pencabutan massal.

**Dampak.** Akses permanen dan tidak dapat dicabut setelah kompromi apa pun. Tabel `personal_access_tokens` tumbuh tanpa batas. Tidak ada cara menanggapi insiden dengan "logout semua perangkat".

**Rekomendasi perbaikan.** Beri masa berlaku, batasi ability sesuai role, hentikan persist token ke `localStorage`, dan sediakan pencabutan massal. Opsi paling aman adalah beralih ke Sanctum SPA mode dengan cookie `HttpOnly` + `SameSite=strict` — jalurnya sudah tersedia karena `config/sanctum.php:21-26` telah mendaftarkan stateful domains.

**Contoh patch aman.**
```php
// config/sanctum.php
'expiration' => (int) env('SANCTUM_EXPIRATION', 60 * 8),   // 8 jam
```
```php
// AuthController::login
$abilities = $user->role === 'admin'
    ? ['admin:manage', 'booking:write']
    : ['booking:write'];

$token = $user->createToken(
    name: 'auth_token',
    abilities: $abilities,
    expiresAt: now()->addHours(8),
)->plainTextToken;

// Endpoint pencabutan massal
public function logoutAll(Request $request)
{
    $request->user()->tokens()->delete();
    return response()->json(['message' => 'Seluruh sesi diakhiri.']);
}
```
```js
// src/store/authStore.js — token tidak ikut dipersist
persist((set) => ({ /* ... */ }), {
  name: 'auth-storage',
  partialize: (state) => ({ user: state.user }),
})
```
Jadwalkan `php artisan sanctum:prune-expired --hours=24` pada scheduler.

**Cara verifikasi patch.**
```php
public function test_token_kedaluwarsa_ditolak(): void
{
    $user = User::factory()->create();
    $token = $user->createToken('t', ['booking:write'], now()->addHours(8))->plainTextToken;

    $this->travel(9)->hours();

    $this->withHeader('Authorization', "Bearer {$token}")
         ->getJson('/api/me')->assertUnauthorized();
}

public function test_token_user_tidak_punya_ability_admin(): void
{
    $user = User::factory()->create(['role' => 'user']);
    Sanctum::actingAs($user, ['booking:write']);

    $this->getJson('/api/admin/reports/summary')->assertForbidden();
}
```
```bash
# localStorage tidak boleh lagi memuat token
# DevTools → Application → Local Storage → auth-storage
# harapkan: {"state":{"user":{...}}}  tanpa key "token"
```

---

### 🟡 VULN-07 — CORS Mengizinkan Semua Origin

| | |
|---|---|
| **Severity** | 🟡 **MEDIUM** |
| **OWASP / CWE** | A05 Security Misconfiguration · CWE-942 (Permissive Cross-domain Policy) |
| **Lokasi** | `Back-End/config/` — file `cors.php` tidak ada, sehingga berlaku default framework |
| **Status** | **Confirmed** |

**Penyebab.** `config/cors.php` tidak pernah di-publish, sehingga `HandleCors` memakai default framework: `'allowed_origins' => ['*']` untuk path `api/*`.

**Bukti dari source code.**
```bash
$ ls Back-End/config/
app.php  auth.php  cache.php  database.php  filesystems.php  logging.php
mail.php  queue.php  sanctum.php  services.php  session.php
# → tidak ada cors.php; default vendor yang berlaku
```

**Skenario eksploitasi.** Perlu dinyatakan secara akurat: karena autentikasi memakai header `Authorization` (bukan cookie) dan `supports_credentials` default `false`, browser **tidak** melampirkan kredensial korban secara otomatis. **Ini bukan jalur pencurian data langsung** — itulah sebabnya severity ditahan di Medium, bukan High. Dampak nyatanya: seluruh endpoint publik dapat dipanggil dari situs mana pun sebagai proxy — scraping katalog, penggunaan browser korban sebagai relay brute force terdistribusi (memperparah **VULN-03**), dan halaman login palsu yang berfungsi penuh terhadap API asli. Risiko menjadi kritis bila project beralih ke Sanctum SPA mode (cookie) tanpa lebih dulu memperketat CORS.

**Dampak.** Perluasan permukaan serangan dan penyalahgunaan endpoint publik; menjadi Critical bila digabung `supports_credentials: true` di masa depan.

**Rekomendasi perbaikan.** Publish konfigurasi dan whitelist origin secara eksplisit lewat environment.

**Contoh patch aman.**
```php
// config/cors.php  (php artisan config:publish cors)
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    'allowed_origins' => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', ''))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Content-Type', 'Authorization', 'X-Requested-With'],
    'exposed_headers' => [],
    'max_age' => 3600,
    'supports_credentials' => false,
];
```
> **Aturan mutlak:** `allowed_origins: ['*']` dan `supports_credentials: true` tidak boleh digunakan bersamaan.

**Cara verifikasi patch.**
```bash
# Origin jahat → TIDAK boleh ada header Access-Control-Allow-Origin
curl -sI -H "Origin: https://evil.example" http://localhost:8000/api/facilities \
  | grep -i "access-control-allow-origin" && echo "MASIH TERBUKA" || echo "AMAN"

# Origin sah → harus muncul dan bernilai persis origin tersebut
curl -sI -H "Origin: https://booking.example.com" http://localhost:8000/api/facilities \
  | grep -i "access-control-allow-origin"
```

---

### 🟡 VULN-08 — Race Condition (TOCTOU) pada Pengecekan Ketersediaan Slot

| | |
|---|---|
| **Severity** | 🟡 **MEDIUM** |
| **OWASP / CWE** | A04 Insecure Design · CWE-367 (Time-of-check Time-of-use), CWE-362 |
| **Lokasi** | `Back-End/app/Http/Controllers/Api/BookingController.php:36-45`; `Back-End/app/Services/BookingService.php:11-24`; migrasi `create_bookings_table` |
| **Status** | **Confirmed** |

**Penyebab.** Pengecekan ketersediaan dan penulisan booking terjadi dalam dua operasi terpisah tanpa transaksi, tanpa row lock, dan tanpa unique constraint sebagai jaring pengaman terakhir.

**Bukti dari source code.**
```php
// BookingController.php:36-45 — ada jeda antara cek dan tulis
if (!$this->bookingService->isSlotAvailable(...)) {
    return response()->json(['message' => 'Jadwal bentrok atau tidak tersedia.'], 422);
}

$booking = $request->user()->bookings()->create($validated);   // ← tidak atomik
```
```php
// BookingService.php:14-20 — whereBetween inklusif → bug batas slot
$query->whereBetween('start_time', [$startTime, $endTime])
      ->orWhereBetween('end_time', [$startTime, $endTime])
```

**Skenario eksploitasi.** Dua request bersamaan sama-sama lolos `isSlotAvailable()` sebelum salah satunya menulis, sehingga keduanya berhasil. Tanpa rate limiting (**VULN-03**), 50 request paralel dapat dikirim sekaligus. Terdapat pula bug fungsional pada logika interval: karena `whereBetween` bersifat inklusif, booking `08:00–10:00` dianggap bentrok dengan `10:00–12:00`, sehingga booking yang sah justru ditolak.

**Dampak.** Double booking pada slot yang sama, dua pelanggan tiba di fasilitas yang sama, dispute yang tidak dapat diselesaikan, dan utilisasi fasilitas yang lebih rendah dari seharusnya akibat penolakan yang keliru.

**Rekomendasi perbaikan.** Tiga lapis: transaksi + row lock di aplikasi, logika overlap yang benar, dan unique constraint di database.

**Contoh patch aman.**
```php
public function book(User $user, Facility $facility, array $data): Booking
{
    return DB::transaction(function () use ($user, $facility, $data) {
        Booking::where('facility_id', $facility->id)
            ->where('booking_date', $data['booking_date'])
            ->lockForUpdate()
            ->get();

        if (! $this->isSlotAvailable($facility->id, $data['booking_date'],
                                     $data['start_time'], $data['end_time'])) {
            throw ValidationException::withMessages([
                'start_time' => 'Jadwal bentrok atau tidak tersedia.',
            ]);
        }

        return $user->bookings()->create([
            ...$data,
            'total_price' => $this->calculateTotalPrice(
                $facility, $data['start_time'], $data['end_time']
            ),
        ]);
    }, attempts: 3);
}

// Overlap yang benar: start < existing_end AND end > existing_start
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
// migrasi
Schema::table('bookings', function (Blueprint $table) {
    $table->index(['facility_id', 'booking_date', 'status']);
    $table->unique(['facility_id', 'booking_date', 'start_time'], 'bookings_slot_unique');
});
```

**Cara verifikasi patch.**
```php
public function test_slot_berdampingan_tidak_dianggap_bentrok(): void
{
    // 08:00–10:00 sudah ada → 10:00–12:00 HARUS diterima
}

public function test_unique_constraint_mencegah_double_booking(): void
{
    $this->expectException(QueryException::class);
    Booking::factory()->count(2)->create([
        'facility_id' => 1, 'booking_date' => '2026-08-20', 'start_time' => '08:00',
    ]);
}
```
```bash
# Uji konkurensi di sandbox — hanya SATU yang boleh 201, sisanya 422
seq 1 20 | xargs -P 20 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost:8000/api/bookings -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"facility_id":1,"booking_date":"2026-08-20","start_time":"08:00","end_time":"10:00"}' \
  | sort | uniq -c
```

---

### 🟡 VULN-09 — Aturan Bisnis Booking Tidak Ditegakkan di Server

| | |
|---|---|
| **Severity** | 🟡 **MEDIUM** |
| **OWASP / CWE** | A04 Insecure Design · A01 Broken Access Control · CWE-602 (Client-Side Enforcement of Server-Side Security) |
| **Lokasi** | `Back-End/app/Http/Controllers/Api/BookingController.php:27-45`; `Front-End/src/pages/FacilityDetail.jsx:37-40,134-135` |
| **Status** | **Confirmed** |

**Penyebab.** Seluruh aturan operasional hanya ditegakkan di UI. Tabel `facility_schedules` dibuat dan di-seed, tetapi **tidak pernah dibaca untuk validasi**.

**Bukti dari source code.**
```jsx
// FacilityDetail.jsx:37-40,134-135 — pembatasan hanya kosmetik di kalender
const handleSelectAllow = (selectInfo) => selectInfo.start >= new Date();
// slotMinTime="06:00:00"  slotMaxTime="23:00:00"
```
```php
// BookingController.php:28 — hanya cek keberadaan, bukan is_active
'facility_id' => 'required|exists:facilities,id',
// tidak ada validasi terhadap facility_schedules, durasi maksimum, atau kuota
```

**Skenario eksploitasi.** API menerima apa pun yang tidak dibatasi UI: booking pada fasilitas yang sudah dinonaktifkan admin (`is_active = false`), booking pukul 03:00 pada fasilitas yang hanya buka 08:00–22:00, dan `00:01–23:59` yang memblokir fasilitas sepanjang hari karena `end_time` hanya wajib `after:start_time`. Satu akun juga dapat memblokir seluruh slot pada seluruh fasilitas — *denial of inventory*. Digabung **VULN-02**, seluruh inventaris dapat diblokir dengan harga Rp 0.

**Dampak.** Bypass aturan bisnis, gangguan operasional, dan penolakan layanan terhadap pelanggan yang sah.

**Rekomendasi perbaikan.** Pindahkan seluruh aturan ke Form Request agar konsisten, dapat diuji, dan tidak terlewat saat endpoint baru ditambahkan.

**Contoh patch aman.**
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

        $schedule = $facility->schedules()
            ->where('day_of_week', Carbon::parse($this->booking_date)->dayOfWeek)
            ->first();

        if (! $schedule) {
            $v->errors()->add('booking_date', 'Fasilitas tutup pada hari tersebut.');
            return;
        }

        if ($this->start_time < substr($schedule->open_time, 0, 5)
            || $this->end_time > substr($schedule->close_time, 0, 5)) {
            $v->errors()->add('start_time', 'Di luar jam operasional.');
        }

        $hours = Carbon::createFromFormat('H:i', $this->start_time)
            ->diffInMinutes(Carbon::createFromFormat('H:i', $this->end_time)) / 60;

        if ($hours > config('booking.max_hours', 4)) {
            $v->errors()->add('end_time', 'Durasi booking melebihi batas maksimal.');
        }
    });
}
```

**Cara verifikasi patch.**
```php
public function test_tidak_bisa_booking_fasilitas_nonaktif(): void
{
    $facility = Facility::factory()->create(['is_active' => false]);
    $this->actingAs(User::factory()->create(), 'sanctum')
         ->postJson('/api/bookings', ['facility_id' => $facility->id, /* ... */])
         ->assertStatus(422);
}

public function test_tidak_bisa_booking_di_luar_jam_operasional(): void   { /* 03:00 → 422 */ }
public function test_durasi_melebihi_batas_ditolak(): void                { /* 00:01–23:59 → 422 */ }
```

---

### 🟡 VULN-10 — Mass Assignment: `role` Termasuk Atribut Fillable

| | |
|---|---|
| **Severity** | 🟡 **MEDIUM** *(laten — belum dapat dieksploitasi pada kode saat ini)* |
| **OWASP / CWE** | A01 Broken Access Control · CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes) |
| **Lokasi** | `Back-End/app/Models/User.php:14` |
| **Status** | **Confirmed sebagai risiko struktural** — tidak ada jalur eksploitasi aktif |

**Penyebab.** Kolom `role` — satu-satunya penentu otorisasi di seluruh aplikasi — termasuk dalam daftar atribut yang dapat di-mass-assign.

**Bukti dari source code.**
```php
// app/Models/User.php:14
#[Fillable(['name', 'email', 'password', 'role', 'phone'])]
```
```php
// AuthController.php:21-27 — saat ini AMAN karena array disusun eksplisit
$user = User::create([
    'name' => $request->name, 'email' => $request->email,
    'password' => Hash::make($request->password),
    'role' => 'user',                    // ← hardcoded, bukan dari input
    'phone' => $request->phone,
]);
```

**Skenario eksploitasi.** **Perlu ditegaskan secara jujur: pada kode saat ini celah ini belum dapat dieksploitasi.** `register()` menyusun array secara eksplisit dan meng-hardcode `role`, dan tidak ada endpoint update profil. Karena itu severity Medium, bukan High. Namun begitu seseorang menambahkan endpoint profil dengan pola idiomatik `$user->update($request->validated())` atau `User::create($request->all())`, penyerang cukup menyisipkan `"role":"admin"` pada payload untuk mempromosikan dirinya sendiri. Pola kegagalannya identik dengan **VULN-02** — indikasi bahwa batas kepercayaan input belum ditetapkan secara sistematis.

**Dampak.** Privilege escalation menjadi admin apabila endpoint baru ditambahkan tanpa kehati-hatian ekstra — kelas bug yang sangat mudah lolos code review.

**Rekomendasi perbaikan.** Keluarkan `role` dari daftar fillable, cast ke enum, dan buat framework menolak (bukan mengabaikan) atribut terlarang.

**Contoh patch aman.**
```php
// app/Models/User.php
#[Fillable(['name', 'email', 'password', 'phone'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role'     => UserRole::class,     // enum backed
        ];
    }
}
```
```php
// AppServiceProvider::boot()
Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

// Perubahan role lewat jalur eksplisit yang mudah di-grep saat audit
$user->forceFill(['role' => UserRole::Admin])->save();
```

**Cara verifikasi patch.**
```php
public function test_tidak_bisa_self_promote_lewat_register(): void
{
    $this->postJson('/api/register', [
        'name' => 'X', 'email' => 'x@y.z',
        'password' => 'Password123!', 'password_confirmation' => 'Password123!',
        'role' => 'admin',                       // ← upaya injeksi
    ])->assertCreated();

    $this->assertSame('user', User::where('email', 'x@y.z')->first()->role->value);
}
```
```bash
grep -n "Fillable" Back-End/app/Models/User.php   # pastikan 'role' sudah tidak ada
```

---

### 🟡 VULN-11 — Query Parameter Tanpa Validasi Tipe & `LIKE` Tanpa Escape

| | |
|---|---|
| **Severity** | 🟡 **MEDIUM** |
| **OWASP / CWE** | A05 Security Misconfiguration · A04 Insecure Design · CWE-20 (Improper Input Validation), CWE-1333 |
| **Lokasi** | `Back-End/app/Http/Controllers/Api/BookingController.php:67-73`; `Back-End/app/Http/Controllers/Api/FacilityController.php:16-22` |
| **Status** | **Confirmed** |

**Penyebab.** Parameter query dipakai langsung tanpa validasi tipe, dan input pencarian disisipkan ke pola `LIKE` tanpa menetralkan metakarakter wildcard.

**Bukti dari source code.**
```php
// FacilityController.php:16-22
if ($request->has('type')) {
    $query->where('type', $request->type);          // ← array → TypeError
}
if ($request->has('search')) {
    $query->where('name', 'like', '%' . $request->search . '%');   // ← % dan _ tidak di-escape
}
```
```php
// BookingController.php:67-73 — pola yang sama
if ($request->has('status')) { $query->where('status', $request->status); }
if ($request->has('date'))   { $query->where('booking_date', $request->date); }
```

**Skenario eksploitasi.**
> **Ini bukan SQL Injection.** Eloquent tetap melakukan parameter binding pada seluruh nilai tersebut. Masalahnya adalah *type confusion* dan *resource exhaustion*.

1. **Array injection → unhandled exception.** `GET /api/facilities?type[]=a&type[]=b` membuat `$request->type` bernilai array sementara `where()` mengharapkan skalar → `TypeError` → HTTP 500. Dengan `APP_DEBUG=true` (**VULN-05**), respons memuat stack trace dan seluruh variabel environment. **Inilah pemicu termudah untuk kebocoran VULN-05.**
2. **`has()` vs `filled()`.** `$request->has('status')` bernilai true meski parameter kosong (`?status=`), sehingga query menjadi `where('status', '')` dan selalu mengembalikan himpunan kosong — bug fungsional yang membingungkan admin.
3. **LIKE wildcard DoS.** Input `%_%_%_%_%_%` memaksa full table scan dengan backtracking berat. Tanpa paginasi (**VULN-16**) dan tanpa rate limiting (**VULN-03**), ini vektor DoS berbiaya sangat rendah.

**Dampak.** Information disclosure (sebagai pemicu VULN-05), degradasi performa hingga penolakan layanan, dan hasil filter yang salah bagi admin.

**Rekomendasi perbaikan.** Validasi seluruh parameter dengan allow-list, ganti `has()` → `filled()` atau gunakan `when()`, dan escape metakarakter `LIKE`.

**Contoh patch aman.**
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
Terapkan pola yang sama pada `adminIndex`: `status` → `in:pending,confirmed,cancelled,completed`, `date` → `date_format:Y-m-d`.

**Cara verifikasi patch.**
```php
public function test_array_param_ditolak_bukan_500(): void
{
    $this->getJson('/api/facilities?type[]=a&type[]=b')->assertStatus(422);
}

public function test_wildcard_like_diperlakukan_literal(): void
{
    Facility::factory()->create(['name' => 'Lapangan A', 'is_active' => true]);

    $this->getJson('/api/facilities?search=%')->assertJsonCount(0, 'data');
}
```
```bash
# HARUS 422, bukan 500
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/api/facilities?type[]=a&type[]=b"
```

---

### 🟡 VULN-12 — Hard Delete Fasilitas Menghancurkan Riwayat Transaksi via Cascade

| | |
|---|---|
| **Severity** | 🟡 **MEDIUM** |
| **OWASP / CWE** | A04 Insecure Design · CWE-1329 (Reliance on Component That Is Not Updateable), CWE-212 |
| **Lokasi** | `Back-End/app/Http/Controllers/Api/FacilityController.php:71-77`; migrasi `create_bookings_table:17`, `create_payments_table:16` |
| **Status** | **Confirmed** |

**Penyebab.** Penghapusan permanen tanpa soft delete, dikombinasikan dengan rantai `cascadeOnDelete` dua tingkat.

**Bukti dari source code.**
```php
// FacilityController.php:71-77 — tanpa pengecekan, tanpa audit, tanpa recovery
public function destroy($id)
{
    $facility = Facility::findOrFail($id);
    $facility->delete();
    return response()->json(['message' => 'Fasilitas dihapus']);
}
```
```php
// migrasi bookings:17  →  migrasi payments:16
$table->foreignId('facility_id')->constrained()->cascadeOnDelete();
$table->foreignId('booking_id')->constrained()->cascadeOnDelete();
```

**Skenario eksploitasi.** Satu request `DELETE /api/admin/facilities/1` menghapus fasilitas → seluruh booking-nya → seluruh pembayaran terkait. Akun admin yang dikompromikan (sangat mungkin lewat **VULN-04**) dapat memusnahkan seluruh basis transaksi dalam dua request. Skenario yang lebih mungkin dan sama merusaknya: admin sah salah klik di UI `AdminFacilities.jsx`.

**Dampak.** Kehilangan permanen bukti transaksi dan pembayaran — masalah kepatuhan (bukti transaksi wajib disimpan), dispute pelanggan yang tidak dapat diselesaikan, dan hilangnya data akuntansi. Tanpa audit log (**VULN-19**), tidak ada jejak siapa yang melakukannya.

**Rekomendasi perbaikan.** Soft delete, putuskan rantai cascade untuk data keuangan, dan tolak penghapusan bila masih ada booking aktif.

**Contoh patch aman.**
```php
// app/Models/Facility.php
use Illuminate\Database\Eloquent\SoftDeletes;
class Facility extends Model { use HasFactory, SoftDeletes; }
```
```php
// migrasi
Schema::table('facilities', fn (Blueprint $t) => $t->softDeletes());

Schema::table('bookings', function (Blueprint $table) {
    $table->dropForeign(['facility_id']);
    $table->foreign('facility_id')->references('id')->on('facilities')->restrictOnDelete();
});
```
```php
public function destroy($id)
{
    $facility = Facility::findOrFail($id);

    if ($facility->bookings()->whereIn('status', ['pending', 'confirmed'])->exists()) {
        return response()->json([
            'message' => 'Fasilitas masih memiliki booking aktif. '
                        .'Nonaktifkan (is_active=false) alih-alih menghapus.',
        ], 409);
    }

    $facility->delete();   // soft delete
    activity()->causedBy(request()->user())->performedOn($facility)->log('facility.deleted');

    return response()->json(['message' => 'Fasilitas dinonaktifkan']);
}
```

**Cara verifikasi patch.**
```php
public function test_hapus_fasilitas_tidak_menghapus_pembayaran(): void
{
    $facility = Facility::factory()->create();
    $booking  = Booking::factory()->for($facility)->create(['status' => 'completed']);
    $payment  = Payment::factory()->for($booking)->create();

    $this->actingAs($this->admin(), 'sanctum')
         ->deleteJson("/api/admin/facilities/{$facility->id}")
         ->assertOk();

    $this->assertDatabaseHas('payments', ['id' => $payment->id]);   // TETAP ADA
}

public function test_tolak_hapus_bila_ada_booking_aktif(): void
{
    // booking status 'confirmed' → assertStatus(409)
}
```

---

### 🟡 VULN-13 — Transport Security & Security Headers Tidak Dikonfigurasi

| | |
|---|---|
| **Severity** | 🟡 **MEDIUM** |
| **OWASP / CWE** | A05 Security Misconfiguration · A02 Cryptographic Failures · CWE-319 (Cleartext Transmission), CWE-1021 (Clickjacking), CWE-693 |
| **Lokasi** | `Front-End/src/api/axiosClient.js:5`; `Back-End/.env.example:5`; `Back-End/config/session.php:172`; `Front-End/index.html` |
| **Status** | **Confirmed** |

**Penyebab.** URL API tertanam sebagai literal HTTP, tidak ada enforcement HTTPS, dan tidak ada satu pun security header yang dikirim.

**Bukti dari source code.**
```js
// Front-End/src/api/axiosClient.js:5 — hardcoded, plain HTTP
baseURL: 'http://localhost:8000/api',
```
```php
// config/session.php:172 — null bila SESSION_SECURE_COOKIE tidak diset
'secure' => env('SESSION_SECURE_COOKIE'),
```
```html
<!-- Front-End/index.html — tidak ada CSP; tidak ada middleware header di backend -->
```

**Skenario eksploitasi.** Build produksi menghasilkan bundle yang menunjuk ke `localhost` sehingga aplikasi tidak berfungsi saat di-deploy; perbaikan tergesa-gesa saat rilis cenderung berujung pada endpoint HTTP polos. Bila API diakses via HTTP, **Bearer token melintas plaintext** dan dapat disadap di Wi-Fi publik — digabung **VULN-06** (token tanpa expiry), satu penyadapan berarti akses permanen. Tanpa `X-Frame-Options`/`frame-ancestors`, aplikasi dapat di-iframe untuk clickjacking pada tombol "Lanjutkan Booking" dan aksi admin.

**Dampak.** Pencurian token via MITM, clickjacking, dan hilangnya pertahanan berlapis terhadap XSS di masa depan.

**Rekomendasi perbaikan.** Konfigurasi base URL lewat environment Vite, paksa HTTPS, dan kirim security headers lengkap.

**Contoh patch aman.**
```js
// src/api/axiosClient.js
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});
// Front-End/.env.production → VITE_API_BASE_URL=https://api.booking.example.com/api
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
            ."connect-src 'self' https://api.booking.example.com; "
            ."frame-ancestors 'none'; base-uri 'self'",
    ]);

    return $response;
}
```
Daftarkan via `$middleware->append(SecurityHeaders::class)` dan set `SESSION_SECURE_COOKIE=true`.

**Cara verifikasi patch.**
```bash
curl -sI https://booking.example.com | grep -iE \
  "strict-transport-security|x-frame-options|content-security-policy|x-content-type-options"

# Pastikan tidak ada URL localhost di bundle produksi
npm run build && grep -r "localhost:8000" dist/ && echo "MASIH ADA" || echo "BERSIH"
```
Uji eksternal: `securityheaders.com` dan SSL Labs terhadap domain Anda sendiri.

---

### 🟡 VULN-14 — Dependensi dengan Kerentanan Diketahui

| | |
|---|---|
| **Severity** | 🟡 **MEDIUM** — *advisory tingkat High, namun tidak ada yang reachable pada kode saat ini* |
| **OWASP / CWE** | A06 Vulnerable and Outdated Components · CWE-1395 |
| **Lokasi** | `Back-End/composer.lock`; `Front-End/package-lock.json` |
| **Status** | **Confirmed** via `composer audit --locked` dan `npm audit --package-lock-only` |

**Penyebab.** Lockfile menyematkan versi yang berada di bawah rilis perbaikan keamanan.

**Bukti — hasil audit aktual.**
```
$ composer audit --locked
Found 17 security vulnerability advisories affecting 3 packages.

  dompdf/dompdf       v3.1.5   → 6 advisories (4 medium, 2 low)   fixed in 3.1.6
  guzzlehttp/guzzle   7.14.2   → 5 advisories (1 high, 4 medium)
  league/commonmark   2.8.3    → 6 advisories (4 high, 2 medium)  fixed in 2.9.0
```
```
$ npm audit --package-lock-only
  react-router  7.12.0–7.18.1   HIGH      RSC Mode CSRF Bypass (GHSA-qwww-vcr4-c8h2)
  nanoid        <3.3.18         HIGH      infinite loop when size is zero
  postcss       <=8.5.22        MODERATE  arbitrary .map file read when `from` unset
  → 4 vulnerabilities (1 moderate, 3 high)
```

**Analisis reachability — mengapa Medium, bukan High.**

| Paket | Advisory paling relevan | Reachable? |
|---|---|---|
| `dompdf/dompdf` v3.1.5 | CVE-2026-56722 **local file read** via SVG data-URI; CVE-2026-59943 file existence oracle | ❌ **Tidak saat ini.** `report.blade.php` hanya me-render `{{ }}` yang ter-escape, sehingga user tidak dapat menyuntikkan `<svg>` ke dalam PDF. **Menjadi reachable** bila ada yang mengganti ke `{!! !!}` atau merender field `image` (lihat INFO-03). |
| `league/commonmark` 2.8.3 | 4 advisory High (DoS parsing Markdown) | ❌ Transitif via `laravel/framework`; aplikasi tidak me-render Markdown dari input pengguna. |
| `guzzlehttp/guzzle` 7.14.2 | 1 High + 4 Medium | ❌ Transitif; audit sink menunjukkan **0 pemanggilan** HTTP client. **Akan menjadi reachable** begitu payment gateway diintegrasikan (VULN-01). |
| `react-router` 7.18.1 | RSC Mode CSRF Bypass | ❌ Aplikasi memakai `BrowserRouter` (SPA mode), bukan RSC. |
| `nanoid`, `postcss` | High / Moderate | ❌ Transitif build-time; tidak berada di jalur runtime produksi. |

**Dampak.** Saat ini rendah karena tidak ada jalur yang reachable. Namun `dompdf` dan `guzzle` berada tepat di jalur fitur yang akan segera dikembangkan (ekspor PDF yang lebih kaya, integrasi gateway), sehingga jendela risikonya akan terbuka dalam waktu dekat. Biaya perbaikan mendekati nol.

**Rekomendasi perbaikan.** Upgrade sekarang selagi murah, lalu jadikan audit sebagai gate CI agar tidak terjadi lagi.

**Contoh patch aman.**
```bash
cd Back-End
composer update dompdf/dompdf league/commonmark guzzlehttp/guzzle --with-dependencies
composer audit --locked          # harapkan: No security vulnerability advisories found

cd ../Front-End
npm audit fix                    # patch/minor saja
npm audit --package-lock-only    # harapkan: found 0 vulnerabilities
```
```yaml
# .github/workflows/security.yml — gate rilis
name: Security Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Composer audit
        run: composer audit --locked --working-dir=Back-End
      - name: NPM audit
        run: npm audit --package-lock-only --audit-level=high --prefix Front-End
```

**Cara verifikasi patch.**
```bash
composer audit --locked --working-dir=Back-End   # exit code 0 & "No security vulnerability advisories"
npm audit --package-lock-only --prefix Front-End # "found 0 vulnerabilities"

# Pastikan ekspor PDF masih berfungsi setelah upgrade dompdf
php artisan test --filter=ReportExport
```

---

### 🔵 VULN-15 — Validasi Registrasi Lemah *(Low)*

**Lokasi:** `AuthController.php:15-27`; `Front-End/src/pages/Register.jsx:117-121` · **CWE-521, CWE-20**

**Penyebab & bukti.** `phone` dibaca via `$request->phone` (baris 26) **tanpa pernah masuk ke aturan `validate()`** (baris 15-19) — tidak ada batas panjang, format, maupun tipe. Kebijakan password hanya `min:8`, tanpa `confirmed`, tanpa `max` (bcrypt memotong pada 72 byte sehingga password panjang terpotong diam-diam), dan tanpa pengecekan kebocoran.
```php
// AuthController.php:15-27
$request->validate([ 'name' => ..., 'email' => ..., 'password' => 'required|string|min:8' ]);
User::create([ /* ... */ 'phone' => $request->phone ]);   // ← phone tak tervalidasi
```
```jsx
// Register.jsx:117 — konfirmasi password HANYA di frontend, dapat dilewati via API
if (form.password !== form.password_confirmation) { setError('...'); return; }
```

**Skenario & dampak.** Registrasi via API langsung melewati konfirmasi password sepenuhnya; `phone` sepanjang 10 MB atau bertipe array diteruskan ke DB hingga memicu error kolom; password lemah dan yang sudah bocor di breach lolos diterima.

**Patch aman.**
```php
use Illuminate\Validation\Rules\Password;

$validated = $request->validate([
    'name'     => ['required', 'string', 'max:255'],
    'email'    => ['required', 'string', 'email:rfc,dns', 'max:255', 'unique:users,email'],
    'phone'    => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s()]+$/'],
    'password' => ['required', 'confirmed', 'max:72',
                   Password::min(10)->mixedCase()->numbers()->uncompromised()],
]);
```

**Verifikasi.** `test_register_menolak_password_tanpa_konfirmasi()` → 422; `test_phone_terlalu_panjang_ditolak()` → 422.

---

### 🔵 VULN-16 — Tidak Ada Paginasi pada Endpoint List & Export *(Low)*

**Lokasi:** `BookingController.php:21,75`; `FacilityController.php:24`; `ReportController.php:33-36` · **CWE-770**

**Penyebab & bukti.** Seluruh endpoint memuat hasil dengan `->get()` tanpa batas.
```php
// BookingController.php:75 — eager load user+facility untuk SELURUH booking
return response()->json($query->get());

// ReportController.php:33-38 — seluruh riwayat dimuat lalu dirender DomPDF di memori
$bookings = Booking::with(['user','facility'])->where('payment_status','paid')->get();
$pdf = Pdf::loadView('pdf.report', compact('bookings'));
```

**Skenario & dampak.** Pada 50.000 booking, satu klik "Export" menghabiskan memori PHP dan menjatuhkan worker — DoS yang dapat dipicu tanpa niat jahat, dan disengaja tanpa rate limiting (**VULN-03**).

**Patch aman.**
```php
$request->validate([
    'from' => ['required', 'date'],
    'to'   => ['required', 'date', 'after_or_equal:from',
               'before:'.now()->addDay()->toDateString()],
]);

ExportBookingReport::dispatch($request->user(), $request->from, $request->to);

return response()->json(['message' => 'Laporan diproses, akan dikirim via email.'], 202);
```
Gunakan `->paginate(20)` pada seluruh endpoint list.

**Verifikasi.** Seed 100k booking di sandbox, panggil `/api/admin/bookings`, pastikan respons ter-paginasi dan `memory_get_peak_usage()` stabil.

---

### 🔵 VULN-17 — SQL Tidak Portabel: `MONTH()` pada Driver SQLite *(Low)*

**Lokasi:** `ReportController.php:18` · **CWE-703**

**Penyebab & bukti.**
```php
// ReportController.php:18 — MONTH() adalah fungsi khusus MySQL
$revenuePerMonth = Booking::selectRaw('MONTH(created_at) as month, SUM(total_price) as revenue')
```
Konfigurasi default adalah `DB_CONNECTION=sqlite` (`.env.example:23`), dan SQLite tidak mengenal `MONTH()` → `SQLSTATE[HY000]: no such function: MONTH`.

**Skenario & dampak.** Dashboard admin error 500 pada instalasi default; dengan `APP_DEBUG=true` (**VULN-05**) error tersebut membocorkan detail internal. Menandakan drift antara konfigurasi repo dan dokumen desain yang menyebut MySQL/PostgreSQL.

**Patch aman.**
```php
$revenuePerMonth = Booking::query()
    ->where('payment_status', 'paid')
    ->whereBetween('created_at', [now()->startOfYear(), now()->endOfYear()])
    ->get()
    ->groupBy(fn ($b) => $b->created_at->format('n'))
    ->map(fn ($rows, $month) => ['month' => (int) $month, 'revenue' => $rows->sum('total_price')])
    ->values();
```

**Verifikasi.** Jalankan `php artisan test --filter=ReportSummary` pada `DB_CONNECTION=sqlite` **dan** `mysql` — keduanya harus lulus.

---

### 🔵 VULN-18 — `show()` Membocorkan Fasilitas Nonaktif *(Low)*

**Lokasi:** `FacilityController.php:27-31` (bandingkan `:14`) · **CWE-200**

**Penyebab & bukti.**
```php
public function index(Request $request) {
    $query = Facility::query()->where('is_active', true);     // ← difilter
}
public function show($id) {
    $facility = Facility::with('schedules')->findOrFail($id); // ← TIDAK difilter
}
```

**Skenario & dampak.** Fasilitas yang sengaja dinonaktifkan (mis. sedang renovasi) tetap dapat diakses lewat `GET /api/facilities/5` dan — karena `store()` booking juga tidak memeriksa `is_active` (**VULN-09**) — tetap dapat dipesan.

**Patch aman.**
```php
public function show($id)
{
    $facility = Facility::with('schedules')->where('is_active', true)->findOrFail($id);
    return response()->json($facility);
}
```
Lebih baik lagi: global scope atau Policy agar konsisten otomatis di seluruh endpoint publik.

**Verifikasi.** `test_fasilitas_nonaktif_mengembalikan_404()`.

---

### 🔵 VULN-19 — Tidak Ada Audit Log untuk Aksi Admin *(Low)*

**Lokasi:** `BookingController.php:78-88`; `FacilityController.php:33-77` · **OWASP A09 · CWE-778**

**Penyebab & bukti.** `updateStatus()`, `update()`, dan `destroy()` mengubah state penting tanpa mencatat pelaku, waktu, atau nilai sebelum/sesudah. Kegagalan login juga tidak dicatat.

**Skenario & dampak.** Setelah insiden (mis. kompromi lewat **VULN-04**), tidak ada cara mengetahui apa yang diubah, oleh siapa, kapan — investigasi forensik mustahil dan pemulihan **VULN-12** tanpa panduan. Brute force (**VULN-03**) berlangsung tanpa terdeteksi.

**Patch aman.**
```php
// AppServiceProvider::boot()
Event::listen(Failed::class, fn ($e) => Log::channel('security')->warning('auth.failed', [
    'email' => $e->credentials['email'] ?? null,
    'ip'    => request()->ip(),
]));
```
Pasang `spatie/laravel-activitylog` pada model `Booking`, `Facility`, `Payment`. Kirim log ke sink terpusat di luar server aplikasi; pasang alert untuk lonjakan kegagalan login dan aksi destruktif admin.

**Verifikasi.** Lakukan perubahan status booking sebagai admin, pastikan baris muncul di `activity_log` berisi `causer_id`, nilai lama, dan nilai baru.

---

### 🔵 VULN-20 — Verifikasi Email & Alur Reset Password Tidak Diimplementasikan *(Low)*

**Lokasi:** `app/Models/User.php:5`; migrasi `password_reset_tokens`; `routes/api.php` · **CWE-620, CWE-640**

**Penyebab & bukti.**
```php
// app/Models/User.php:5 — MustVerifyEmail dinonaktifkan
// use Illuminate\Contracts\Auth\MustVerifyEmail;
```
Tabel `password_reset_tokens` ada di skema (migrasi `0001_01_01_000000`) tetapi **tidak ada satu pun route** yang menggunakannya.

**Skenario & dampak.** Registrasi menerima email apa pun tanpa verifikasi kepemilikan — pendaftaran massal dengan email palsu (diperparah tanpa rate limit, **VULN-03**), notifikasi terkirim ke alamat tidak valid. Pengguna yang lupa password **terkunci permanen** dan harus dibantu manual lewat database — praktik yang justru mendorong penanganan kredensial secara tidak aman.

**Patch aman.** Aktifkan `MustVerifyEmail` pada `User`, tambahkan middleware `verified` pada route pembuatan booking, dan implementasikan `forgot-password`/`reset-password` bawaan Laravel dengan throttle ketat serta respons seragam (agar tidak membocorkan email terdaftar).

**Verifikasi.** `test_user_belum_verifikasi_tidak_bisa_booking()` → 403; permintaan reset untuk email tidak terdaftar dan terdaftar harus mengembalikan respons **identik**.

---

### 🔵 VULN-21 — Gating Admin Frontend Bergantung pada State yang Dapat Diedit *(Low)*

**Lokasi:** `Front-End/src/AppRouter.jsx:20-32`; `src/store/authStore.js:14` · **CWE-602**

**Penyebab & bukti.**
```jsx
// AppRouter.jsx:20-32 — role dibaca dari state yang dipersist di localStorage
const { isAuthenticated, user } = useAuthStore();
if (requireAdmin && user?.role !== 'admin') return <Navigate to="/" replace />;
```

**Skenario & dampak.** Pengguna mengedit `auth-storage` di DevTools menjadi `"role":"admin"` dan me-refresh untuk membuka shell UI admin. **Dampaknya kosmetik, bukan pelanggaran akses data** — audit ini mengonfirmasi backend menegakkan dengan benar:
```php
// RoleMiddleware.php:18 — role dibaca dari record DB user terautentikasi
if (! $request->user() || $request->user()->role !== $role) {
    return response()->json(['message' => 'Forbidden'], 403);
}
```
Seluruh panggilan `/api/admin/*` tetap 403 dan halaman menampilkan state kosong. Yang bocor adalah struktur UI internal — peta endpoint admin bagi penyerang.

**Patch aman.**
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
Jangan persist `role` (gunakan `partialize`, sejalan dengan **VULN-06**).

**Verifikasi.** Edit `localStorage` menjadi `role: "admin"`, refresh — harus di-redirect ke `/` setelah `/api/me` merespons.

---

### ⚪ INFO-01 — Fingerprinting Framework via Halaman Default

**Lokasi:** `routes/web.php:5-7`; `resources/views/welcome.blade.php` (223 baris, default Laravel)

Route `GET /` masih menyajikan halaman selamat datang bawaan Laravel, mengungkap framework dan perkiraan versi kepada siapa pun. Ini mempersempit ruang tebak penyerang saat memilih exploit. **Perbaikan:** hapus route tersebut (SPA disajikan terpisah) atau kembalikan `404`/halaman minimal Anda sendiri. **Verifikasi:** `curl -s https://domain-anda.com/ | grep -ci laravel` → harapkan `0`.

---

### ⚪ INFO-02 — Health Endpoint Publik Tanpa Autentikasi

**Lokasi:** `bootstrap/app.php:13` — `health: '/up'`

Endpoint `/up` menjalankan bootstrap penuh aplikasi dan dapat diakses tanpa autentikasi. Berguna untuk load balancer, tetapi juga mengonfirmasi keberadaan stack Laravel dan dapat dipakai sebagai target flood murah (tanpa rate limiting — **VULN-03**). **Perbaikan:** batasi ke CIDR internal load balancer, atau lindungi dengan token sederhana. **Verifikasi:** `curl -sI https://domain-anda.com/up` dari IP eksternal → harapkan `403`/`404`.

---

### ⚪ INFO-03 — Field `image` Adalah Sink Laten (Belum Dirender)

**Lokasi:** `FacilityController.php:42,62` (`'image' => 'nullable|string'`); migrasi `facilities:22`

Field `image` menerima **string arbitrer** dari admin — bukan file upload, tanpa validasi URL/skema. Audit mengonfirmasi field ini **saat ini tidak pernah dirender**: tidak ada satu pun tag `<img>` di `Front-End/src/`, dan `report.blade.php` tidak memuatnya. Jadi tidak ada XSS maupun SSRF hari ini.

Namun ia adalah sink laten pada dua jalur sekaligus:
1. Bila kelak dirender sebagai `<img src={facility.image}>`, nilai `javascript:` atau `data:text/html` menjadi vektor XSS (walau memerlukan hak admin).
2. Bila kelak dimasukkan ke `report.blade.php`, ia bertemu **dompdf v3.1.5** yang rentan CVE-2026-56722 (**VULN-14**) — data-URI SVG berubah menjadi **local file read** di server.

**Perbaikan:** validasi sebagai path/URL dengan skema allow-list, atau implementasikan file upload sungguhan dengan validasi `mimes:jpg,png,webp` + `max:2048` dan simpan via `Storage::disk('public')`.
```php
'image' => ['nullable', 'url:http,https', 'max:2048'],
// atau untuk upload sungguhan:
'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
```
**Verifikasi:** `test_image_menolak_skema_javascript()` dan `test_image_menolak_data_uri()` → 422.

---

## 6. CATATAN METODOLOGI & BATASAN

- **Metode:** static source review menyeluruh (100% file aplikasi dibaca), penelusuran alur data input → penyimpanan → otorisasi → output, sink-based audit untuk setiap kategori kerentanan yang diminta, ditambah `composer audit --locked` dan `npm audit --package-lock-only`.
- **Tidak dilakukan:** DAST, penetration testing, fuzzing, maupun pengujian terhadap instance yang berjalan. Seluruh perintah `curl`/test pada bagian "Cara verifikasi patch" ditujukan untuk **environment lokal/sandbox milik Anda sendiri**.
- **Dua temuan bertanda "Needs Verification"** (VULN-04 dan VULN-05) bergantung pada kondisi deployment yang tidak dapat dipastikan dari source code. Cara memverifikasinya secara aman dijelaskan pada masing-masing temuan; keduanya naik ke **Critical** bila terkonfirmasi aktif di produksi.
- **Severity** ditetapkan berdasarkan eksploitabilitas nyata pada codebase ini, bukan severity teoretis kelas kerentanan. Beberapa temuan sengaja **diturunkan** dari peringkat umumnya (VULN-07 CORS, VULN-10 mass assignment, VULN-14 dependensi) karena analisis reachability menunjukkan tidak ada jalur eksploitasi aktif — alasannya dijelaskan eksplisit pada masing-masing temuan agar Anda dapat menilai ulang bila konteksnya berubah.
