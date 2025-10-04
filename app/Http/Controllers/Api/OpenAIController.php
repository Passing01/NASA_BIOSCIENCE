<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OpenAIService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OpenAIController extends Controller
{
    protected $openAIService;

    public function __construct(OpenAIService $openAIService)
    {
        $this->openAIService = $openAIService;
    }

    /**
     * Streaming SSE endpoint pour le chat (réponses en temps réel)
     */
    public function chatStream(Request $request)
    {
        $request->validate([
            'message' => 'required|string',
            'context' => 'array',
            'resourceId' => 'nullable|integer',
        ]);

        $message = $request->input('message');
        $context = $request->input('context', []);
        $resourceId = $request->input('resourceId');

        $response = new StreamedResponse(function () use ($message, $context, $resourceId) {
            // Headers SSE
            header('Content-Type: text/event-stream');
            header('Cache-Control: no-cache');
            header('Connection: keep-alive');

            $flush = function () {
                @ob_flush();
                @flush();
            };

            // Envoyer un ping initial
            echo ": ping\n\n";
            $flush();

            $this->openAIService->streamResponse($message, $context, $resourceId, function (string $delta) use ($flush) {
                $payload = json_encode(['delta' => $delta]);
                echo "data: {$payload}\n\n";
                $flush();
            });

            // Fin du flux
            echo "event: done\n";
            echo "data: {}\n\n";
            $flush();
        });

        $response->headers->set('X-Accel-Buffering', 'no'); // Nginx
        $response->headers->set('Cache-Control', 'no-cache');

        return $response;
    }
    public function chat(Request $request)
    {
        $request->validate([
            'message' => 'required|string',
            'context' => 'array',
            'resourceId' => 'nullable|integer',
            'fastMode' => 'boolean|nullable'
        ]);

        try {
            $response = $this->openAIService->getResponse(
                message: $request->input('message'),
                context: $request->input('context', []),
                fastMode: $request->boolean('fastMode', false),
                resourceId: $request->input('resourceId')
            );

            $suggested = $this->openAIService->getSuggestedQuestions($request->message);

            // Renvoyer à la fois au niveau racine et dans 'data' pour compatibilité front
            return response()->json([
                'response' => $response,
                'suggested_questions' => $suggested,
                'data' => [
                    'response' => $response,
                    'suggested_questions' => $suggested,
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Erreur dans OpenAIController@chat: ' . $e->getMessage());
            return response()->json([
                'error' => 'Une erreur est survenue lors du traitement de votre requête',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Récupérer toutes les ressources
     */
    public function getResources()
    {
        try {
            $resources = $this->openAIService->getAllResources();
            return response()->json([
                'data' => $resources
            ]);
        } catch (\Exception $e) {
            \Log::error('Erreur dans OpenAIController@getResources: ' . $e->getMessage());
            return response()->json([
                'error' => 'Impossible de récupérer les ressources',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Liste enrichie pour le dashboard
     */
    public function getEnrichedResources()
    {
        try {
            $resources = $this->openAIService->getEnrichedResources();
            return response()->json([
                'data' => $resources
            ]);
        } catch (\Exception $e) {
            \Log::error('Erreur dans OpenAIController@getEnrichedResources: ' . $e->getMessage());
            return response()->json([
                'error' => 'Impossible de récupérer les ressources enrichies',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    public function getResourceContent($id)
    {
        try {
            $resource = $this->openAIService->getResourceContent($id);
            
            if (!$resource) {
                return response()->json([
                    'error' => 'Resource not found',
                    'message' => 'The requested resource was not found.'
                ], 404);
            }
            
            return response()->json([
                'data' => $resource
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Error in getResourceContent: ' . $e->getMessage());
            return response()->json([
                'error' => 'Internal Server Error',
                'message' => 'An error occurred while processing your request.'
            ], 500);
        }
    }

    /**
     * Résumé IA d'une ressource
     */
    public function summarize($id)
    {
        try {
            $html = $this->openAIService->summarizeResource((int)$id);
            return response()->json(['summary' => $html]);
        } catch (\Exception $e) {
            \Log::error('Erreur summarize: ' . $e->getMessage());
            return response()->json(['summary' => 'Résumé indisponible.'], 500);
        }
    }

    /**
     * Mots-clés IA d'une ressource
     */
    public function keywords($id)
    {
        try {
            $tags = $this->openAIService->extractKeywords((int)$id);
            return response()->json(['keywords' => $tags]);
        } catch (\Exception $e) {
            \Log::error('Erreur keywords: ' . $e->getMessage());
            return response()->json(['keywords' => []], 500);
        }
    }

    /**
     * Ressources liées suggérées
     */
    public function related($id)
    {
        try {
            $related = $this->openAIService->suggestRelated((int)$id);
            return response()->json(['related' => $related]);
        } catch (\Exception $e) {
            \Log::error('Erreur related: ' . $e->getMessage());
            return response()->json(['related' => []], 500);
        }
    }

    /**
     * Expériences dérivées des ressources (pour le Dashboard)
     */
    public function experiments()
    {
        try {
            $experiments = $this->openAIService->getExperiments();
            return response()->json(['data' => $experiments]);
        } catch (\Exception $e) {
            \Log::error('Erreur experiments: ' . $e->getMessage());
            return response()->json(['data' => []], 500);
        }
    }
}
