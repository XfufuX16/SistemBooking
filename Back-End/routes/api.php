<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FacilityController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/facilities', [FacilityController::class, 'index']);
Route::get('/facilities/{id}', [FacilityController::class, 'show']);
Route::get('/facilities/{id}/availability', [FacilityController::class, 'availability']);
Route::post('/payments/callback', [PaymentController::class, 'callback']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // User Bookings
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::put('/bookings/{id}/cancel', [BookingController::class, 'cancel']);

    // Payments
    Route::post('/bookings/{id}/pay', [PaymentController::class, 'pay']);

    // Admin Routes
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::post('/facilities', [FacilityController::class, 'store']);
        Route::put('/facilities/{id}', [FacilityController::class, 'update']);
        Route::delete('/facilities/{id}', [FacilityController::class, 'destroy']);

        Route::get('/bookings', [BookingController::class, 'adminIndex']);
        Route::put('/bookings/{id}/status', [BookingController::class, 'updateStatus']);

        Route::get('/reports/summary', [ReportController::class, 'summary']);
        Route::get('/reports/export', [ReportController::class, 'export']);
    });
});
