<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ResourceController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::middleware(['web'])->group(function () {
    Route::get('/', function () {
        return redirect('/dashboard');
    });

    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    
    // Routes pour les ressources
    Route::get('/resources/{id}', [ResourceController::class, 'show'])->name('resources.show');
    
    // Route pour le fichier resources.json
    Route::get('/api/resources', function () {
        $path = resource_path('data/resources.json');
        return response()->file($path, ['Content-Type' => 'application/json']);
    });
});
