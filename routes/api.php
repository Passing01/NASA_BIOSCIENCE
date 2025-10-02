<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\OpenAIController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Routes pour l'API OpenAI
Route::prefix('ai')->group(function () {
    Route::post('/chat', [\App\Http\Controllers\Api\OpenAIController::class, 'chat']);
    Route::post('/chat/stream', [\App\Http\Controllers\Api\OpenAIController::class, 'chatStream']);
    Route::get('/resources', [\App\Http\Controllers\Api\OpenAIController::class, 'getResources']);
    Route::get('/resources/{id}', [\App\Http\Controllers\Api\OpenAIController::class, 'getResourceContent']);
    Route::get('/resources/{id}/summary', [\App\Http\Controllers\Api\OpenAIController::class, 'summarize']);
    Route::get('/resources/{id}/keywords', [\App\Http\Controllers\Api\OpenAIController::class, 'keywords']);
    Route::get('/resources/{id}/related', [\App\Http\Controllers\Api\OpenAIController::class, 'related']);
    Route::get('/resources-enriched', [\App\Http\Controllers\Api\OpenAIController::class, 'getEnrichedResources']);
    Route::get('/experiments', [\App\Http\Controllers\Api\OpenAIController::class, 'experiments']);
});

// Routes pour le chat IA avec limitation de débit
Route::prefix('chat')->middleware(['rate.limit'])->group(function () {
    Route::post('/message', [\App\Http\Controllers\Api\ChatController::class, 'sendMessage']);
    Route::get('/resources', [\App\Http\Controllers\Api\ChatController::class, 'getResources']);
});

// Routes pour les ressources
Route::prefix('resources')->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\ResourceController::class, 'index']);
    Route::get('/{id}', [\App\Http\Controllers\Api\ResourceController::class, 'show']);
    Route::get('/{id}/content', [\App\Http\Controllers\Api\ResourceController::class, 'content']);
});

// API Version 1
Route::prefix('v1')->group(function () {
    // Missions API
    Route::apiResource('missions', \App\Http\Controllers\Api\MissionController::class);
    
    // Experiments API
    Route::apiResource('experiments', \App\Http\Controllers\Api\ExperimentController::class);
    
    // Publications API
    Route::apiResource('publications', \App\Http\Controllers\Api\PublicationController::class);
    
    // Additional routes for experiments under missions
    Route::prefix('missions/{mission}')->group(function () {
        Route::get('experiments', [\App\Http\Controllers\Api\ExperimentController::class, 'indexByMission']);
        Route::post('experiments', [\App\Http\Controllers\Api\ExperimentController::class, 'store']);
    });
    
    // Additional routes for publications related to experiments
    Route::prefix('experiments/{experiment}')->group(function () {
        Route::get('publications', [\App\Http\Controllers\Api\PublicationController::class, 'indexByExperiment']);
        Route::post('publications', [\App\Http\Controllers\Api\PublicationController::class, 'store']);
        
        // Import publications for a specific experiment
        Route::post('import-publications', [\App\Http\Controllers\Api\PublicationController::class, 'import']);
    });
    
    // Publications statistics
    Route::get('publications/statistics', [\App\Http\Controllers\Api\PublicationController::class, 'statistics']);
    
    // Import multiple publications
    Route::post('publications/import', [\App\Http\Controllers\Api\PublicationController::class, 'import']);
    
    // Search endpoint
    Route::get('search', [\App\Http\Controllers\Api\SearchController::class, 'search']);
    
    // Dashboard statistics
    Route::get('dashboard/stats', function () {
        return response()->json([
            'missions' => [
                'total' => \App\Models\Mission::count(),
                'active' => \App\Models\Mission::where('status', 'active')->count(),
                'completed' => \App\Models\Mission::where('status', 'completed')->count(),
            ],
            'experiments' => [
                'total' => \App\Models\Experiment::count(),
                'by_status' => \App\Models\Experiment::selectRaw('status, count(*) as count')
                    ->groupBy('status')
                    ->pluck('count', 'status'),
            ],
            'publications' => [
                'total' => \App\Models\Publication::count(),
                'by_year' => \App\Models\Publication::selectRaw('YEAR(publication_date) as year, count(*) as count')
                    ->whereNotNull('publication_date')
                    ->groupBy('year')
                    ->orderBy('year', 'desc')
                    ->limit(5)
                    ->get(),
            ],
        ]);
    });
});
