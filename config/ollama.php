<?php

return [
    'host' => env('OLLAMA_HOST', 'http://localhost:11434'),
    'model' => env('OLLAMA_MODEL', 'mistral'),
    'timeout' => (int) env('OLLAMA_TIMEOUT', 300), // seconds
    'connect_timeout' => (int) env('OLLAMA_CONNECT_TIMEOUT', 15), // seconds
];
