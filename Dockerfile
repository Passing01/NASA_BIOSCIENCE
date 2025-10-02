FROM php:8.2-fpm

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    sqlite3 \
    libsqlite3-dev \
    unzip \
    git \
    curl \
    gnupg \
    ca-certificates \
    && docker-php-ext-install pdo pdo_sqlite

# Installer Node.js 20.x
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y nodejs

# Installer Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copier d'abord uniquement les fichiers nécessaires pour l'installation des dépendances
COPY composer.json composer.lock ./

# Installer les dépendances PHP sans exécuter les scripts
RUN composer install --no-dev --no-scripts --optimize-autoloader --no-interaction

# Copier le reste des fichiers
COPY . .

# Créer les répertoires nécessaires et configurer les permissions
RUN mkdir -p storage/framework/{sessions,views,cache} \
    && mkdir -p storage/logs \
    && touch database/database.sqlite \
    && chown -R www-data:www-data storage bootstrap/cache public database \
    && chmod -R 775 storage bootstrap/cache

# Installer les dépendances Node et construire les assets
RUN npm ci --prefer-offline --no-audit --progress=false \
    && npm run build

# Exécuter les scripts post-install maintenant que tous les fichiers sont en place
RUN composer run-script post-autoload-dump --no-interaction \
    && php artisan storage:link

# Configurer Nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Nettoyer le cache
RUN apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/*

# Exposer le port
EXPOSE 10000

# Démarrer les services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]