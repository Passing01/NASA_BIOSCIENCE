<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OpenAIService;
use App\Services\ChatCacheService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

class ChatController extends Controller
{
    protected $openAIService;
    protected $cacheService;

    public function __construct(OpenAIService $openAIService, ChatCacheService $cacheService)
    {
        $this->openAIService = $openAIService;
        $this->cacheService = $cacheService;
    }

    /**
     * Envoyer un message à l'IA et obtenir une réponse
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function sendMessage(Request $request)
    {
        try {
            $request->validate([
                'message' => 'required|string|max:1000',
                'context' => 'sometimes|array'
            ]);

            $message = trim($request->message);
            
            if (empty($message)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Le message ne peut pas être vide.'
                ], 400);
            }
            
            // Vérifier d'abord le cache
            $cachedResponse = $this->cacheService->getCachedResponse($message);
            if ($cachedResponse !== null) {
                return response()->json([
                    'success' => true,
                    'response' => $cachedResponse,
                    'cached' => true,
                    'timestamp' => now()->toDateTimeString()
                ]);
            }

            // Vérifier si c'est une question fréquente
            $isFrequent = $this->cacheService->isFrequentlyAsked($message);
            
            // Obtenir la réponse de l'IA
            $response = $this->openAIService->getResponse(
                $message,
                $request->input('context', []),
                $isFrequent // Mode rapide pour les questions fréquentes
            );

            // Si la réponse est vide ou une erreur, renvoyer une erreur
            if (empty($response)) {
                throw new \Exception('La réponse de l\'IA est vide.');
            }

            // Mettre en cache la réponse
            $this->cacheService->cacheResponse($message, $response);
            
            // Incrémenter le compteur de fréquence
            $this->cacheService->incrementQuestionFrequency($message);

            return response()->json([
                'success' => true,
                'response' => $response,
                'cached' => false,
                'is_frequent' => $isFrequent,
                'timestamp' => now()->toDateTimeString()
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur de validation',
                'errors' => $e->errors(),
                'timestamp' => now()->toDateTimeString()
            ], 422);
            
        } catch (\Exception $e) {
            Log::error('Erreur dans ChatController: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            
            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors du traitement de votre demande.',
                'error' => config('app.debug') ? $e->getMessage() : null,
                'timestamp' => now()->toDateTimeString()
            ], 500);
        }
    }

    /**
     * Obtenir les ressources disponibles pour le chat
     *
     * @return \Illuminate\Http\Response
     */
    public function getResources()
    {
        try {
            $resources = $this->openAIService->getResources();
            
            return response()->json([
                'success' => true,
                'data' => $resources,
                'count' => count($resources),
                'timestamp' => now()->toDateTimeString()
            ]);
            
        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération des ressources: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Impossible de charger les ressources.',
                'error' => config('app.debug') ? $e->getMessage() : null,
                'timestamp' => now()->toDateTimeString()
            ], 500);
        }
    }
}
