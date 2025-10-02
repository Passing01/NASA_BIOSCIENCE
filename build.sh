#!/usr/bin/env bash

composer install --no-dev --optimize-autoloader

# Créer le répertoire pour la base de données
mkdir -p /opt/render/project/.data

# Créer le fichier SQLite s'il n'existe pas
touch /opt/render/project/.data/database.sqlite

# Donner les permissions
chmod 664 /opt/render/project/.data/database.sqlite

# Exécuter les migrations
php artisan migrate --force

# Optimiser l'application
php artisan config:cache
php artisan route:cache
php artisan view:cache