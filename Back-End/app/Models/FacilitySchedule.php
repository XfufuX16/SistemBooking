<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class FacilitySchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'facility_id',
        'day_of_week',
        'open_time',
        'close_time',
    ];

    public function facility()
    {
        return $this->belongsTo(Facility::class);
    }
}
