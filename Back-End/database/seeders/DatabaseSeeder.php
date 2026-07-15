<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Admin user
        User::create([
            'name' => 'Admin User',
            'email' => 'admin@admin.com',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'phone' => '081234567890',
        ]);

        // Regular user
        User::create([
            'name' => 'Normal User',
            'email' => 'user@user.com',
            'password' => bcrypt('password'),
            'role' => 'user',
            'phone' => '089876543210',
        ]);

        // Facilities
        $futsal = \App\Models\Facility::create([
            'name' => 'Lapangan Futsal A',
            'type' => 'lapangan',
            'description' => 'Lapangan futsal indoor sintetis.',
            'location' => 'Gedung Olahraga Lt. 1',
            'price_per_hour' => 150000,
            'is_active' => true,
        ]);

        $meeting = \App\Models\Facility::create([
            'name' => 'Ruang Meeting VIP',
            'type' => 'meeting_room',
            'description' => 'Ruang meeting eksklusif dengan proyektor dan AC.',
            'location' => 'Gedung Utama Lt. 2',
            'price_per_hour' => 100000,
            'capacity' => 20,
            'is_active' => true,
        ]);

        // Facility Schedules
        for ($i = 0; $i <= 6; $i++) {
            \App\Models\FacilitySchedule::create([
                'facility_id' => $futsal->id,
                'day_of_week' => $i,
                'open_time' => '08:00:00',
                'close_time' => '22:00:00',
            ]);

            \App\Models\FacilitySchedule::create([
                'facility_id' => $meeting->id,
                'day_of_week' => $i,
                'open_time' => '09:00:00',
                'close_time' => '17:00:00',
            ]);
        }
    }
}
