<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Facility extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type',
        'description',
        'location',
        'price_per_hour',
        'capacity',
        'image',
        'is_active',
    ];

    public function schedules()
    {
        return $this->hasMany(FacilitySchedule::class);
    }

    public function bookings()
    {
        return $this->hasMany(Booking::class);
    }
}
