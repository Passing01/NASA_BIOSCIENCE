FROM php:8.2-cli

# Installer les extensions nécessaires
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get update && apt-get install -y \
    sqlite3 \
    libsqlite3-dev \
    unzip \
    git \
    nodejs \
    && docker-php-ext-install pdo pdo_sqlite \
    && apt-get clean

# Installer Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copier les fichiers
COPY . .

# Installer les dépendances
RUN composer install --no-dev --optimize-autoloader --no-interaction

RUN npm install && \
    npm run build

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