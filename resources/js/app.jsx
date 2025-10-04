import './bootstrap';
import '../css/app.css';
import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { InertiaProgress } from '@inertiajs/progress';

// Configuration d'Inertia
createInertiaApp({
    title: (title) => title ? `${title} - BIOASTRA` : 'BIOASTRA',
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true });
        const page = pages[`./Pages/${name}.jsx`];
        
        if (!page) {
            throw new Error(`Page ${name} not found in ${Object.keys(pages).join(', ')}`);
        }
        
        // Si la page n'a pas de layout défini, on utilise AppLayout par défaut
        if (page && !page.default.layout) {
            import('./Layouts/AppLayout').then(module => {
                const Layout = module.default;
                page.default.layout = (page) => <Layout>{page}</Layout>;
            }).catch(error => {
                console.error('Erreur lors du chargement du layout par défaut:', error);
            });
        }
        
        return page.default;
    },
    setup({ el, App, props }) {
        if (!el) {
            console.error("L'élément racine pour l'application Inertia est introuvable");
            return;
        }
        
        try {
            const root = createRoot(el);
            root.render(<App {...props} />);
        } catch (error) {
            console.error("Erreur lors du rendu de l'application Inertia:", error);
        }
    },
});

// Barre de progression Inertia
InertiaProgress.init({
    delay: 250,
    color: '#4B5563',
    includeCSS: true,
    showSpinner: true,
});

// Logs de débogage
console.log('Application Inertia initialisée');

// Vérifier que le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM chargé');
    
    // Vérifier que l'élément racine existe
    const app = document.getElementById('app');
    if (!app) {
        console.error("L'élément avec l'ID 'app' est introuvable dans le DOM");
        document.body.innerHTML = '<div class="alert alert-danger m-4">Erreur: Élément racine #app introuvable</div>';
    }
});
