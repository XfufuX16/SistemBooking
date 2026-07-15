<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function pay(Request $request, $id)
    {
        $booking = $request->user()->bookings()->findOrFail($id);

        if ($booking->payment_status === 'paid') {
            return response()->json(['message' => 'Booking ini sudah dibayar.'], 422);
        }

        // Contoh sederhana integrasi / simulasi payment
        $payment = Payment::create([
            'booking_id' => $booking->id,
            'payment_method' => $request->payment_method ?? 'transfer',
            'amount' => $booking->total_price,
            'transaction_id' => uniqid('TRX-'),
            'status' => 'success', // auto success for now
            'paid_at' => now(),
        ]);

        $booking->update(['payment_status' => 'paid', 'status' => 'confirmed']);

        return response()->json($payment);
    }

    public function callback(Request $request)
    {
        // Handle webhook dari payment gateway
        return response()->json(['message' => 'Callback received']);
    }
}
