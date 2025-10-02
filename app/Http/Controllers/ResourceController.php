<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use App\Services\OpenAIService;

class ResourceController extends Controller
{
    protected $openAIService;

    public function __construct(OpenAIService $openAIService)
    {
        $this->openAIService = $openAIService;
    }

    /**
     * Afficher les détails d'une ressource
     */
    public function show($id)
    {
        try {
            $resource = $this->openAIService->getResourceContent($id);
            
            if (!$resource) {
                return response()->json([
                    'error' => 'Ressource non trouvée',
                    'id' => $id
                ], 404);
            }

            return Inertia::render('ResourceDetails/ResourceDetailsPage', [
                'resource' => $resource
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Erreur lors de la récupération de la ressource',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
