import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Table, Dropdown, Badge, Button, Form, Card } from 'react-bootstrap';
import { Funnel, Download, Eye, Search, ArrowCounterclockwise, EyeFill } from 'react-bootstrap-icons';
import { router } from '@inertiajs/react';

// Les expériences sont chargées depuis l'API: /api/ai/experiments

const getStatusVariant = (status) => {
    switch(status) {
        case 'Completed': return 'success';
        case 'In progress': return 'primary';
        case 'Pending': return 'warning';
        default: return 'secondary';
    }
};

// Fonction pour obtenir le compteur de vues depuis le localStorage
const getViewCount = (id) => {
    const views = JSON.parse(localStorage.getItem('resource_views') || '{}');
    return views[id] || 0;
};

// Fonction pour incrémenter le compteur de vues
const incrementViewCount = (id) => {
    const views = JSON.parse(localStorage.getItem('resource_views') || '{}');
    views[id] = (views[id] || 0) + 1;
    localStorage.setItem('resource_views', JSON.stringify(views));
    return views[id];
};

export default function ExperiencesSection({ 
    searchTerm = '', 
    yearFilter = '', 
    organizationFilter = '', 
    statusFilter = '', 
    typeFilter = '',
    onSelectExperience = null
}) {
    const [experiments, setExperiments] = useState([]);
    const [filteredExperiments, setFilteredExperiments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Utiliser les filtres passés en props
    const filters = useMemo(() => ({
        search: searchTerm || '',
        year: yearFilter || '',
        organization: organizationFilter || '',
        status: statusFilter || 'all',
        type: typeFilter || ''
    }), [searchTerm, yearFilter, organizationFilter, statusFilter, typeFilter]);

    // Charger les expériences depuis resources.json
    useEffect(() => {
        let mounted = true;
        
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Charger les données depuis l'API Laravel
                const response = await fetch('/api/resources');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const resources = await response.json();
                
                if (!Array.isArray(resources)) {
                    throw new Error('The received data is not an array');
                }
                
                // Transformer les ressources en format d'expériences
                const experiences = resources.map((resource, index) => {
                    // Extraire l'année de l'URL ou du titre
                    const yearMatch = resource.url?.match(/\/(\d{4})\//) || resource.title?.match(/(20\d{2})/);
                    const year = yearMatch ? yearMatch[1] : new Date().getFullYear();
                    
                    // Générer des dates aléatoires pour la période
                    const startDate = new Date(Number(year), Math.floor(Math.random() * 12), 1);
                    const endDate = new Date(startDate);
                    endDate.setMonth(startDate.getMonth() + Math.floor(Math.random() * 12) + 1);
                    
                    // Définir un statut aléatoire
                    const statuses = ['In progress', 'Completed', 'Pending'];
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    
                    // Calculer la progression en fonction du statut
                    let progress = 0;
                    if (status === 'Completed') {
                        progress = 100;
                    } else if (status === 'In progress') {
                        progress = Math.floor(Math.random() * 70) + 30; // Entre 30% et 99%
                    }
                    
                    // Déterminer l'organisation en fonction de l'URL
                    let organization = 'NASA';
                    const url = resource.url || '';
                    if (url.includes('nih.gov')) organization = 'NIH';
                    else if (url.includes('esahubble.org')) organization = 'ESA';
                    else if (url.includes('jaxa.jp')) organization = 'JAXA';
                    
                    return {
                        id: resource.id || index + 1,
                        name: resource.title || `Research ${index + 1}`,
                        startDate: startDate.toISOString().split('T')[0],
                        endDate: endDate.toISOString().split('T')[0],
                        status,
                        progress,
                        organization,
                        url: url,
                        // Ajouter le type si disponible
                        type: resource.type || 'Research'
                    };
                });
                
                if (!mounted) return;
                setExperiments(experiences);
                setFilteredExperiments(experiences);
            } catch (e) {
                if (!mounted) return;
                console.error('Error loading experiments:', e);
                setError("Impossible de charger les ressources.");
            } finally {
                if (mounted) setIsLoading(false);
            }
        };
        
        load();
        return () => { mounted = false; };
    }, []);
    
    // Fonction pour gérer le clic sur le bouton de sélection pour le chat
    const handleSelectForChat = (exp) => {
        // Incrémenter le compteur de vues
        const newViewCount = incrementViewCount(exp.id);
        
        // Mettre à jour l'affichage
        setFilteredExperiments(prev => 
            prev.map(item => 
                item.id === exp.id 
                    ? { ...item, views: newViewCount } 
                    : item
            ).sort((a, b) => b.views - a.views)
        );
        
        // Appeler la fonction de sélection si elle existe
        if (onSelectExperience) {
            onSelectExperience(exp);
        }
    };
    
    // Fonction pour gérer le clic sur le bouton de détails
    const handleViewDetails = (exp) => {
        // Incrémenter le compteur de vues
        const newViewCount = incrementViewCount(exp.id);
        
        // Mettre à jour l'affichage
        setFilteredExperiments(prev => 
            prev.map(item => 
                item.id === exp.id 
                    ? { ...item, views: newViewCount } 
                    : item
            ).sort((a, b) => b.views - a.views)
        );
        
        // Navigation vers la page de détails
        router.visit(`/resources/${exp.id}`, {
            method: 'get',
            preserveState: true,
            preserveScroll: true,
        });
    };

    // Filtrer et trier les expériences
    useEffect(() => {
        if (!experiments.length) return;
        
        const filtered = experiments
            .map(exp => ({
                ...exp,
                views: getViewCount(exp.id) || 0,
                // Ajouter les champs manquants pour le filtrage
                year: exp.year || exp.startDate?.split('-')[0] || new Date().getFullYear().toString(),
                organization: exp.organization || 'NASA',
                type: exp.type || 'Research',
                status: exp.status || 'In progress'
            }))
            .filter(exp => {
                // Recherche dans le nom et la description
                const searchTerm = (filters.search || '').toLowerCase();
                const matchesSearch = !searchTerm || 
                    (exp.name?.toLowerCase().includes(searchTerm) || 
                     exp.title?.toLowerCase().includes(searchTerm) ||
                     (exp.description?.toLowerCase().includes(searchTerm) || ''));
                
                // Filtres
                const matchesYear = !filters.year || exp.year.toString() === filters.year.toString();
                const matchesOrg = !filters.organization || exp.organization === filters.organization;
                const matchesStatus = filters.status === 'all' || exp.status === filters.status;
                const matchesType = !filters.type || exp.type === filters.type;
                
                return matchesSearch && matchesYear && matchesOrg && matchesStatus && matchesType;
            })
            .sort((a, b) => (b.views || 0) - (a.views || 0)); // Tri par nombre de vues décroissant
        
        setFilteredExperiments(filtered);
    }, [experiments, filters]);

    return (
        <Card className="mb-4">
            <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center">
                        <h5 className="mb-0 me-2">Resources</h5>
                        <span className="text-muted small">
                            <EyeFill className="me-1" />
                            Ranked by popularity
                        </span>
                    </div>
                </div>
                <div className="table-responsive">
                    {isLoading && (
                        <div className="text-center text-muted py-3">Loading resources...</div>
                    )}
                    {error && !isLoading && (
                        <div className="text-center text-danger py-3">{error}</div>
                    )}
                    {!isLoading && !error && (
                        <Table hover className="mb-0">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Progression</th>
                                    <th>Views</th>
                                    <th>Organisation</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExperiments.map(experiment => (
                                    <tr key={experiment.id}>
                                        <td className="fw-medium" style={{ color: '#fff' }}>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewDetails(experiment);
                                                }}
                                                className="text-white hover:underline bg-transparent border-0 p-0 text-start"
                                            >
                                                {experiment.name || experiment.title || 'Sans nom'}
                                            </button>
                                        </td>
                                        <td style={{ color: '#fff' }}>
                                            {experiment.startDate || '—'} - {experiment.endDate || '—'}
                                        </td>
                                        <td>
                                            <Badge bg={getStatusVariant(experiment.status)}>
                                                {experiment.status || 'Inconnu'}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="progress" style={{ width: '100px', height: '24px' }}>
                                                <div 
                                                    className="progress-bar d-flex align-items-center justify-content-center" 
                                                    role="progressbar" 
                                                    style={{
                                                        width: `${experiment.progress || 0}%`,
                                                        fontSize: '0.85rem',
                                                        fontWeight: 'bold'
                                                    }}
                                                    aria-valuenow={experiment.progress || 0}
                                                    aria-valuemin="0" 
                                                    aria-valuemax="100"
                                                >
                                                    {experiment.progress || 0}%
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ color: '#fff' }}>{experiment.views || 0}</td>
                                        <td style={{ color: '#fff' }}>{experiment.organization || '—'}</td>
                                        <td className="text-end">
                                            <div className="btn-group" role="group">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-success me-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectForChat(experiment);
                                                    }}
                                                    title="Select for chat"
                                                >
                                                    💬
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleViewDetails(experiment);
                                                    }}
                                                    title="Details views"
                                                >
                                                    <Eye className="me-1" size={14} />
                                                    View
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </div>
            </Card.Body>
        </Card>
    );
};
