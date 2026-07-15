<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;

class ReportController extends Controller
{
    public function summary(Request $request)
    {
        $totalBookings = Booking::count();
        $totalRevenue = Booking::where('payment_status', 'paid')->sum('total_price');

        // Simple monthly revenue for current year
        $revenuePerMonth = Booking::selectRaw('MONTH(created_at) as month, SUM(total_price) as revenue')
            ->where('payment_status', 'paid')
            ->whereYear('created_at', date('Y'))
            ->groupBy('month')
            ->get();

        return response()->json([
            'total_bookings' => $totalBookings,
            'total_revenue' => $totalRevenue,
            'revenue_per_month' => $revenuePerMonth,
        ]);
    }

    public function export(Request $request)
    {
        $bookings = Booking::with(['user', 'facility'])
            ->where('payment_status', 'paid')
            ->orderBy('created_at', 'desc')
            ->get();

        $pdf = Pdf::loadView('pdf.report', compact('bookings'));

        return $pdf->download('Laporan_Booking.pdf');
    }
}
