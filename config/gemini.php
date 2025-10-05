<?php

return [
    'api_key' => env('GEMINI_API_KEY', ''),
    // You can change the default model here. Examples: gemini-1.5-pro, gemini-1.5-flash, gemini-1.5-flash-8b
    'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
    'timeout' => (int) env('GEMINI_TIMEOUT', 60), // seconds
    'connect_timeout' => (int) env('GEMINI_CONNECT_TIMEOUT', 10), // seconds
    // SSL verification (set GEMINI_SSL_VERIFY=false to disable temporarily; recommended to keep true)
    'verify' => env('GEMINI_SSL_VERIFY', true),
    // Optional path to a CA bundle (cacert.pem). Example on Windows: C:\\php\\extras\\ssl\\cacert.pem
    'cafile' => env('GEMINI_CA_BUNDLE', null),
    // Optional HTTP(S) proxy, e.g. http://user:pass@proxy:8080
    'proxy' => env('GEMINI_HTTP_PROXY', null),
];
