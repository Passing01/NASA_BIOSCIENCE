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

# Copier les fichiers
COPY . .

# Installer les dépendances
RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && npm ci --prefer-offline --no-audit --progress=false \
    && npm run build

# Configurer Nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Configurer les permissions
RUN chown -R www-data:www-data /var/www/html/storage \
    /var/www/html/bootstrap/cache \
    /var/www/html/public/build

# Créer le fichier SQLite
RUN touch database/database.sqlite \
    && chmod 775 database/database.sqlite

# Exposer le port
EXPOSE 10000

# Démarrer les services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]