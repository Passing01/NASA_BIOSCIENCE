<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class RateLimitChat
{
    /**
     * Nombre maximum de requêtes autorisées
     */
    protected $maxAttempts = 10;

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
        $key = 'chat_rate_limit:' . $request->ip();
        
        // Vérifier le nombre de tentatives
        if (Cache::has($key)) {
            $attempts = (int) Cache::get($key);
            
            if ($attempts >= $this->maxAttempts) {
                return response()->json([
                    'success' => false,
                    'message' => 'Trop de requêtes. Veuillez réessayer dans une minute.'
                ], 429);
            }
            
            // Incrémenter le compteur
            Cache::put($key, $attempts + 1, now()->addMinutes($this->decayMinutes));
        } else {
            // Initialiser le compteur
            Cache::put($key, 1, now()->addMinutes($this->decayMinutes));
        }

        return $next($request);
    }
}
