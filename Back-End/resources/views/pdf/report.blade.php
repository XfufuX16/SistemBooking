<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Laporan Booking</title>
    <style>
        body { font-family: sans-serif; font-size: 12px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; padding: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .total { text-align: right; font-weight: bold; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Laporan Pemesanan Fasilitas</h1>
        <p>Tanggal Cetak: {{ \Carbon\Carbon::now()->format('d M Y H:i') }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Nama User</th>
                <th>Fasilitas</th>
                <th>Tanggal</th>
                <th>Waktu</th>
                <th>Total Harga (Rp)</th>
            </tr>
        </thead>
        <tbody>
            @php $grandTotal = 0; @endphp
            @foreach($bookings as $booking)
            <tr>
                <td>{{ $booking->id }}</td>
                <td>{{ $booking->user->name }}</td>
                <td>{{ $booking->facility->name }}</td>
                <td>{{ $booking->booking_date }}</td>
                <td>{{ $booking->start_time }} - {{ $booking->end_time }}</td>
                <td>{{ number_format($booking->total_price, 0, ',', '.') }}</td>
            </tr>
            @php $grandTotal += $booking->total_price; @endphp
            @endforeach
        </tbody>
    </table>

    <div class="total">
        Total Pendapatan: Rp {{ number_format($grandTotal, 0, ',', '.') }}
    </div>
</body>
</html>
