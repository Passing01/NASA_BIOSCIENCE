import { Head } from '@inertiajs/react';
import { useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import axios from 'axios';
// import ChatWidget from '../Components/ChatWidget';

export default function AppLayout({ children, title }) {
    // Configurer les en-têtes par défaut pour axios
    useEffect(() => {
        axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
        axios.defaults.withCredentials = true;
        
        // Vérifier si l'utilisateur est authentifié et configurer les en-têtes en conséquence
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (token) {
            axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
        }
    }, []);

    return (
        <div className="min-vh-100" style={{ backgroundColor: '#0a1931 !important' }}>
            <Head title={title}>
                <meta name="csrf-token" content={document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')} />
            </Head>
            {children}
            {/* <ChatWidget /> */}
        </div>
    );
}
