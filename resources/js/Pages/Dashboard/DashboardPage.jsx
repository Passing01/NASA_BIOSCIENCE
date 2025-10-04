import React, { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import ResourceCard from '@/Components/Dashboard/ResourceCard';
import ExperiencesSection from '@/Components/Dashboard/ExperiencesSection';
import AIChat from '@/Components/AIChat';
import { 
    Container, 
    Row, 
    Col,
    Card,
    Button,
    Badge,
    Form,
    Dropdown
} from 'react-bootstrap';
import { 
    Plus,
    Bell,
    QuestionCircle,
    Gear,
    Search as SearchIcon
} from 'react-bootstrap-icons';

// Les données sont maintenant chargées depuis l'API: /api/ai/resources-enriched

// Composant de filtre
const FilterSection = ({ filters, onFilterChange, years = [], organizations = [], types = [], statuses = [] }) => {
    return (
        <Card className="mb-4">
            <Card.Body>
                <h5 className="mb-3" style={{ color: '#fff' }}>Filter resources</h5>
                <Row>
                    <Col md={3} className="mb-3" style={{ color: '#fff' }}>
                        <Form.Group>
                            <Form.Label>Year</Form.Label>
                            <Form.Select 
                                value={filters.year} 
                                onChange={(e) => onFilterChange('year', e.target.value)}
                            >
                                <option value="">All years</option>
                                {years.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={3} className="mb-3" style={{ color: '#fff' }}>
                        <Form.Group>
                            <Form.Label>Organization</Form.Label>
                            <Form.Select 
                                value={filters.organization}
                                onChange={(e) => onFilterChange('organization', e.target.value)}
                            >
                                <option value="">All organizations</option>
                                {organizations.map(o => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={3} className="mb-3" style={{ color: '#fff' }}>
                        <Form.Group>
                            <Form.Label>Type</Form.Label>
                            <Form.Select 
                                value={filters.type} 
                                onChange={(e) => onFilterChange('type', e.target.value)}
                            >
                                <option value="">All types</option>
                                {types.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={3} className="mb-3" style={{ color: '#fff' }}>
                        <Form.Group>
                            <Form.Label>Status</Form.Label>
                            <Form.Select 
                                value={filters.status} 
                                onChange={(e) => onFilterChange('status', e.target.value)}
                            >
                                <option value="">All status</option>
                                {statuses.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={12} className="mb-3" style={{ color: '#fff' }}>
                        <Form.Group>
                            <Form.Label>Quick search</Form.Label>
                            <div className="input-group">
                                <span className="input-group-text">
                                    <SearchIcon />
                                </span>
                                <Form.Control 
                                    type="text" 
                                    placeholder="Search by title or mission..." 
                                    value={filters.search}
                                    onChange={(e) => onFilterChange('search', e.target.value)}
                                />
                            </div>
                        </Form.Group>
                    </Col>
                </Row>
                <div className="d-flex flex-wrap gap-2 mt-2">
                    {(filters.mission || filters.year || filters.organization || filters.status || filters.type || filters.search) && (
                        <Button 
                            variant="outline-secondary" 
                            size="sm"
                            onClick={() => onFilterChange('reset', '')}
                            className="ms-auto"
                        >
                            Reset filters
                        </Button>
                    )}
                </div>
            </Card.Body>
        </Card>
    );
};

// Les props sont maintenant passées par le contrôleur Laravel
export default function DashboardPage({ resources: initialResources = [] }) {
    const [resources, setResources] = useState(initialResources);
    const [loading, setLoading] = useState(false);
    const [selectedResource, setSelectedResource] = useState(null);
    const [filters, setFilters] = useState({
        year: '',
        organization: '',
        status: '',
        type: '',
        search: ''
    });

    // Charger les ressources depuis l'API Laravel
    useEffect(() => {
        const loadResources = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/resources');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                
                // Ajouter des métadonnées pour le filtrage
                const enhancedResources = data.map(resource => ({
                    ...resource,
                    // Extraire l'année de l'URL ou du titre
                    year: (resource.url?.match(/\/(\d{4})\//) || resource.title?.match(/(20\d{2})/) || [])[1] || 
                          new Date().getFullYear().toString(),
                    // Définir une organisation par défaut (NASA) ou extraire d'autres sources si disponibles
                    organization: 'NASA',
                    // Définir un type par défaut
                    type: 'Research Paper',
                    // Définir un statut par défaut
                    status: 'Published'
                }));
                setResources(enhancedResources);
            } catch (error) {
                console.error('Erreur lors du chargement des ressources:', error);
                setResources(initialResources);
            } finally {
                setLoading(false);
            }
        };

        loadResources();
    }, [initialResources]);
    
    // Fonction pour gérer la sélection d'une ressource
    const handleResourceSelect = useCallback((resource) => {
        console.log('Selected resource:', resource);
        setSelectedResource(resource);
    }, []);
    
    // Fonction pour gérer les changements de filtre
    const handleFilterChange = (filterName, value) => {
        if (filterName === 'reset') {
            setFilters({
                mission: '',
                year: '',
                organization: '',
                status: '',
                type: '',
                search: ''
            });
        } else {
            setFilters(prev => ({
                ...prev,
                [filterName]: value
            }));
        }
    };
    
    // Options dynamiques
    const years = useMemo(() => 
        Array.from(new Set(
            resources
                .map(r => r.year)
                .filter(Boolean)
                .sort((a, b) => b - a) // Tri décroissant pour avoir les années les plus récentes d'abord
        )), 
        [resources]
    );

    const organizations = useMemo(() => 
        Array.from(new Set(
            resources
                .map(r => r.organization)
                .filter(Boolean)
                .sort()
        )), 
        [resources]
    );

    const types = useMemo(() => 
        Array.from(new Set(
            resources
                .map(r => r.type)
                .filter(Boolean)
                .sort()
        )), 
        [resources]
    );

    const statuses = useMemo(() => 
        Array.from(new Set(
            resources
                .map(r => r.status)
                .filter(Boolean)
                .sort()
        )), 
        [resources]
    );

    // Filtrer les ressources en fonction des filtres
    const filteredResources = useMemo(() => 
        resources.filter(resource => {
            const matchesYear = !filters.year || (resource.year.toString() === filters.year);
            const matchesOrg = !filters.organization || 
                (resource.organization && resource.organization.toLowerCase().includes(filters.organization.toLowerCase()));
            const matchesStatus = !filters.status || 
                (resource.status && resource.status.toLowerCase() === filters.status.toLowerCase());
            const matchesType = !filters.type || 
                (resource.type && resource.type.toLowerCase() === filters.type.toLowerCase());
            const matchesSearch = !filters.search || 
                (resource.title && resource.title.toLowerCase().includes(filters.search.toLowerCase()));
            
            return matchesYear && matchesOrg && matchesStatus && matchesType && matchesSearch;
        }),
        [resources, filters]
    );

    // État pour gérer le nombre de ressources à afficher
    const [displayCount, setDisplayCount] = useState(3);
    const showMore = () => {
        setDisplayCount(prev => prev + 3);
    };
    
    // Réinitialiser le compteur quand les filtres changent
    useEffect(() => {
        setDisplayCount(3);
    }, [filters]);

    return (
        <AppLayout>
            <Head title="Dashboard" />
            
            <div className="dashboard-container">
                {/* Barre latérale du chat */}
                <div className="chat-sidebar">
                    <AIChat selectedResourceId={selectedResource?.id} />
                </div>

                {/* Contenu principal */}
                <div className="main-content">
                    {/* En-tête */}
                    <header className="dashboard-header">
                        <div className="d-flex justify-content-between align-items-center">
                            {/* <img src="images/nasa-logo.jpg" alt="NASA Logo" /> */}
                            <h1 className="h4 mb-0">BIOASTRA</h1>
                            <div className="d-flex align-items-center gap-3">
                                {/* <div className="search-box">
                                    <SearchIcon className="search-icon" />
                                    <input 
                                        type="text" 
                                        placeholder="Rechercher..." 
                                        className="form-control"
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                    />
                                </div> */}
                                {/* <button 
                                    className="btn btn-icon position-relative"
                                    onClick={() => console.log('Ouvrir les notifications')}
                                >
                                    <Bell size={20} />
                                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                                        3
                                        <span className="visually-hidden">nouvelles notifications</span>
                                    </span>
                                </button>
                                <button 
                                    className="btn btn-icon"
                                    onClick={() => console.log('Ouvrir l\'aide')}
                                >
                                    <QuestionCircle size={20} />
                                </button> */}
                                {/* <Dropdown>
                                    <Dropdown.Toggle 
                                        variant="link" 
                                        className="btn-icon p-0"
                                        id="user-menu"
                                    >
                                        <Gear size={20} />
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu align="end">
                                        <Dropdown.Item 
                                            onClick={() => console.log('Ouvrir les paramètres')}
                                        >
                                            Paramètres
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            onClick={() => console.log('Ouvrir mon compte')}
                                        >
                                            Mon compte
                                        </Dropdown.Item>
                                        <Dropdown.Divider />
                                        <Dropdown.Item
                                            onClick={() => {
                                                if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                                                    console.log('Déconnexion'); */}
                                                    
                                                {/* }
                                            }}
                                        >
                                            Déconnexion
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown> */}
                                </div>
                            </div>
                        </header>

                    <div className="content-wrapper">
                        {/* Section Expériences avec filtres */}
                        <section className="mb-4">
                            <FilterSection 
                                filters={filters} 
                                onFilterChange={handleFilterChange}
                                years={years}
                                organizations={organizations}
                                types={types}
                                statuses={statuses}
                            />

                            <ExperiencesSection 
                                searchTerm={filters.search}
                                yearFilter={filters.year}
                                organizationFilter={filters.organization}
                                statusFilter={filters.status}
                                typeFilter={filters.type}
                            />
                        </section>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
