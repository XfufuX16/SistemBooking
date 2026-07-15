<?php

namespace App\Services;

use App\Models\Booking;

class BookingService
{
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
}
