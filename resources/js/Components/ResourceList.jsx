import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ResourceList({ onResourceSelect }) {
    const [resources, setResources] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedResourceId, setSelectedResourceId] = useState(null);

    // Charger les ressources au montage du composant
    useEffect(() => {
        const fetchResources = async () => {
            try {
                const response = await axios.get('/api/ai/resources');
                // API renvoie { data: [...] }
                setResources(response.data?.data || []);
            } catch (error) {
                console.error('Erreur lors du chargement des ressources:', error);
                setResources([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchResources();
    }, []);

    // Filtrer les ressources en fonction du terme de recherche
    const filteredResources = resources.filter(resource => 
        resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resource.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleResourceClick = (resourceId) => {
        setSelectedResourceId(resourceId);
        if (onResourceSelect) {
            const res = resources.find(r => r.id === resourceId);
            onResourceSelect(res || resourceId);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Barre de recherche */}
            <div className="p-4 border-b border-gray-200">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Rechercher une ressource..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Liste des ressources */}
            <div className="flex-1 overflow-y-auto">
                {filteredResources.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                        {filteredResources.map((resource) => (
                            <li key={resource.id}>
                                <button
                                    onClick={() => handleResourceClick(resource.id)}
                                    className={`w-full text-left p-4 hover:bg-gray-50 focus:outline-none focus:bg-blue-50 transition-colors ${
                                        selectedResourceId === resource.id ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <h3 className="text-sm font-medium text-gray-900">{resource.title}</h3>
                                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                                        {resource.description}
                                    </p>
                                    <div className="mt-2 flex items-center text-xs text-blue-600">
                                        <span>View details</span>
                                        <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1}
                                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium">No resources found</h3>
                        <p className="mt-1 text-sm">Try modifying your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
