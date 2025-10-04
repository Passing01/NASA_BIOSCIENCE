import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Table, Dropdown, Badge, Button, Form, Card } from 'react-bootstrap';
import { Funnel, Download, ThreeDotsVertical, Eye, Pencil, Trash, Search, ArrowCounterclockwise } from 'react-bootstrap-icons';

// Les expériences sont chargées depuis l'API: /api/ai/experiments

const getStatusVariant = (status) => {
    switch(status) {
        case 'Completed': return 'success';
        case 'In progress': return 'primary';
        case 'Pending': return 'warning';
        default: return 'secondary';
    }
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
                setError("Impossible de charger les expériences.");
            } finally {
                if (mounted) setIsLoading(false);
            }
        };
        
        load();
        return () => { mounted = false; };
    }, []);
    
    // Filtrer les expériences
    useEffect(() => {
        if (!experiments.length) return;
        
        const filtered = experiments.filter(exp => {
            // Filtre par statut
            if (filters.status && filters.status !== 'all' && exp.status !== filters.status) {
                return false;
            }
            
            // Filtre par recherche
            if (filters.search && !exp.name.toLowerCase().includes(filters.search.toLowerCase())) {
                return false;
            }
            
            // Filtre par organisation
            if (filters.organization && exp.organization !== filters.organization) {
                return false;
            }
            
            // Filtre par année
            if (filters.year) {
                const expYear = exp.startDate?.split('-')[0];
                if (expYear !== filters.year) {
                    return false;
                }
            }
            
            // Filtre par type (à adapter selon vos besoins)
            if (filters.type) {
                // Implémentez la logique de filtrage par type si nécessaire
                // Par exemple, si vous avez un champ 'type' dans vos expériences
                // if (exp.type !== filters.type) return false;
            }
            
            return true;
        });
        
        setFilteredExperiments(filtered);
    }, [experiments, filters]);

    return (
        <Card className="mb-4">
            <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-4" style={{ color: '#ffff' }}>
                    <h2 className="h5 mb-0">Experiences</h2>
                    <div className="d-flex gap-2">
                        <Form.Select 
                            size="sm" 
                            style={{ width: '200px' }}
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                        >
                            <option value="all">All experiences</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                            <option value="pending">Pending</option>
                        </Form.Select>
                        <div className="input-group" style={{ width: '250px' }}>
                            <span className="input-group-text bg-transparent">
                                <Search size={16} />
                            </span>
                            <Form.Control
                                type="text"
                                placeholder="Search..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="border-start-0"
                            />
                        </div>
                        <Button 
                            variant="outline-secondary" 
                            size="sm"
                            onClick={() => {
                                // Réinitialiser tous les filtres
                                setFilters({
                                    status: 'all',
                                    search: ''
                                });
                            }}
                            title="Reset filters"
                        >
                            <ArrowCounterclockwise size={16} />
                        </Button>
                        <Button 
                            variant="outline-primary" 
                            size="sm"
                            onClick={() => {
                                // Télécharger les données au format CSV
                                const headers = ['Name', 'Start Date', 'End Date', 'Status', 'Progress', 'Organization'];
                                const csvContent = [
                                    headers.join(','),
                                    ...filteredExperiments.map(exp => 
                                        [
                                            `"${exp.name}"`,
                                            exp.startDate,
                                            exp.endDate,
                                            exp.status,
                                            `${exp.progress}%`,
                                            exp.organization
                                        ].join(',')
                                    )
                                ].join('\n');
                                
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', `experiments_${new Date().toISOString().split('T')[0]}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            title="Download data as CSV"
                        >
                            <Download size={16} />
                        </Button>
                    </div>
                </div>

                <div className="table-responsive">
                    {isLoading && (
                        <div className="text-center text-muted py-3">Loading experiences...</div>
                    )}
                    {error && !isLoading && (
                        <div className="text-center text-danger py-3">{error}</div>
                    )}
                    <Table hover className="align-middle">
                        <thead style={{ color: '#000000' }}>
                            <tr>
                                <th>Experience name</th>
                                <th>Period</th>
                                <th>Status</th>
                                <th>Progression</th>
                                <th>Organization</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && !error && filteredExperiments.map(experiment => (
                                <tr key={experiment.id}>
                                    <td 
                                        className="fw-medium" 
                                        style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => onSelectExperience && onSelectExperience(experiment)}
                                    >
                                        {experiment.name}
                                    </td>
                                    <td className="text-muted" style={{ color: '#fff' }}>
                                        {experiment.startDate || '—'} - {experiment.endDate || '—'}
                                    </td>
                                    <td>
                                        <Badge 
                                            bg={getStatusVariant(experiment.status)}
                                            className="text-capitalize"
                                        >
                                            {experiment.status || '—'}
                                        </Badge>
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            <div className="progress flex-grow-1 me-2" style={{ height: '6px' }}>
                                                <div 
                                                    className="progress-bar" 
                                                    role="progressbar" 
                                                    style={{ width: `${experiment.progress ?? 0}%` }}
                                                    aria-valuenow={experiment.progress ?? 0}
                                                    aria-valuemin="0" 
                                                    aria-valuemax="100"
                                                ></div>
                                            </div>
                                            <small className="text-muted">{experiment.progress ?? 0}%</small>
                                        </div>
                                    </td>
                                    <td style={{ color: '#fff' }}>{experiment.organization || '—'}</td>
                                    <td className="text-end">
                                        <Button 
                                            variant="outline-primary" 
                                            size="sm"
                                            onClick={() => window.location.href = `/resources/${experiment.id}`}
                                        >
                                            <Eye className="me-1" size={14} />
                                            View
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
}
