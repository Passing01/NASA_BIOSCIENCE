<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OpenAIService;
use App\Services\ChatCacheService;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
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
     */
    public function sendMessage(Request $request)
    {
        try {
            $validated = $request->validate([
                'message' => 'required|string',
                'language' => 'sometimes|string|in:en,fr',
                'resourceId' => [
                    'nullable',
                    'integer',
                    function ($attribute, $value, $fail) {
                        if ($value) {
                            $resourcesJson = File::get(resource_path('data/resources.json'));
                            $resources = json_decode($resourcesJson, true);
                            $resourceExists = collect($resources)->contains('id', $value);
                            
                            if (!$resourceExists) {
                                $fail('La ressource sélectionnée n\'existe pas.');
                            }
                        }
                    }
                ],
                'context' => 'sometimes|array'
            ]);

            $message = $request->input('message');
            $language = $request->input('language', 'en');
            $resourceId = $request->input('resourceId');
            $context = $request->input('context', []);

            // Si une ressource est fournie, on l'ajoute au contexte
            if ($resourceId) {
                $resourcesJson = File::get(resource_path('data/resources.json'));
                $resources = json_decode($resourcesJson, true);
                
                // Trouver la ressource par son ID
                $resource = collect($resources)->firstWhere('id', $resourceId);
                
                if ($resource) {
                    $context['resource'] = [
                        'id' => $resource['id'],
                        'title' => $resource['name'] ?? $resource['title'] ?? 'Sans titre',
                        'content' => $resource['content'] ?? $resource['description'] ?? ''
                    ];
                }
            }

            // Vérifier si la réponse est en cache
            $cacheKey = 'chat_' . md5($message . ($resourceId ?? '') . $language);
            $cachedResponse = $this->cacheService->getCachedResponse($cacheKey);
            
            if ($cachedResponse) {
                return response()->json([
                    'success' => true,
                    'message' => $cachedResponse,
                    'cached' => true,
                    'timestamp' => now()->toDateTimeString()
                ]);
            }

            // Appeler le service d'IA avec ou sans ressource
            $context['user_language'] = $language;
            
            $response = $this->openAIService->getResponse(
                $message,
                $context,
                false, // fastMode
                $resourceId
            );

            // Si la réponse est vide ou une erreur, renvoyer une erreur
            if (empty($response)) {
                throw new \Exception('La réponse de l\'IA est vide.');
            }

            // Mettre en cache la réponse avec la clé incluant la langue
            $this->cacheService->cacheResponse($cacheKey, $response);

            return response()->json([
                'success' => true,
                'message' => $response,
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
