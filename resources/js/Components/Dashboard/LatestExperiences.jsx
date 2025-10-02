import React from 'react';
import { Card, Row, Col, Badge, Button } from 'react-bootstrap';
import { ThreeDotsVertical, Calendar as CalendarIcon, Building as BuildingIcon } from 'react-bootstrap-icons';

const experiments = [
    {
        id: 1,
        name: 'Étude des effets des radiations',
        startDate: '15/01/2023',
        endDate: '15/07/2023',
        status: 'Terminé',
        progress: 100,
        organization: 'CNES',
        description: 'Étude approfondie des effets des radiations spatiales sur les matériaux biologiques.'
    },
    {
        id: 2,
        name: 'Croissance des plantes en microgravité',
        startDate: '01/03/2023',
        endDate: '30/09/2023',
        status: 'En cours',
        progress: 65,
        organization: 'ESA',
        description: 'Analyse de la croissance des plantes dans un environnement de microgravité.'
    },
    {
        id: 3,
        name: 'Comportement des fluides',
        startDate: '10/04/2023',
        endDate: '10/10/2023',
        status: 'En cours',
        progress: 30,
        organization: 'NASA',
        description: 'Étude du comportement des fluides en apesanteur pour applications futures.'
    }
];

const getStatusVariant = (status) => {
    switch(status) {
        case 'Terminé': return 'success';
        case 'En cours': return 'primary';
        case 'En attente': return 'warning';
        default: return 'secondary';
    }
};

export default function LatestExperiences() {
    return (
        <>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="h5 mb-0">Dernières expériences</h3>
                <Button variant="link" className="p-0">
                    Voir tout
                </Button>
            </div>
            
            <Row className="g-4">
                {experiments.map(experiment => (
                    <Col key={experiment.id} md={6} lg={4}>
                        <Card className="h-100 shadow-sm">
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                    <h5 className="card-title mb-0">{experiment.name}</h5>
                                    <Badge 
                                        bg={getStatusVariant(experiment.status)}
                                        className="text-capitalize"
                                    >
                                        {experiment.status}
                                    </Badge>
                                </div>
                                
                                <p className="text-muted small mb-3">
                                    {experiment.description}
                                </p>
                                
                                <div className="d-flex align-items-center text-muted small mb-3">
                                    <CalendarIcon className="me-1" size={14} />
                                    {experiment.startDate} - {experiment.endDate}
                                </div>
                                
                                <div className="d-flex align-items-center text-muted small mb-3">
                                    <BuildingIcon className="me-1" size={14} />
                                    {experiment.organization}
                                </div>
                                
                                <div className="mb-3">
                                    <div className="d-flex justify-content-between small mb-1">
                                        <span>Progression</span>
                                        <span className="fw-medium">{experiment.progress}%</span>
                                    </div>
                                    <div className="progress" style={{ height: '4px' }}>
                                        <div 
                                            className="progress-bar" 
                                            role="progressbar" 
                                            style={{ width: `${experiment.progress}%` }}
                                            aria-valuenow={experiment.progress}
                                            aria-valuemin="0" 
                                            aria-valuemax="100"
                                        ></div>
                                    </div>
                                </div>
                                
                                <div className="d-flex justify-content-between align-items-center">
                                    <Button variant="outline-primary" size="sm">
                                        Voir les détails
                                    </Button>
                                    <Button variant="outline-secondary" size="sm" className="px-2">
                                        <ThreeDotsVertical />
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </>
    );
}
