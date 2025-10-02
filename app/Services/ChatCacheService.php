<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class ChatCacheService
{
    /**
     * Durée de vie du cache en secondes (1 jour par défaut)
     */
    protected $ttl = 86400;

    /**
     * Obtenir une réponse en cache si elle existe
     *
     * @param string $message
     * @return string|null
     */
    public function getCachedResponse(string $message): ?string
    {
        $key = $this->generateCacheKey($message);
        return Cache::get($key);
    }

    /**
     * Stocker une réponse dans le cache
     *
     * @param string $message
     * @param string $response
     * @return void
     */
    public function cacheResponse(string $message, string $response): void
    {
        $key = $this->generateCacheKey($message);
        Cache::put($key, $response, now()->addSeconds($this->ttl));
    }

    /**
     * Générer une clé de cache unique pour un message
     *
     * @param string $message
     * @return string
     */
    protected function generateCacheKey(string $message): string
    {
        // Normaliser le message (minuscules, suppression des espaces superflus, etc.)
        $normalized = trim(strtolower($message));
        $normalized = preg_replace('/\s+/', ' ', $normalized);
        
        // Créer une clé de hachage unique
        return 'chat_response:' . md5($normalized);
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
