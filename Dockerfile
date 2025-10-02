FROM php:8.2-fpm

# Installer les extensions nécessaires
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    nginx \
    supervisor \
    sqlite3 \
    libsqlite3-dev \
    unzip \
    git

# Installer Node.js 20.x et npm
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
RUN apt-get update && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Installer les extensions PHP
RUN docker-php-ext-install pdo pdo_sqlite

# Installer Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copier les fichiers
COPY . .

# Installer les dépendances PHP
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Installer les dépendances Node et construire les assets
RUN npm ci && \
    npm run build && \
    npm cache clean --force

# Configurer les permissions
RUN chown -R www-data:www-data /var/www/html/storage \
    /var/www/html/bootstrap/cache \
    /var/www/html/public/build

# Créer le répertoire pour SQLite
RUN mkdir -p /var/www/html/database && \
    touch /var/www/html/database/database.sqlite && \
    chmod -R 775 /var/www/html/database

# Créer les répertoires de storage
RUN mkdir -p storage/framework/{sessions,views,cache} && \
    mkdir -p storage/logs && \
    chmod -R 775 storage bootstrap/cache

RUN touch database/database.sqlite

RUN chmod -R 777 storage bootstrap/cache database

EXPOSE 10000

# Démarrer avec les logs activés
CMD php artisan migrate --force && \
    php artisan config:clear && \
    php artisan cache:clear && \
    php artisan view:clear && \
    php artisan serve --host=0.0.0.0 --port=${PORT:-10000}