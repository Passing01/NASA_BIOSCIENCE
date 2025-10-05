<?php

namespace App\Services;

use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Cache;

class ChatCacheService
{
    /**
     * Durée de vie du cache en secondes (1 jour par défaut)
     */
    protected $ttl = 86400;
    
    /**
     * Instance du cache
     */
    protected $cache;
    
    public function __construct()
    {
        // Utiliser le driver 'array' pour le cache en mémoire
        $this->cache = app('cache')->driver('array');
    }

    /**
     * Obtenir une réponse en cache si elle existe
     *
     * @param string $cacheKey
     * @return string|null
     */
    public function getCachedResponse(string $cacheKey): ?string
    {
        // Désactiver le cache en environnement local
        if (App::environment('local')) {
            return null;
        }
        
        return $this->cache->get($cacheKey);
    }

    /**
     * Stocker une réponse dans le cache
     *
     * @param string $cacheKey
     * @param string $response
     * @return void
     */
    public function cacheResponse(string $cacheKey, string $response): void
    {
        // Ne pas mettre en cache en environnement local
        if (App::environment('local')) {
            return;
        }
        
        $this->cache->put($cacheKey, $response, now()->addSeconds($this->ttl));
    }

    /**
     * Générer une clé de cache unique pour un message
     *
     * @param string $message
     * @return string
     */
    protected function generateCacheKey(string $message): string
    {
        // Utiliser directement la clé fournie (déjà générée dans le contrôleur)
        return $message;
    }

    /**
     * Vérifier si une question est fréquemment posée
     * 
     * @param string $message
     * @return bool
     */
    public function isFrequentlyAsked(string $message): bool
    {
        $key = 'frequent_question:' . $this->generateCacheKey($message);
        $count = (int) Cache::get($key, 0);
        
        // Si la question a été posée plus de 3 fois, elle est considérée comme fréquente
        return $count > 3;
    }

    /**
     * Incrémenter le compteur de fréquence pour une question
     * 
     * @param string $message
     * @return void
     */
    public function incrementQuestionFrequency(string $message): void
    {
        $key = 'frequent_question:' . $this->generateCacheKey($message);
        
        if (Cache::has($key)) {
            Cache::increment($key);
        } else {
            Cache::put($key, 1, now()->addDays(7)); // Conserver le compteur pendant 7 jours
        }
    }
}
