import React, { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import ResourceCard from '@/Components/Dashboard/ResourceCard';
import ExperiencesSection from '@/Components/Dashboard/ExperiencesSection';
import AIChat from '@/Components/AIChat';
import { Container, Row, Col, Card, Button, Form } from 'react-bootstrap';
import { ArrowCounterclockwise } from 'react-bootstrap-icons';

// Composant de filtre
const FilterSection = ({ filters, onFilterChange, years = [], organizations = [], statuses = [] }) => {
    // Fonction pour réinitialiser tous les filtres
    const handleReset = () => {
        onFilterChange('reset');
    };

    // Vérifier si des filtres sont actifs
    const hasActiveFilters = filters.year || filters.organization || filters.status;

    return (
        <Card className="mb-4" style={{ backgroundColor: '#1e3a5f', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
            <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0" style={{ color: '#fff' }}>Filter resources</h5>
                    {hasActiveFilters && (
                        <Button 
                            variant="outline-light" 
                            size="sm" 
                            onClick={handleReset}
                            className="d-flex align-items-center"
                        >
                            <ArrowCounterclockwise className="me-1" />
                            Reset
                        </Button>
                    )}
                </div>
                <Row>
                    <Col md={3} className="mb-3">
                        <Form.Group>
                            <Form.Label style={{ color: '#fff' }}>Search</Form.Label>
                            <div className="d-flex">
                                <Form.Control
                                    type="text"
                                    placeholder="Search..."
                                    value={filters.search || ''}
                                    onChange={(e) => onFilterChange('search', e.target.value)}
                                    style={{ 
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: '#fff'
                                    }}
                                />
                            </div>
                        </Form.Group>
                    </Col>
                    <Col md={2} className="mb-3">
                        <Form.Group>
                            <Form.Label style={{ color: '#fff' }}>Year</Form.Label>
                            <Form.Select 
                                value={filters.year || ''} 
                                onChange={(e) => onFilterChange('year', e.target.value || '')}
                                className="custom-select"
                                style={{ 
                                    backgroundColor: '#1e3a5f', 
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="">All years</option>
                                {years.map(y => (
                                    <option key={y} value={y} style={{ color: '#000' }}>{y}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={2} className="mb-3">
                        <Form.Group>
                            <Form.Label style={{ color: '#fff' }}>Organization</Form.Label>
                            <Form.Select 
                                value={filters.organization || ''}
                                onChange={(e) => onFilterChange('organization', e.target.value || '')}
                                className="custom-select"
                                style={{ 
                                    backgroundColor: '#1e3a5f', 
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="">All</option>
                                {organizations.map(org => (
                                    <option key={org} value={org} style={{ color: '#000' }}>{org}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={2} className="mb-3">
                        <Form.Group>
                            <Form.Label style={{ color: '#fff' }}>Status</Form.Label>
                            <Form.Select 
                                value={filters.status || 'all'}
                                onChange={(e) => onFilterChange('status', e.target.value || 'all')}
                                className="custom-select"
                                style={{ 
                                    backgroundColor: '#1e3a5f', 
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="all">All</option>
                                {statuses.map(status => (
                                    <option key={status} value={status} style={{ color: '#000' }}>{status}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

// Composant principal
export default function DashboardPage({ resources: initialResources = [] }) {
    const [selectedExperience, setSelectedExperience] = useState(null);
    const [resources, setResources] = useState(initialResources);
    const [loading, setLoading] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [filters, setFilters] = useState({
        year: '',
        organization: '',
        status: '',
        type: '',
        search: ''
    });
    const [displayCount, setDisplayCount] = useState(6);

    // Charger les ressources depuis l'API Laravel
    useEffect(() => {
        const loadResources = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/resources');
                if (!response.ok) {
                    throw new Error(`Erreur HTTP! statut: ${response.status}`);
                }
                const data = await response.json();
                
                // Ajouter des métadonnées pour le filtrage
                const enhancedResources = data.map(resource => ({
                    ...resource,
                    year: (resource.url?.match(/\/(\d{4})\//) || resource.title?.match(/(20\d{2})/) || [])[1] || 
                          new Date().getFullYear().toString(),
                    organization: 'NASA',
                    type: 'Document de recherche',
                    status: 'Publié'
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
    
    // Gérer les changements de filtre
    const handleFilterChange = (filterName, value) => {
        if (filterName === 'reset') {
            setFilters({
                year: '',
                organization: '',
                status: 'all',
                type: '',
                search: ''
            });
        } else {
            setFilters(prev => {
                const newFilters = {
                    ...prev,
                    [filterName]: value
                };
                
                // Si on change le statut, s'assurer que 'all' est géré correctement
                if (filterName === 'status' && value === 'all') {
                    newFilters.status = 'all';
                }
                
                return newFilters;
            });
        }
    };
    
    // Options pour les filtres
    const years = useMemo(() => 
        [...new Set(resources.map(r => r.year).filter(Boolean))].sort((a, b) => b - a),
        [resources]
    );
    
    // Organisations prédéfinies
    const organizations = ['NASA', 'NIH'];
    
    // Statuts prédéfinis
    const statuses = ['Completed', 'In progress', 'Pending'];
    
    // Afficher plus de résultats
    const showMore = () => {
        setDisplayCount(prev => prev + 6);
    };
    
    // Réinitialiser la pagination quand les filtres changent
    useEffect(() => {
        setDisplayCount(6);
    }, [filters]);

    return (
        <AppLayout>
            <Head title="Tableau de bord" />
            
            <div className="container-fluid p-0 h-100">
                <div className="row g-0 h-100">
                    {/* Chat sidebar */}
                    <div 
                        className="position-fixed h-100" 
                        style={{
                            width: isChatOpen ? '350px' : '0',
                            left: 0,
                            top: 0,
                            zIndex: 1000,
                            transition: 'width 0.3s ease',
                            overflow: 'hidden',
                            backgroundColor: '#1e3a5f'
                        }}
                    >
                        {isChatOpen && (
                            <AIChat 
                                selectedResourceId={selectedExperience?.id}
                                selectedResource={selectedExperience}
                                onDeselectResource={() => setSelectedExperience(null)}
                            />
                        )}
                    </div>
                    
                    {/* Chat toggle button */}
                    <button 
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className="position-fixed d-flex align-items-center justify-content-center"
                        style={{
                            bottom: '30px',
                            right: '30px',
                            width: '70px',
                            height: '70px',
                            borderRadius: '50%',
                            backgroundColor: '#1e3a5f',
                            border: '3px solid white',
                            color: 'white',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                            zIndex: 1040,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            fontSize: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        title={isChatOpen ? 'Close chat' : 'Open chat'}
                    >
                        💬
                    </button>

                    {/* Colonne de contenu principale */}
                    <div 
                        className="col-12"
                        style={{
                            marginLeft: isChatOpen ? '350px' : '0',
                            transition: 'margin-left 0.3s ease',
                            width: isChatOpen ? 'calc(100% - 350px)' : '100%',
                            float: isChatOpen ? 'right' : 'none'
                        }}
                    >
                        <div className="main-content">
                            {/* En-tête */}
                            <div className="d-flex justify-content-between align-items-center p-3" style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
                                <div className="d-flex align-items-center">
                                    <img 
                                        src="/images/nasa-logo.jpg" 
                                        alt="NASA Logo" 
                                        style={{ height: '30px', marginRight: '10px' }}
                                    />
                                    <h1 className="h4 mb-0">BIOASTRA</h1>
                                </div>
                            </div>
                            
                            <div className="dashboard-content p-4">
<FilterSection 
                                    filters={filters} 
                                    onFilterChange={handleFilterChange}
                                    years={years}
                                    organizations={organizations}
                                    statuses={statuses}
                                />

                                <div className="mt-4">
                                    <ExperiencesSection 
                                        searchTerm={filters.search}
                                        yearFilter={filters.year}
                                        organizationFilter={filters.organization}
                                        statusFilter={filters.status || 'all'}
                                        onSelectExperience={(exp) => setSelectedExperience(exp)}
                                    />
                                </div>
                                
                                {resources.length > displayCount && (
                                    <div className="text-center mt-4">
                                        <Button onClick={showMore} variant="primary">
                                            Show more
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
