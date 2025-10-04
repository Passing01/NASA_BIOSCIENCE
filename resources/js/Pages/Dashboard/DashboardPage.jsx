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
    Search as SearchIcon,
    ChatSquareText
} from 'react-bootstrap-icons';

// Composant de filtre
const FilterSection = ({ filters, onFilterChange, years = [], organizations = [], types = [], statuses = [] }) => {
    return (
        <Card className="mb-4">
            <Card.Body>
                <h5 className="mb-3" style={{ color: '#fff' }}>Filtrer les ressources</h5>
                <Row>
                    <Col md={3} className="mb-3">
                        <Form.Group>
                            <Form.Label>Année</Form.Label>
                            <Form.Select 
                                value={filters.year} 
                                onChange={(e) => onFilterChange('year', e.target.value)}
                            >
                                <option value="">Toutes les années</option>
                                {years.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={3} className="mb-3">
                        <Form.Group>
                            <Form.Label>Organisation</Form.Label>
                            <Form.Select 
                                value={filters.organization}
                                onChange={(e) => onFilterChange('organization', e.target.value)}
                            >
                                <option value="">Toutes les organisations</option>
                                {organizations.map(org => (
                                    <option key={org} value={org}>{org}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={3} className="mb-3">
                        <Form.Group>
                            <Form.Label>Type</Form.Label>
                            <Form.Select 
                                value={filters.type}
                                onChange={(e) => onFilterChange('type', e.target.value)}
                            >
                                <option value="">Tous les types</option>
                                {types.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={3} className="mb-3">
                        <Form.Group>
                            <Form.Label>Statut</Form.Label>
                            <Form.Select 
                                value={filters.status}
                                onChange={(e) => onFilterChange('status', e.target.value)}
                            >
                                <option value="">Tous les statuts</option>
                                {statuses.map(status => (
                                    <option key={status} value={status}>{status}</option>
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
    
    // Options dynamiques pour les filtres
    const years = useMemo(() => 
        [...new Set(resources.map(r => r.year).filter(Boolean))].sort((a, b) => b - a),
        [resources]
    );
    
    const organizations = useMemo(() => 
        [...new Set(resources.map(r => r.organization).filter(Boolean))].sort(),
        [resources]
    );
    
    const types = useMemo(() => 
        [...new Set(resources.map(r => r.type).filter(Boolean))].sort(),
        [resources]
    );
    
    const statuses = useMemo(() => 
        [...new Set(resources.map(r => r.status).filter(Boolean))].sort(),
        [resources]
    );
    
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
                        title={isChatOpen ? 'Fermer le chat' : 'Ouvrir le chat'}
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
                                <h1 className="h4 mb-0">BIOASTRA</h1>
                            </div>
                            
                            <div className="dashboard-content p-4">
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
                                    onSelectExperience={(exp) => setSelectedExperience(exp)}
                                />
                                
                                {resources.length > displayCount && (
                                    <div className="text-center mt-4">
                                        <Button onClick={showMore} variant="primary">
                                            Afficher plus
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
