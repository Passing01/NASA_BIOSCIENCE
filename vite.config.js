import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
    const isProduction = mode === 'production';
    
    return {
        plugins: [
            laravel({
                input: 'resources/js/app.jsx',
                refresh: true,
                buildDirectory: 'build',
            }),
            react({
                jsxImportSource: '@emotion/react',
                babel: {
                    plugins: ['@emotion/babel-plugin'],
                },
            }),
        ],
        build: {
            manifest: true,
            outDir: 'public/build',
            emptyOutDir: true,
            rollupOptions: {
                input: 'resources/js/app.jsx',
                output: {
                    entryFileNames: 'assets/[name].js',
                    chunkFileNames: 'assets/[name].js',
                    assetFileNames: 'assets/[name].[ext]',
                },
            },
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'resources/js'),
                '@components': path.resolve(__dirname, 'resources/js/Components'),
                '@layouts': path.resolve(__dirname, 'resources/js/Layouts'),
                'ziggy-js': path.resolve('vendor/tightenco/ziggy/dist'),
                'bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
            },
        },
        server: {
            hmr: {
                host: 'localhost',
                protocol: 'ws',
            },
            watch: {
                usePolling: true,
            },
        },
        optimizeDeps: {
            include: [
                'react',
                'react-dom',
                '@inertiajs/inertia',
                '@inertiajs/inertia-react',
                '@emotion/react',
                '@emotion/styled',
            ],
        },
    };
});
