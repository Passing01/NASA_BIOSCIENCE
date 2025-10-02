<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OpenAIService;
use Illuminate\Http\Request;

class ResourceController extends Controller
{
    protected $openAIService;

    public function __construct(OpenAIService $openAIService)
    {
        $this->openAIService = $openAIService;
    }

    public function index(Request $request)
    {
        $search = $request->query('search');
        
        if ($search) {
            $resources = $this->openAIService->searchResources($search);
        } else {
            $resources = $this->openAIService->getAllResources();
        }
        
        return response()->json([
            'data' => array_values($resources) // Réindexer le tableau pour s'assurer qu'il est sérialisé correctement en JSON
        ]);
    }

    /**
     * Récupérer les détails d'une ressource spécifique
     */
    public function show($id)
    {
        $resource = $this->openAIService->getResourceContent($id);
        
        if (!$resource) {
            return response()->json([
                'error' => 'Ressource non trouvée'
            ], 404);
        }
        
        return response()->json([
            'data' => $resource
        ]);
    }
    
    /**
     * Récupérer le contenu d'une ressource
     */
    public function content($id)
    {
        try {
            // Convertir l'ID en entier (les indices du tableau commencent à 0)
            $resourceIndex = (int)$id - 1;
            
            // Récupérer la ressource directement par son index
            $resource = $this->openAIService->getResourceContent($resourceIndex);
            
            if (!$resource) {
                return response()->json([
                    'error' => 'Ressource non trouvée',
                    'id_demande' => $id,
                    'ressources_disponibles' => $this->openAIService->getAllResources()
                ], 404);
            }
            
            return response()->json([
                'data' => [
                    'id' => $id,
                    'title' => $resource['title'],
                    'content' => $resource['content'] ?? 'Aucun contenu disponible',
                    'url' => $resource['url']
                ]
            ]);
            
        } catch (\Exception $e) {
            \Log::error('Erreur dans ResourceController@content: ' . $e->getMessage());
            return response()->json([
                'error' => 'Une erreur est survenue lors de la récupération de la ressource',
                'details' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ], 500);
        }
    }
}
