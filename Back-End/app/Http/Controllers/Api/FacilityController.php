<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Facility;
use App\Services\BookingService;
use Illuminate\Http\Request;

class FacilityController extends Controller
{
    public function index(Request $request)
    {
        $query = Facility::query()->where('is_active', true);

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        return response()->json($query->get());
    }

    public function show($id)
    {
        $facility = Facility::with('schedules')->findOrFail($id);
        return response()->json($facility);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'type' => 'required|in:lapangan,meeting_room',
            'description' => 'nullable|string',
            'location' => 'nullable|string',
            'price_per_hour' => 'required|numeric',
            'capacity' => 'nullable|integer',
            'image' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $facility = Facility::create($validated);

        return response()->json($facility, 201);
    }

    public function update(Request $request, $id)
    {
        $facility = Facility::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string',
            'type' => 'sometimes|required|in:lapangan,meeting_room',
            'description' => 'nullable|string',
            'location' => 'nullable|string',
            'price_per_hour' => 'sometimes|required|numeric',
            'capacity' => 'nullable|integer',
            'image' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $facility->update($validated);

        return response()->json($facility);
    }

    public function destroy($id)
    {
        $facility = Facility::findOrFail($id);
        $facility->delete();

        return response()->json(['message' => 'Fasilitas dihapus']);
    }

    public function availability(Request $request, $id)
    {
        $request->validate([
            'date' => 'required|date',
        ]);

        $facility = Facility::findOrFail($id);
        $bookings = $facility->bookings()
            ->where('booking_date', $request->date)
            ->whereIn('status', ['pending', 'confirmed'])
            ->get(['start_time', 'end_time']);

        return response()->json([
            'facility_id' => $facility->id,
            'date' => $request->date,
            'booked_slots' => $bookings
        ]);
    }
}
