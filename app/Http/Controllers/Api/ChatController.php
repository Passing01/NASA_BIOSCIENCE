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
                'language' => 'sometimes|string|in:en,fr',
                'context' => 'sometimes|array',
                'resourceId' => 'sometimes|integer|exists:resources,id'
            ]);

            $message = trim($request->message);
            $language = $request->input('language', 'en'); // Par défaut en anglais
            
            if (empty($message)) {
                $errorMessage = $language === 'fr' 
                    ? 'Le message ne peut pas être vide.'
                    : 'Message cannot be empty.';
                    
                return response()->json([
                    'success' => false,
                    'message' => $errorMessage
                ], 400);
            }
            
            // Vérifier d'abord le cache (inclure la langue dans la clé de cache)
            $cacheKey = $language . '_' . md5($message);
            $cachedResponse = $this->cacheService->getCachedResponse($cacheKey);
            if ($cachedResponse !== null) {
                return response()->json([
                    'success' => true,
                    'response' => $cachedResponse,
                    'timestamp' => now()->toDateTimeString()
                ]);
            }

            // Vérifier si c'est une question fréquente
            // Si pas dans le cache, appeler le service OpenAI avec la langue
            $context = $request->input('context', []);
            $resourceId = $request->input('resourceId');
            
            // Ajouter la langue au contexte
            $context['user_language'] = $language;
            
            $response = $this->openAIService->getResponse(
                $message, 
                $context, 
                $resourceId
            );

            // Si la réponse est vide ou une erreur, renvoyer une erreur
            if (empty($response)) {
                throw new \Exception('La réponse de l\'IA est vide.');
            }

            // Mettre en cache la réponse avec la clé incluant la langue
            $this->cacheService->cacheResponse($cacheKey, [
                'message' => $response['message'] ?? '',
                'context' => $response['context'] ?? []
            ]);

            return response()->json([
                'success' => true,
                'response' => $response,
                'cached' => false,
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
