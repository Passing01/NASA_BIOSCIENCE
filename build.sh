#!/usr/bin/env bash

# Installer les dépendances PHP
composer install --no-dev --optimize-autoloader --no-interaction

# Installer les dépendances Node
npm ci

# Construire les assets
npm run build

# Créer les répertoires nécessaires
mkdir -p storage/framework/{sessions,views,cache}
mkdir -p storage/logs

# Créer le répertoire pour la base de données
mkdir -p /opt/render/project/.data

# Créer le fichier SQLite s'il n'existe pas
touch /opt/render/project/.data/database.sqlite

# Donner les permissions
chmod 664 /opt/render/project/.data/database.sqlite
chmod -R 775 storage bootstrap/cache

# Vider le cache de configuration
php artisan config:clear
php artisan cache:clear
php artisan view:clear

# Mettre en cache la configuration pour la production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Créer le lien symbolique pour le stockage
php artisan storage:link

php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan route:clear

# Exécuter les migrations
php artisan migrate --force

# Optimiser l'application
php artisan config:cache
php artisan route:cache
php artisan view:cache