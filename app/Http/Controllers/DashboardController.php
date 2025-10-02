<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;

class DashboardController extends Controller
{
    public function index()
    {
        // Charger les ressources depuis le fichier JSON
        $resourcesPath = resource_path('data/resources.json');
        $resources = [];
        
        if (file_exists($resourcesPath)) {
            $jsonContent = file_get_contents($resourcesPath);
            $resourcesData = json_decode($jsonContent, true);
            
            // Formater les ressources pour le frontend
            $resources = array_map(function($resource) {
                return [
                    'id' => $resource['id'],
                    'title' => $resource['title'],
                    'url' => $resource['url'],
                    'mission' => $this->extractMissionFromTitle($resource['title']),
                    'year' => $this->extractYearFromTitle($resource['title']),
                    'organization' => 'NASA', // Par défaut
                    'status' => 'Terminé', // Par défaut
                    'type' => 'document' // Par défaut
                ];
            }, $resourcesData);
        }

        return Inertia::render('Dashboard/DashboardPage', [
            'resources' => $resources
        ]);
    }
    
    /**
     * Extrait le nom de la mission depuis le titre
     */
    private function extractMissionFromTitle($title)
    {
        // Exemple: "Mice in Bion-M 1 space mission: training and selection"
        // Retourne "Bion-M 1"
        if (preg_match('/(Artemis|Bion-M|ISS|Mars|Apollo|Voyager|Hubble|Perseverance|Curiosity|Viking|Juno|Cassini|New Horizons|Dragon|Starliner|Orion|Gateway|Lunar Gateway|Artemis Base Camp)/i', $title, $matches)) {
            return $matches[1];
        }
        
        return 'Mission inconnue';
    }
    
    /**
     * Extrait l'année depuis le titre ou la date de publication si disponible
     */
    private function extractYearFromTitle($title)
    {
        // Essaye de trouver une année dans le titre (format 4 chiffres)
        if (preg_match('/\b(19|20)\d{2}\b/', $title, $matches)) {
            return $matches[0];
        }
        
        // Si aucune année n'est trouvée, retourne l'année actuelle
        return date('Y');
    }
}
