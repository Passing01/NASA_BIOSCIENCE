<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Handler\CurlHandler;
use GuzzleHttp\HandlerStack;

class OpenAIService
{
    protected $client;
    // protected $ollamaHost; // [Ollama] Commenté pour bascule vers Gemini
    // protected $ollamaModel; // [Ollama] Commenté pour bascule vers Gemini
    // Gemini configuration
    protected $geminiApiKey;
    protected $geminiModel;
    protected $resources = [];
    
    /**
     * Fichier de ressources
     */
    protected $resourcesFile;

    /**
     * État de la conversation
     */
    protected $conversationState = [
        'language' => 'en',
        'waiting_for_question' => true,
        'waiting_for_summary_confirmation' => false,
        'waiting_for_detail_confirmation' => false,
        'current_publications' => []
    ];

    public function __construct()
    {
        // Configuration de l'API Gemini
        $this->geminiApiKey = (string) config('gemini.api_key', '');
        $this->geminiModel = (string) config('gemini.model', 'gemini-2.5-flash');
        $this->resourcesFile = resource_path('data/resources.json');
        
        // Charger les ressources au démarrage
        $this->loadResources();
        
        // Configuration du client HTTP
        $clientOptions = [
            'base_uri' => 'https://generativelanguage.googleapis.com',
            'timeout' => 60,
            'headers' => [
                'Content-Type' => 'application/json',
                'x-goog-api-key' => $this->geminiApiKey,
            ],
        ];
        $verifyConfig = config('gemini.verify', true);
        $cafile = config('gemini.cafile');
        // If verify=false, force disable verification and ignore cafile
        if ($verifyConfig === false || $verifyConfig === 'false' || $verifyConfig === 0 || $verifyConfig === '0') {
            $verifyOption = false;
        } else {
            // Use CA bundle only if it exists and is readable; otherwise fallback to boolean verify
            $verifyOption = true;
            if (is_string($cafile) && $cafile !== '') {
                // Normalize backslashes in Windows paths
                $normalizedPath = str_replace('\\\\', DIRECTORY_SEPARATOR, $cafile);
                if (@file_exists($normalizedPath) && @is_readable($normalizedPath)) {
                    $verifyOption = $normalizedPath;
                } else {
                    Log::warning('GEMINI_CA_BUNDLE introuvable ou illisible: ' . $cafile . '. Retour à verify=true');
                }
            }
        }
        $proxy = config('gemini.proxy');

        $clientOptions = [
            'base_uri' => 'https://generativelanguage.googleapis.com',
            'timeout' => (int) config('gemini.timeout', 60),
            'connect_timeout' => (int) config('gemini.connect_timeout', 10),
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                // Send API key as header to avoid proxy issues with query params
                'x-goog-api-key' => $this->geminiApiKey,
            ],
            'verify' => $verifyOption,
        ];
        if (!empty($proxy)) {
            $clientOptions['proxy'] = $proxy;
        }

        // Force CurlHandler for consistent SSL on Windows
        $handler = new CurlHandler();
        $stack = HandlerStack::create($handler);
        $clientOptions['handler'] = $stack;

        // If verification is disabled, also set cURL flags explicitly
        if ($verifyOption === false) {
            $clientOptions['curl'] = [
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => 0,
            ];
        }

        $this->client = new GuzzleClient($clientOptions);

        $this->loadResources();

        if (empty($this->geminiApiKey)) {
            Log::warning('GEMINI_API_KEY manquant. Veuillez définir GEMINI_API_KEY dans votre fichier .env.');
        }
    }

    /**
     * Stream a response from Gemini and call $onChunk with incremental text.
     * The callback signature is function(string $delta): void
     */
    /**
     * Gère le flux de conversation
     */
    protected function handleConversationFlow(string $message, array &$context, ?int $resourceId, callable $onChunk): bool
    {
        $normalized = mb_strtolower(trim($message));
        
        // Étape 1: Demander la langue si c'est le début de la conversation
        if ($this->conversationState['waiting_for_question'] && empty($context)) {
            $this->conversationState['language'] = 'en'; // Par défaut en anglais
            $greeting = "In which language would you like to communicate? (English/Français)";
            if ($onChunk) $onChunk($greeting);
            return true;
        }
        
        // Vérifier la langue sélectionnée
        if (preg_match('/(français|francais|french|fr)\b/i', $normalized)) {
            $this->conversationState['language'] = 'fr';
            $response = "Parfait ! En quoi puis-je vous aider aujourd'hui ?";
        } elseif (preg_match('/(english|en|anglais)\b/i', $normalized)) {
            $this->conversationState['language'] = 'en';
            $response = "Great! How can I assist you today?";
        } else if ($this->conversationState['waiting_for_question']) {
            // Si on attend une question et qu'aucune langue n'est détectée, on passe à l'étape suivante
            $this->conversationState['waiting_for_question'] = false;
            return false;
        }
        
        if (isset($response) && $onChunk) {
            $onChunk($response);
            return true;
        }
        
        // Gestion des réponses oui/non pour les résumés
        if ($this->conversationState['waiting_for_summary_confirmation']) {
            if (preg_match('/(oui|yes|ouais|bien sûr|bien sur|d\'accord|ok|okay|bien|avec plaisir)\b/i', $normalized)) {
                // Générer un résumé court
                $this->generateSummary($context, $onChunk);
                $this->conversationState['waiting_for_summary_confirmation'] = false;
                $this->conversationState['waiting_for_detail_confirmation'] = true;
                
                // Demander si l'utilisateur veut plus de détails
                $followUp = $this->conversationState['language'] === 'fr' ? 
                    "\n\nSouhaitez-vous une explication plus détaillée ? (Oui/Non)" :
                    "\n\nWould you like a more detailed explanation? (Yes/No)";
                
                if ($onChunk) $onChunk($followUp);
                return true;
            } else {
                $response = $this->conversationState['language'] === 'fr' ?
                    "Très bien. N'hésitez pas si vous avez d'autres questions !" :
                    "Very well. Feel free to ask if you have any other questions!";
                if ($onChunk) $onChunk($response);
                $this->resetConversationState();
                return true;
            }
        }
        
        // Gestion des réponses pour les détails supplémentaires
        if ($this->conversationState['waiting_for_detail_confirmation']) {
            if (preg_match('/(oui|yes|ouais|bien sûr|bien sur|d\'accord|ok|okay|bien|avec plaisir)\b/i', $normalized)) {
                // Générer une explication détaillée
                $this->generateDetailedExplanation($context, $onChunk);
            } else {
                $response = $this->conversationState['language'] === 'fr' ?
                    "Très bien. N'hésitez pas si vous avez d'autres questions !" :
                    "Very well. Feel free to ask if you have any other questions!";
                if ($onChunk) $onChunk($response);
            }
            $this->resetConversationState();
            return true;
        }
        
        return false;
    }
    
    /**
     * Recherche des publications pertinentes dans resources.json
     */
    protected function searchPublications(string $query): array
    {
        try {
            // Charger les ressources depuis le fichier JSON
            $resources = json_decode(file_get_contents($this->resourcesFile), true);
            
            if (empty($resources)) {
                Log::warning('Aucune ressource trouvée dans le fichier resources.json');
                return [];
            }
            
            // Préparer la requête pour la recherche
            $query = strtolower(trim($query));
            $keywords = array_filter(explode(' ', $query), function($word) {
                return strlen($word) > 2; // Ignorer les mots trop courts
            });
            
            // Recherche par mots-clés dans le titre
            $results = [];
            foreach ($resources as $resource) {
                if (!isset($resource['title']) || !isset($resource['id'])) continue;
                
                $title = strtolower($resource['title']);
                $score = 0;
                
                // Calculer un score de pertinence basé sur les mots-clés
                foreach ($keywords as $keyword) {
                    if (strpos($title, $keyword) !== false) {
                        $score++;
                    }
                }
                
                if ($score > 0) {
                    $results[] = [
                        'id' => $resource['id'],
                        'title' => $resource['title'],
                        'url' => $resource['url'] ?? '#',
                        'score' => $score
                    ];
                }
            }
            
            // Trier par score décroissant
            usort($results, function($a, $b) {
                return $b['score'] <=> $a['score'];
            });
            
            return array_slice($results, 0, 5); // Retourner les 5 meilleurs résultats
            
        } catch (\Exception $e) {
            Log::error('Erreur lors de la recherche de publications: ' . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Génère un résumé court des publications
     */
    protected function generateSummary(array $context, ?callable $onChunk): void
    {
        $summary = $this->conversationState['language'] === 'fr' ?
            "Voici un bref résumé des publications pertinentes :\n\n" :
            "Here's a brief summary of relevant publications:\n\n";
        
        // Récupérer les publications pertinentes
        $publications = $this->conversationState['current_publications'] ?? [];
        
        if (empty($publications)) {
            $noResults = $this->conversationState['language'] === 'fr' ?
                "Aucune publication pertinente trouvée dans notre base de données. Je vais effectuer une recherche plus large..." :
                "No relevant publications found in our database. I'll perform a broader search...";
                
            if ($onChunk) $onChunk($noResults);
            
            // Ici, vous pourriez ajouter une logique pour chercher dans d'autres sources
            // Par exemple, appeler une API externe ou effectuer une recherche web
            
            return;
        }
        
        // Générer le résumé pour chaque publication
        foreach ($publications as $pub) {
            $summary .= "- " . ($pub['title'] ?? 'Sans titre') . "\n";
            
            // Ajouter l'URL si disponible
            if (!empty($pub['url'])) {
                $summary .= "  " . $pub['url'] . "\n";
            }
            
            $summary .= "\n";
        }
        
        if ($onChunk) $onChunk($summary);
    }
    
    /**
     * Génère une explication détaillée
     */
    protected function generateDetailedExplanation(array $context, ?callable $onChunk): void
    {
        // Implémentez ici la génération d'une explication détaillée
        $details = $this->conversationState['language'] === 'fr' ?
            "Voici une explication plus détaillée :\n\n" :
            "Here's a more detailed explanation:\n\n";
        
        // Exemple d'explication détaillée (à adapter)
        $details .= "1. Détail important 1 avec plus d'informations...\n";
        $details .= "2. Détail important 2 avec plus d'informations...\n";
        
        if ($onChunk) $onChunk($details);
    }
    
    /**
     * Réinitialise l'état de la conversation
     */
    protected function resetConversationState(): void
    {
        $this->conversationState = [
            'language' => 'en',
            'waiting_for_question' => true,
            'waiting_for_summary_confirmation' => false,
            'waiting_for_detail_confirmation' => false,
            'current_publications' => []
        ];
    }
    
    public function streamResponse(string $message, array $context = [], ?int $resourceId = null, callable $onChunk = null)
    {
        // Étendre le temps d'exécution
        if (function_exists('set_time_limit')) {
            // @set_time_limit((int) config('ollama.timeout', 300)); // [Ollama]
            @set_time_limit((int) config('gemini.timeout', 60));
        }

        // Vérifier la clé API Gemini
        if (empty($this->geminiApiKey)) {
            if ($onChunk) {
                $onChunk("[Configuration] GEMINI_API_KEY manquant. Ajoutez GEMINI_API_KEY dans votre .env et redémarrez l'application.");
            }
            return;
        }

        // Intention spéciale: lister les ressources du site
        $normalized = mb_strtolower(trim($message));
        $askListResources = preg_match('/\b(lister|liste|affiche|montrer|donne|donnez|afficher)\b.*\b(ressources|resources)\b/u', $normalized)
                           || preg_match('/\b(toutes|tout|liste complète)\b.*\b(ressources|resources)\b/u', $normalized)
                           || preg_match('/\bressources du site|ressources disponibles|sur ce site\b/u', $normalized);

        if ($askListResources) {
            // Streamer la liste complète des ressources
            $items = [];
            foreach ($this->getAllResources() as $res) {
                $rid = $res['id'];
                $title = htmlspecialchars($res['title']);
                $url = htmlspecialchars($res['url']);
                $linkApp = '/resources/' . $rid;
                $items[] = "- {$title} (" . $linkApp . ") — source: " . $url . "\n";
            }
            if ($onChunk) {
                $onChunk("Voici la liste des ressources disponibles sur la plateforme (" . count($items) . "):\n");
                foreach ($items as $line) { $onChunk($line); }
            }
            return;
        }

        // Gérer le flux de conversation
        if ($this->handleConversationFlow($message, $context, $resourceId, $onChunk)) {
            return;
        }

        // Construire le message système de base
        $systemMessage = $this->conversationState['language'] === 'fr' ?
            "Vous êtes un assistant d'IA expert en biosciences spatiales.\n" .
            "Si une ressource est fournie, répondez PRIORITAIREMENT en vous appuyant sur son contenu.\n" .
            "Sinon, répondez avec vos connaissances générales en biosciences spatiales.\n" .
            "Réponses: concises, factuelles, et avec références précises à la ressource quand pertinent.\n" .
            "Si la question sort du domaine des biosciences spatiales, répondez poliment que vous êtes spécialisé dans ce domaine." :
            "You are an AI assistant specialized in space biosciences.\n" .
            "If a resource is provided, prioritize using its content in your response.\n" .
            "Otherwise, respond using your general knowledge of space biosciences.\n" .
            "Responses should be: concise, factual, with precise references to the resource when relevant.\n" .
            "If the question is outside the domain of space biosciences, politely explain that you specialize in this field.";

        // Vérifier si c'est une question nécessitant des recommandations
        $isQuestion = !empty(trim($message)) && !in_array(strtolower(trim($message)), ['oui', 'non', 'yes', 'no', 'ok']);
        
        if ($isQuestion) {
            // Rechercher des publications pertinentes dans resources.json
            $publications = $this->searchPublications($message);
            $this->conversationState['current_publications'] = $publications;
            
            // Préparer le message de réponse
            if (empty($publications)) {
                $response = $this->conversationState['language'] === 'fr' ?
                    "Je n'ai pas trouvé de publications correspondant à votre recherche dans notre base de données. " .
                    "Je vais effectuer une recherche plus approfondie..." :
                    "I couldn't find any publications matching your search in our database. " .
                    "I'll perform a more thorough search...";
                
                if ($onChunk) $onChunk($response);
                
                // Ici, vous pourriez ajouter une logique pour chercher dans d'autres sources
                // Par exemple, appeler une API externe ou effectuer une recherche web
                
                return;
            }
            
            // Demander à l'utilisateur s'il veut un résumé
            $summaryQuestion = $this->conversationState['language'] === 'fr' ?
                "\n\nSouhaitez-vous un bref résumé de ces publications ? (Oui/Non)" :
                "\n\nWould you like a brief summary of these publications? (Yes/No)";
            
            $this->conversationState['waiting_for_summary_confirmation'] = true;
            
            // Afficher les recommandations
            $recommendations = $this->conversationState['language'] === 'fr' ?
                "J'ai trouvé " . count($publications) . " publications qui pourraient vous intéresser :\n" :
                "I found " . count($publications) . " publications you might be interested in:\n";
            
            foreach ($publications as $pub) {
                $recommendations .= "- " . ($pub['title'] ?? 'Sans titre') . "\n";
            }
            
            if ($onChunk) $onChunk($recommendations . $summaryQuestion);
            return;
        }
        
        // Gestion de la ressource sélectionnée
        $resource = null;
        if ($resourceId) {
            try {
                Log::info("Tentative de chargement de la ressource ID: " . $resourceId);
                $resource = $this->getResourceContent($resourceId);
                
                if ($resource) {
                    $resourceLink = '[Ressource: ' . htmlspecialchars($resource['title']) . '](' . $resource['url'] . ')';
                    $systemMessage .= "\n\nRESSOURCE ACTIVE: " . $resourceLink . "\n";
                    
                    // Ajouter le contenu de la ressource au contexte
                    $resourceContent = strip_tags($resource['content']);
                    $context[] = "CONTENU DE LA RESSOURCE \"" . $resource['title'] . "\" (à utiliser pour répondre) :\n" . 
                               substr($resourceContent, 0, 6000) . (strlen($resourceContent) > 6000 ? '...' : '');
                    
                    Log::info("Contenu de la ressource chargé avec succès. Taille : " . strlen($resource['content']) . " caractères");
                } else {
                    Log::warning("La ressource avec l'ID $resourceId n'a pas pu être chargée");
                    $context[] = "ATTENTION: La ressource demandée n'a pas pu être chargée. Répondez en vous basant sur vos connaissances générales.";
                }
            } catch (\Exception $e) {
                Log::error('Erreur lors du chargement de la ressource: ' . $e->getMessage());
                $context[] = "ERREUR: Impossible de charger la ressource demandée. " . 
                           "Veuillez me poser votre question directement ou sélectionner une autre ressource.";
            }
        }

        $messages = [ ['role' => 'system', 'content' => $systemMessage] ];
        foreach ($context as $msg) {
            if (is_array($msg)) {
                $messages[] = [
                    'role' => ($msg['role'] ?? 'assistant') === 'user' ? 'user' : 'assistant',
                    'content' => is_string($msg['content'] ?? null) ? strip_tags($msg['content']) : '',
                ];
            } elseif (is_string($msg)) {
                $messages[] = ['role' => 'system', 'content' => $msg];
            }
        }
        $messages[] = ['role' => 'user', 'content' => $message];

        try {
            // Construire le payload Gemini avec une meilleure structure
            $formattedMessages = [];
            
            // Ajouter le message système en premier
            if (!empty($systemMessage)) {
                $formattedMessages[] = [
                    'role' => 'user',
                    'parts' => [['text' => $systemMessage]]
                ];
            }
            
            // Ajouter le contexte
            foreach ($context as $msg) {
                if (is_string($msg) && trim($msg) !== '') {
                    $formattedMessages[] = [
                        'role' => 'user',
                        'parts' => [['text' => trim($msg)]]
                    ];
                }
            }
            
            // Ajouter le message utilisateur final
            $formattedMessages[] = [
                'role' => 'user',
                'parts' => [['text' => $message]]
            ];
            
            $payload = [
                'contents' => $formattedMessages,
                'generationConfig' => [
                    'temperature' => 0.7,
                    'topP' => 0.9,
                    'topK' => 40,
                    'maxOutputTokens' => 2048,
                ],
                'safetySettings' => [
                    [
                        'category' => 'HARM_CATEGORY_HARASSMENT',
                        'threshold' => 'BLOCK_NONE'
                    ],
                    [
                        'category' => 'HARM_CATEGORY_HATE_SPEECH',
                        'threshold' => 'BLOCK_NONE'
                    ],
                    [
                        'category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                        'threshold' => 'BLOCK_NONE'
                    ],
                    [
                        'category' => 'HARM_CATEGORY_DANGEROUS_CONTENT',
                        'threshold' => 'BLOCK_NONE'
                    ]
                ]
            ];
            
            Log::debug('Payload envoyé à Gemini:', ['payload' => $payload]);

            $uri = sprintf('/v1/models/%s:streamGenerateContent', rawurlencode($this->geminiModel));

            $resp = $this->client->post($uri, [
                'stream' => true,
                'json' => $payload,
            ]);

            $body = $resp->getBody();
            while (!$body->eof()) {
                $chunk = $body->read(8192);
                if (!$chunk) { continue; }
                $lines = preg_split('/\r?\n/', $chunk);
                foreach ($lines as $line) {
                    $line = trim($line);
                    if ($line === '') continue;
                    // Certaines implémentations renvoient des objets JSON par ligne
                    $data = json_decode($line, true);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        continue;
                    }
                    // Extraire le texte des candidats
                    if (isset($data['candidates'][0]['content']['parts'])) {
                        foreach ($data['candidates'][0]['content']['parts'] as $part) {
                            $delta = (string) ($part['text'] ?? '');
                            if ($delta !== '' && $onChunk) { $onChunk($delta); }
                        }
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Erreur streaming Gemini: ' . $e->getMessage(), [
                'exception' => $e,
            ]);
            // Fallback non-streaming pour toujours retourner une réponse
            try {
                $fallbackPayload = [
                    'contents' => [
                        [
                            'role' => 'user',
                            'parts' => [ ['text' => implode("\n\n", array_map(fn($m) => trim((string)($m['content'] ?? '')), $messages))] ],
                        ],
                    ],
                    'generationConfig' => [ 'temperature' => 0.7 ],
                ];
                $uri = sprintf('/v1/models/%s:generateContent', rawurlencode($this->geminiModel));
                $resp = $this->client->post($uri, [ 'json' => $fallbackPayload ]);
                $data = json_decode((string) $resp->getBody(), true);
                $text = '';
                if (isset($data['candidates'][0]['content']['parts'])) {
                    foreach ($data['candidates'][0]['content']['parts'] as $part) {
                        $text .= (string) ($part['text'] ?? '');
                    }
                }
                if ($onChunk) { $onChunk($text !== '' ? $text : "\n[Erreur] Impossible de récupérer la réponse en streaming."); }
            } catch (\Exception $e2) {
                Log::error('Erreur fallback non-streaming Gemini: ' . $e2->getMessage(), [ 'exception' => $e2 ]);
                if ($onChunk) { $onChunk("\n[Erreur] Impossible de récupérer la réponse en streaming."); }
            }
        }
    }

    /**
     * Charge les ressources depuis le fichier JSON
     */
    protected function loadResources()
    {
        if (!file_exists($this->resourcesFile)) {
            Log::error('Le fichier des ressources est introuvable : ' . $this->resourcesFile);
            $this->resources = [];
            return;
        }
        
        try {
            $jsonContent = file_get_contents($this->resourcesFile);
            if ($jsonContent === false) {
                throw new \Exception('Impossible de lire le fichier des ressources');
            }
            
            $resources = json_decode($jsonContent, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Erreur de décodage JSON: ' . json_last_error_msg());
            }
            
            $this->resources = [];
            foreach ($resources as $index => $resource) {
                $this->resources[$index + 1] = [
                    'id' => $index + 1, // Les IDs commencent à 1
                    'url' => $resource['url'] ?? '',
                    'title' => $resource['title'] ?? 'Sans titre',
                    'description' => $resource['title'] ?? 'Sans description',
                    'content' => '' // Chargé à la demande
                ];
            }
            
            Log::info(sprintf('Chargement de %d ressources depuis le fichier JSON', count($this->resources)));
            
        } catch (\Exception $e) {
            Log::error('Erreur lors du chargement des ressources: ' . $e->getMessage());
            $this->resources = [];
        }
    }

    /**
     * Obtenir une réponse de l'IA
     *
     * @param string $message
     * @param array $context
     * @param bool $fastMode Si vrai, utilise un modèle plus rapide pour les questions fréquentes
     * @return string
     */
    // Dernier horaire d'appel à l'API
    protected $lastApiCall = null;

    /**
     * Obtenir une réponse de l'IA avec gestion des limites de taux
     */
    public function getResponse(string $message, array $context = [], bool $fastMode = false, ?int $resourceId = null)
    {
        // Utiliser le modèle Gemini défini
        $model = $this->geminiModel;
        
        // Construire le message système en fonction du contexte et de la langue
        $language = $context['user_language'] ?? 'fr';
        
        $systemMessage = $language === 'fr' 
            ? "Vous êtes un assistant d'IA expert en biosciences spatiales. "
            : "You are an AI assistant specialized in space biosciences. ";
            
        if (isset($context['resource'])) {
            $resource = $context['resource'];
            $systemMessage .= $language === 'fr'
                ? "\n\nVous répondez en vous basant sur la ressource fournie. "
                    . "Si la question n'est pas en rapport avec cette ressource, répondez en utilisant vos connaissances générales en biosciences spatiales.\n"
                    . "Titre de la ressource: " . ($resource['title'] ?? 'Inconnu') . "\n"
                    . "Contenu: " . substr($resource['content'] ?? '', 0, 2000) . (strlen($resource['content'] ?? '') > 2000 ? '...' : '')
                : "\n\nYou are responding based on the provided resource. "
                    . "If the question is not related to this resource, respond using your general knowledge of space biosciences.\n"
                    . "Resource title: " . ($resource['title'] ?? 'Unknown') . "\n"
                    . "Content: " . substr($resource['content'] ?? '', 0, 2000) . (strlen($resource['content'] ?? '') > 2000 ? '...' : '');
        } else {
            $systemMessage .= $language === 'fr'
                ? "\n\nVous répondez en utilisant vos connaissances générales en biosciences spatiales. "
                    . "Si la question sort de ce domaine, expliquez poliment que vous êtes spécialisé dans les biosciences spatiales."
                : "\n\nYou respond using your general knowledge of space biosciences. "
                    . "If the question is outside this domain, politely explain that you specialize in space biosciences.";
        }
        
        // Log de débogage
        Log::info('Début de getResponse', [
            'model' => $model,
            'has_api_key' => !empty($this->geminiApiKey),
            'resource_id' => $resourceId,
            'context_count' => count($context)
        ]);

        // Étendre le temps d'exécution PHP pour laisser le modèle répondre
        if (function_exists('set_time_limit')) {
            // @set_time_limit((int) config('ollama.timeout', 300)); // [Ollama]
            @set_time_limit((int) config('gemini.timeout', 60));
        }

        // Intention spéciale: lister les ressources du site
        $normalized = mb_strtolower(trim($message));
        $askListResources = preg_match('/\b(lister|liste|affiche|montrer|donne|donnez|afficher)\b.*\b(ressources|resources)\b/u', $normalized)
                           || preg_match('/\b(toutes|tout|liste complète)\b.*\b(ressources|resources)\b/u', $normalized)
                           || preg_match('/\bressources du site|ressources disponibles|sur ce site\b/u', $normalized);

        if ($askListResources) {
            // Construire une liste HTML de toutes les ressources connues
            $items = [];
            foreach ($this->getAllResources() as $res) {
                $rid = $res['id'];
                $title = htmlspecialchars($res['title']);
                $url = htmlspecialchars($res['url']);
                $linkApp = '/resources/' . $rid;
                $items[] = '<li><a href="' . $linkApp . '" target="_blank" style="color:#1a73e8;text-decoration:underline;">' . $title . '</a> — <a href="' . $url . '" target="_blank">source</a></li>';
            }
            $html = '<p>Voici la liste des ressources disponibles sur la plateforme (' . count($items) . '):</p><ul>' . implode('', $items) . '</ul>';
            return $html;
        }

        // Préparer le message système en fonction du contexte et de la langue
        $language = $context['user_language'] ?? 'fr';
        
        $systemMessage = $language === 'fr' 
            ? "Vous êtes un assistant d'IA expert en biosciences spatiales. "
            : "You are an AI assistant specialized in space biosciences. ";
            
        if (isset($context['resource'])) {
            $resource = $context['resource'];
            $systemMessage .= $language === 'fr'
                ? "\n\nVous répondez en vous basant sur la ressource fournie. "
                    . "Si la question n'est pas en rapport avec cette ressource, répondez en utilisant vos connaissances générales en biosciences spatiales.\n"
                    . "Titre de la ressource: " . ($resource['title'] ?? 'Inconnu') . "\n"
                    . "Contenu: " . substr($resource['content'] ?? '', 0, 2000) . (strlen($resource['content'] ?? '') > 2000 ? '...' : '')
                : "\n\nYou are responding based on the provided resource. "
                    . "If the question is not related to this resource, respond using your general knowledge of space biosciences.\n"
                    . "Resource title: " . ($resource['title'] ?? 'Unknown') . "\n"
                    . "Content: " . substr($resource['content'] ?? '', 0, 2000) . (strlen($resource['content'] ?? '') > 2000 ? '...' : '');
        } else {
            $systemMessage .= $language === 'fr'
                ? "\n\nVous répondez en utilisant vos connaissances générales en biosciences spatiales. "
                    . "Si la question sort de ce domaine, expliquez poliment que vous êtes spécialisé dans les biosciences spatiales."
                : "\n\nYou respond using your general knowledge of space biosciences. "
                    . "If the question is outside this domain, politely explain that you specialize in space biosciences.";
        }

        $messages = [
            ['role' => 'system', 'content' => $systemMessage]
        ];

        // Ajouter le contexte de la conversation
        if (is_array($context)) {
            foreach ($context as $msg) {
                if (is_array($msg) && isset($msg['role'], $msg['content'])) {
                    $messages[] = [
                        'role' => $msg['role'] === 'user' ? 'user' : 'assistant',
                        'content' => is_string($msg['content']) ? strip_tags($msg['content']) : '',
                    ];
                } elseif (is_string($msg)) {
                    $messages[] = [
                        'role' => 'system',
                        'content' => strip_tags($msg),
                    ];
                }
            }
        }

        // Ajouter le message actuel
        $messages[] = ['role' => 'user', 'content' => $message];

        try {
            Log::info('Envoi de la requête à Gemini', [
                'model' => $model,
                'messages' => $messages,
                'resource_id' => $resourceId
            ]);

            // Préparer le payload pour Gemini
            $payload = [
                'contents' => array_map(function($msg) {
                    return [
                        'role' => $msg['role'] === 'assistant' ? 'model' : 'user',
                        'parts' => [['text' => $msg['content']]]
                    ];
                }, $messages),
                'generationConfig' => [
                    'temperature' => 0.7,
                    'maxOutputTokens' => 2000,
                    'topP' => 0.8,
                    'topK' => 40
                ]
            ];

            $uri = sprintf('/v1/models/%s:generateContent', rawurlencode($model));

            $resp = $this->client->post($uri, [ 'json' => $payload ]);

            $data = json_decode((string) $resp->getBody(), true);

            Log::info('Réponse reçue de Gemini', [ 'response' => $data ]);

            $text = '';
            if (isset($data['candidates'][0]['content']['parts'])) {
                foreach ($data['candidates'][0]['content']['parts'] as $part) {
                    $text .= (string) ($part['text'] ?? '');
                }
            }

            return $text !== '' ? $text : 'Désolé, je n\'ai pas pu générer de réponse.';
        } catch (\Exception $e) {
            $errorMessage = $e->getMessage();
            
            // Messages d'erreur plus conviviaux
            if (str_contains($errorMessage, 'rate limit')) {
                $errorMessage = 'Désolé, nous avons atteint la limite de requêtes pour le moment. ';
                $errorMessage .= 'Veuillez patienter une minute avant de réessayer.';
            } elseif (str_contains(strtolower($errorMessage), 'connection') || str_contains(strtolower($errorMessage), 'connect')) {
                $errorMessage = 'Impossible de se connecter à l\'API Gemini. Vérifiez votre connexion internet et la clé API.';
            } else {
                $errorMessage = 'Une erreur est survenue lors de la génération de la réponse. ';
                $errorMessage .= 'Veuillez réessayer plus tard.';
            }
            
            Log::error('Erreur Gemini: ' . $e->getMessage(), [
                'exception' => $e,
                'trace' => $e->getTraceAsString()
            ]);
            
            return $errorMessage;
        }
    }

    /**
     * Respecter les limites de taux de l'API
     */
    protected function respectRateLimit()
    {
        // Pas de limite stricte gérée ici (Gemini gère ses limites côté API)
        $this->lastApiCall = time();
    }

    /**
     * Récupérer toutes les ressources disponibles
     */
    public function getAllResources()
    {
        return array_map(function($index, $resource) {
            return [
                'id' => $index,
                'title' => $resource['title'],
                'description' => $resource['description'],
                'url' => $resource['url']
            ];
        }, array_keys($this->resources), $this->resources);
    }

    /**
     * Récupérer le contenu d'une ressource spécifique
     */
    public function getResourceContent($id)
    {
        $id = (int)$id;
        
        if (!isset($this->resources[$id])) {
            Log::error("Ressource non trouvée avec l'ID: " . $id);
            return null;
        }

        $resource = $this->resources[$id];
        
        // Si la ressource est déjà chargée, la retourner directement
        if (!empty($resource['content'])) {
            return $resource;
        }
        
        Log::info("Chargement du contenu pour la ressource: " . $resource['title']);
        
        try {
            // Utiliser cURL pour récupérer le contenu avec un en-tête User-Agent
            $ch = curl_init();
            
            // Configuration de cURL
            $options = [
                CURLOPT_URL => $resource['url'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                CURLOPT_SSL_VERIFYPEER => false, // À ne faire qu'en développement
                CURLOPT_TIMEOUT => 10,
            ];
            
            curl_setopt_array($ch, $options);
            
            $content = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            
            if (curl_errno($ch)) {
                throw new \Exception('Erreur cURL: ' . curl_error($ch));
            }
            
            curl_close($ch);
            
            if ($httpCode !== 200) {
                throw new \Exception("Erreur HTTP: $httpCode");
            }
            
            if ($content === false) {
                throw new \Exception("Impossible de récupérer le contenu de l'URL");
            }
            
            // Extraire le contenu pertinent
            $extractedContent = $this->extractMainContent($content);
            
            // Si le contenu est vide après extraction, utiliser un message par défaut
            if (empty($extractedContent)) {
                $extractedContent = "Contenu de la ressource '{$resource['title']}'. " .
                                 "Pour plus d'informations, consultez: {$resource['url']}";
            }
            
            // Mise à jour de la ressource dans le tableau
            $this->resources[$id]['content'] = $extractedContent;
            $resource['content'] = $extractedContent;
            
        } catch (\Exception $e) {
            $errorMsg = 'Erreur lors de la récupération de la ressource: ' . $e->getMessage();
            Log::error($errorMsg);
            $fallbackContent = "Désolé, je n'ai pas pu charger le contenu de cette ressource. " .
                            "Vous pouvez consulter directement la page à l'adresse : {$resource['url']}";
            
            $this->resources[$id]['content'] = $fallbackContent;
            $resource['content'] = $fallbackContent;
            
            // Propager l'erreur pour une meilleure gestion en amont
            throw new \Exception($errorMsg);
        }

        return array_merge($resource, ['id' => $id]);
    }

    /**
     * Extraire le contenu principal d'une page web avec mise en forme
     */
    protected function extractMainContent($html)
    {
        // Charger le contenu HTML dans un objet DOM
        $dom = new \DOMDocument();
        @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
        
        // Supprimer les éléments non désirés
        $this->removeElementsByTagName($dom, 'script');
        $this->removeElementsByTagName($dom, 'style');
        $this->removeElementsByTagName($dom, 'noscript');
        $this->removeElementsByTagName($dom, 'header');
        $this->removeElementsByTagName($dom, 'footer');
        $this->removeElementsByTagName($dom, 'nav');
        $this->removeElementsByTagName($dom, 'iframe');
        
        // Supprimer les éléments par classes et IDs courants des en-têtes et pieds de page
        $commonHeaderFooterSelectors = [
            '//*[contains(@class, "header")]',
            '//*[contains(@class, "footer")]',
            '//*[contains(@class, "navbar")]',
            '//*[contains(@class, "menu")]',
            '//*[contains(@class, "sidebar")]',
            '//*[contains(@id, "header")]',
            '//*[contains(@id, "footer")]',
            '//*[contains(@id, "navbar")]',
            '//*[contains(@id, "menu")]',
            '//*[contains(@id, "sidebar")]',
            '//*[contains(@class, "ad-")]',
            '//*[contains(@id, "ad-")]',
            '//*[contains(@class, "banner")]',
            '//*[contains(@id, "banner")]',
            '//*[contains(@role, "banner")]',
            '//*[contains(@role, "navigation")]',
            '//*[contains(@role, "complementary")]',
            '//*[contains(@class, "cookie")]',
            '//*[contains(@id, "cookie")]',
        ];
        
        $xpath = new \DOMXPath($dom);
        foreach ($commonHeaderFooterSelectors as $selector) {
            $elements = $xpath->query($selector);
            foreach ($elements as $element) {
                if ($element->parentNode) {
                    $element->parentNode->removeChild($element);
                }
            }
        }
        
        // Essayer de trouver le contenu principal avec des sélecteurs courants
        $mainContent = null;
        $mainSelectors = [
            '//article',
            '//main',
            '//*[contains(@class, "content")]',
            '//*[contains(@class, "main")]',
            '//*[contains(@class, "post")]',
            '//*[contains(@class, "entry")]',
            '//*[contains(@id, "content")]',
            '//*[contains(@id, "main")]',
            '//*[contains(@id, "post")]',
            '//*[contains(@id, "article")]',
            '//*[contains(@role, "main")]',
            '//*[contains(@itemprop, "articleBody")]',
        ];
        
        foreach ($mainSelectors as $selector) {
            $elements = $xpath->query($selector);
            if ($elements->length > 0) {
                $mainContent = $elements->item(0);
                break;
            }
        }
        
        // Si on n'a pas trouvé de contenu principal, utiliser le body
        if (!$mainContent) {
            $mainContent = $dom->getElementsByTagName('body')->item(0);
        }
        
        // Mettre en évidence les liens
        $links = $mainContent->getElementsByTagName('a');
        foreach ($links as $link) {
            $href = $link->getAttribute('href');
            if (!empty($href)) {
                $link->setAttribute('style', 'color: #1a73e8; text-decoration: underline;');
                // Si c'est un lien relatif, le convertir en absolu
                if (strpos($href, 'http') !== 0 && strpos($href, '//') !== 0) {
                    $link->setAttribute('target', '_blank');
                }
            }
        }
        
        // Améliorer l'affichage des images
        $images = $mainContent->getElementsByTagName('img');
        foreach ($images as $img) {
            $img->setAttribute('style', 'max-width: 100%; height: auto; margin: 10px 0;');
            // Ajouter un texte alternatif s'il n'y en a pas
            if (!$img->getAttribute('alt')) {
                $img->setAttribute('alt', 'Image de la ressource');
            }
        }
        
        // Améliorer l'affichage des tableaux
        $tables = $mainContent->getElementsByTagName('table');
        foreach ($tables as $table) {
            $table->setAttribute('style', 'width: 100%; border-collapse: collapse; margin: 15px 0;');
            $table->setAttribute('border', '1');
            
            // Ajouter un style aux cellules
            $cells = $table->getElementsByTagName('td');
            foreach ($cells as $cell) {
                $cell->setAttribute('style', 'border: 1px solid #ddd; padding: 8px;');
            }
            
            // Ajouter un style aux en-têtes
            $headers = $table->getElementsByTagName('th');
            foreach ($headers as $header) {
                $header->setAttribute('style', 'border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;');
            }
        }
        
        // Récupérer le contenu HTML du contenu principal
        $content = $dom->saveHTML($mainContent);
        
        // Nettoyer le contenu
        $content = preg_replace('/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i', '', $content);
        $content = preg_replace('/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/i', '', $content);
        $content = preg_replace('/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/i', '', $content);
        $content = preg_replace('/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/i', '', $content);
        $content = preg_replace('/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/i', '', $content);
        $content = preg_replace('/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/i', '', $content);
        
        // Limiter la taille du contenu
        return substr($content, 0, 1000000);
    }
    
    /**
     * Supprime tous les éléments d'un certain type du DOM
     */
    private function removeElementsByTagName(&$dom, $tagName) {
        $elements = $dom->getElementsByTagName($tagName);
        $remove = [];
        foreach ($elements as $element) {
            $remove[] = $element;
        }
        foreach ($remove as $element) {
            $element->parentNode->removeChild($element);
        }
    }

    /**
     * Générer des questions suggérées
     */
    /**
     * Générer des questions suggérées
     */
    public function getSuggestedQuestions($currentQuestion)
    {
        $prompt = "En tant qu'expert en biosciences spatiales, propose 3 questions de suivi pertinentes, courtes et précises, sous forme de liste à puces, pour cette question : \"$currentQuestion\"";
        
        try {
            $payload = [
                'contents' => [
                    [ 'role' => 'user', 'parts' => [ ['text' => "Générez uniquement des questions de suivi, sans explications."] ] ],
                    [ 'role' => 'user', 'parts' => [ ['text' => $prompt] ] ],
                ],
                'generationConfig' => [ 'temperature' => 0.7 ],
            ];
            $uri = sprintf('/v1/models/%s:generateContent', rawurlencode($this->geminiModel));
            $resp = $this->client->post($uri, [ 'json' => $payload ]);

            $data = json_decode((string) $resp->getBody(), true);
            $content = '';
            if (isset($data['candidates'][0]['content']['parts'])) {
                foreach ($data['candidates'][0]['content']['parts'] as $part) {
                    $content .= (string) ($part['text'] ?? '');
                }
            }

            // Extraire les lignes non vides comme questions
            $lines = preg_split('/\r?\n/', $content);
            $questions = array_values(array_filter(array_map(function($l){
                return trim(ltrim($l, "-•* \t"));
            }, $lines), function($q){
                return !empty($q) && mb_strlen($q) > 5;
            }));

            // Limiter à 3 questions
            return array_slice($questions, 0, 3);
        } catch (\Exception $e) {
            Log::error('Erreur lors de la génération des questions suggérées (Gemini): ' . $e->getMessage());
            return [];
        }
    }

    /**
     * Construire un prompt pour l'API OpenAI
     */
    protected function buildPrompt(string $message, string $context): string
    {
        return "Contexte :\n$context\n\nQuestion : $message\n\nRéponse :";
    }

    /**
     * Ajouter une ressource manuellement
     */
    public function addResource(array $resource)
    {
        $this->resources[] = $resource;
    }

    public function getResources()
    {
        return $this->resources;
    }

    /**
     * Retourne une liste enrichie pour le dashboard avec des métadonnées simples
     */
    public function getEnrichedResources(): array
    {
        $list = [];
        foreach ($this->getAllResources() as $res) {
            $title = (string) ($res['title'] ?? '');
            $url = (string) ($res['url'] ?? '');
            // Organization = host du lien
            $host = '';
            try {
                $host = parse_url($url, PHP_URL_HOST) ?? '';
                if (str_starts_with($host, 'www.')) { $host = substr($host, 4); }
            } catch (\Throwable $e) {}
            // Year: extraire un entier 19xx/20xx depuis le titre si présent
            $year = '';
            if (preg_match('/\\b(19\\d{2}|20\\d{2})\\b/', $title, $m)) {
                $year = $m[1];
            }

            // Type heuristique basé sur l'URL/host
            $type = 'document';
            $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
            $lower = strtolower($path);
            if (str_ends_with($lower, '.pdf')) {
                $type = 'pdf';
            } elseif (preg_match('/youtube\\.com|youtu\\.be/i', $host)) {
                $type = 'video';
            } elseif (preg_match('/github\\.com/i', $host)) {
                $type = 'code';
            } elseif (preg_match('/zenodo\\.org|figshare\\.com/i', $host)) {
                $type = 'dataset';
            } elseif (preg_match('/arxiv\\.org/i', $host)) {
                $type = 'preprint';
            } elseif (preg_match('/doi\\.org/i', $host)) {
                $type = 'doi';
            }

            // Status heuristique simple
            $status = 'Completed';
            $tlow = strtolower($title);
            if (preg_match('/in progress|ongoing|prépublication|preprint/i', $tlow)) {
                $status = 'In progress';
            }

            $list[] = [
                'id' => $res['id'],
                'title' => $title,
                'url' => $url,
                'organization' => $host,
                'year' => $year,
                'status' => $status,
                'type' => $type,
            ];
        }
        return $list;
    }

    /**
     * Fournir une liste d'expériences dérivées des ressources enrichies
     * Format: id, name, startDate, endDate, status, progress, organization
     */
    public function getExperiments(): array
    {
        $resources = $this->getEnrichedResources();
        $experiments = [];
        foreach ($resources as $res) {
            $experiments[] = [
                'id' => $res['id'],
                'name' => $res['title'],
                'startDate' => '',
                'endDate' => '',
                'status' => $res['status'] ?? 'Completed',
                'progress' => ($res['status'] ?? '') === 'In progress' ? 50 : 100,
                'organization' => $res['organization'] ?? '',
            ];
        }
        return $experiments;
    }

    /**
     * Générer un résumé HTML clair et concis pour une ressource
     */
    public function summarizeResource(int $resourceId): string
    {
        $cacheKey = 'ai_summary_res_' . $resourceId;
        return Cache::remember($cacheKey, now()->addHours(12), function () use ($resourceId) {
            $resource = $this->getResourceContent($resourceId);
            if (!$resource) {
                return "Ressource introuvable.";
            }

            $messages = [
                ['role' => 'system', 'content' => "Vous êtes un assistant d'IA expert en biosciences spatiales. Produisez un résumé concis et structuré en HTML (titres courts, listes à puces). Citez des éléments du contenu si pertinent."],
                ['role' => 'user', 'content' => 'Résume la ressource suivante en 5 à 8 phrases maximum.'],
                ['role' => 'assistant', 'content' => 'D\'accord. Veuillez fournir le contenu.'],
                ['role' => 'user', 'content' => strip_tags(substr($resource['content'] ?? '', 0, 8000)) ?: ($resource['title'] . ' ' . $resource['url'])],
            ];

            try {
                $allText = [];
                foreach ($messages as $m) { $c = trim((string)($m['content'] ?? '')); if ($c !== '') $allText[] = $c; }
                $payload = [
                    'contents' => [ [ 'role' => 'user', 'parts' => [ ['text' => implode("\n\n", $allText)] ] ] ],
                    'generationConfig' => [ 'temperature' => 0.5 ],
                ];
                $uri = sprintf('/v1/models/%s:generateContent', rawurlencode($this->geminiModel));
                $resp = $this->client->post($uri, [ 'json' => $payload ]);
                $data = json_decode((string) $resp->getBody(), true);
                $text = '';
                if (isset($data['candidates'][0]['content']['parts'])) {
                    foreach ($data['candidates'][0]['content']['parts'] as $part) { $text .= (string) ($part['text'] ?? ''); }
                }
                return $text !== '' ? $text : 'Résumé indisponible.';
            } catch (\Exception $e) {
                Log::error('Erreur summarizeResource: ' . $e->getMessage());
                return 'Résumé indisponible.';
            }
        });
    }

    /**
     * Extraire 5-10 mots-clés (étiquettes) pertinents pour une ressource
     */
    public function extractKeywords(int $resourceId): array
    {
        $cacheKey = 'ai_keywords_res_' . $resourceId;
        return Cache::remember($cacheKey, now()->addHours(12), function () use ($resourceId) {
            $resource = $this->getResourceContent($resourceId);
            if (!$resource) {
                return [];
            }

            $messages = [
                ['role' => 'system', 'content' => "Vous êtes un assistant d'IA. Extrayez 5 à 10 mots-clés courts (un à trois mots), renvoyez uniquement une liste JSON de chaînes, sans texte additionnel."],
                ['role' => 'user', 'content' => strip_tags(substr($resource['content'] ?? '', 0, 6000)) ?: ($resource['title'] . ' ' . $resource['url'])],
            ];

            try {
                $allText = [];
                foreach ($messages as $m) { $c = trim((string)($m['content'] ?? '')); if ($c !== '') $allText[] = $c; }
                $payload = [
                    'contents' => [ [ 'role' => 'user', 'parts' => [ ['text' => implode("\n\n", $allText)] ] ] ],
                    'generationConfig' => [ 'temperature' => 0.3 ],
                ];
                $uri = sprintf('/v1/models/%s:generateContent', rawurlencode($this->geminiModel));
                $resp = $this->client->post($uri, [ 'json' => $payload ]);
                $data = json_decode((string) $resp->getBody(), true);
                $content = '';
                if (isset($data['candidates'][0]['content']['parts'])) {
                    foreach ($data['candidates'][0]['content']['parts'] as $part) { $content .= (string) ($part['text'] ?? ''); }
                }
                // Essayer de parser un JSON; fallback: split par virgules
                $tags = json_decode($content, true);
                if (is_array($tags)) {
                    return array_values(array_filter(array_map('strval', $tags)));
                }
                return array_values(array_filter(array_map('trim', explode(',', $content))));
            } catch (\Exception $e) {
                Log::error('Erreur extractKeywords: ' . $e->getMessage());
                return [];
            }
        });
    }

    /**
     * Suggérer jusqu'à 5 ressources liées basées sur le titre et le contenu
     */
    public function suggestRelated(int $resourceId): array
    {
        $cacheKey = 'ai_related_res_' . $resourceId;
        return Cache::remember($cacheKey, now()->addHours(12), function () use ($resourceId) {
            $current = $this->getResourceContent($resourceId);
            if (!$current) return [];

            // Stratégie simple: scoring par similarité de mots-clés dans le titre
            $title = mb_strtolower($current['title'] ?? '');
            $words = array_unique(array_filter(preg_split('/[^a-z0-9]+/i', $title)));

            $scores = [];
            foreach ($this->getAllResources() as $res) {
                if ((int)$res['id'] === (int)$resourceId) continue;
                $t = mb_strtolower($res['title'] ?? '');
                $count = 0;
                foreach ($words as $w) { if ($w && str_contains($t, $w)) $count++; }
                if ($count > 0) {
                    $scores[] = ['id' => $res['id'], 'title' => $res['title'], 'url' => $res['url'], 'score' => $count];
                }
            }
            usort($scores, fn($a,$b) => $b['score'] <=> $a['score']);
            return array_slice(array_map(fn($s) => ['id'=>$s['id'], 'title'=>$s['title'], 'url'=>$s['url']], $scores), 0, 5);
        });
    }
}
