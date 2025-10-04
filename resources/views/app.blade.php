<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name', 'BIOASTRA') }}</title>

    <!-- Favicon -->
    <link rel="icon" href="{{ asset('favicon.ico') }}">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
    
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">

    @routes
    @viteReactRefresh
    @inertiaHead
</head>
<body class="font-sans antialiased" style="background-color: #0a1931 !important;">
    <div id="app" data-page="{{ json_encode($page) }}">
        @inertia
    </div>

    @vite(['resources/js/app.jsx'])
    
    <script>
        // Vérification que l'élément racine existe
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM chargé');
            
            // Vérification de l'élément racine d'Inertia
            const app = document.getElementById('app');
            if (!app) {
                console.error("L'élément racine #app est introuvable");
                document.body.innerHTML = '<div class="alert alert-danger m-4">Erreur: Élément racine #app introuvable</div>';
            } else {
                console.log("Élément racine #app trouvé");
            }
        });
    </script>
</body>
</html>
