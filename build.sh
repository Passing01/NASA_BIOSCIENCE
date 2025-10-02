#!/usr/bin/env bash

composer install --no-dev --optimize-autoloader
npm install
npm run build

mkdir -p storage/framework/{sessions,views,cache}
mkdir -p storage/logs

# Créer le répertoire pour la base de données
mkdir -p /opt/render/project/.data

# Créer le fichier SQLite s'il n'existe pas
touch /opt/render/project/.data/database.sqlite

# Donner les permissions
chmod 664 /opt/render/project/.data/database.sqlite

chmod -R 775 storage bootstrap/cache

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