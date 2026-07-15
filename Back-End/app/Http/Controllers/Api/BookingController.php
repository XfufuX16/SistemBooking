<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\BookingService;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    protected $bookingService;

    public function __construct(BookingService $bookingService)
    {
        $this->bookingService = $bookingService;
    }

    public function index(Request $request)
    {
        $bookings = $request->user()->bookings()->with('facility')->latest()->get();
        return response()->json($bookings);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'facility_id' => 'required|exists:facilities,id',
            'booking_date' => 'required|date|after_or_equal:today',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'total_price' => 'required|numeric',
            'notes' => 'nullable|string',
        ]);

        if (!$this->bookingService->isSlotAvailable(
            $validated['facility_id'], 
            $validated['booking_date'], 
            $validated['start_time'], 
            $validated['end_time']
        )) {
            return response()->json(['message' => 'Jadwal bentrok atau tidak tersedia.'], 422);
        }

        $booking = $request->user()->bookings()->create($validated);

        return response()->json($booking, 201);
    }

    public function cancel(Request $request, $id)
    {
        $booking = $request->user()->bookings()->findOrFail($id);

        if ($booking->status !== 'pending') {
            return response()->json(['message' => 'Hanya booking dengan status pending yang dapat dibatalkan.'], 403);
        }

        $booking->update(['status' => 'cancelled']);

        return response()->json($booking);
    }

    public function adminIndex(Request $request)
    {
        $query = Booking::with(['user', 'facility'])->latest();

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        
        if ($request->has('date')) {
            $query->where('booking_date', $request->date);
        }

        return response()->json($query->get());
    }

    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:pending,confirmed,cancelled,completed'
        ]);

        $booking = Booking::findOrFail($id);
        $booking->update(['status' => $request->status]);

        return response()->json($booking);
    }
}
