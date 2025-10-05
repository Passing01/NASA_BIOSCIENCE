<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class RateLimitChat
{
    /**
     * Nombre maximum de requêtes autorisées
     */
    protected $maxAttempts = 30; // Augmenté à 30 requêtes par minute

    /**
     * Délai en secondes avant réinitialisation du compteur
     */
    protected $decayMinutes = 1;

    /**
     * Gère une requête entrante.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // Désactiver le rate limiting en environnement local
        if (App::environment('local')) {
            return $next($request);
        }

        $key = 'chat_rate_limit:' . $request->ip();
        
        // Utilisation du cache en mémoire avec le driver 'array'
        $cache = app('cache')->driver('array');
        $attempts = $cache->get($key, 0);
        
        if ($attempts >= $this->maxAttempts) {
            return response()->json([
                'success' => false,
                'message' => 'Trop de requêtes. Veuillez réessayer dans une minute.'
            ], 429);
        }
        
        // Incrémenter et mettre à jour le compteur
        $cache->put($key, $attempts + 1, now()->addMinutes($this->decayMinutes));

        return $next($request);
}
