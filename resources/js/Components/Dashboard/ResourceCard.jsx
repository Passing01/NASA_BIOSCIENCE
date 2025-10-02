import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Button, Badge } from 'react-bootstrap';
import { Building, ArrowRight, Clock, Calendar } from 'react-bootstrap-icons';
import { router } from '@inertiajs/react';

export default function ResourceCard({ id, title, mission, year, organization, status = 'En cours', type, onClick }) {
    const [keywords, setKeywords] = useState([]);

    useEffect(() => {
        let mounted = true;
        const loadKeywords = async () => {
            try {
                const resp = await axios.get(`/api/ai/resources/${id}/keywords`);
                if (mounted) setKeywords((resp.data?.keywords || []).slice(0, 3));
            } catch (e) {
                // silencieux
            }
        };
        if (id) loadKeywords();
        return () => { mounted = false; };
    }, [id]);
    const handleCardClick = (e) => {
        // Si on clique sur le bouton, on ne fait rien ici (géré par handleButtonClick)
        if (e.target.closest('button')) {
            return;
        }
        
        // Appeler onClick pour remplir le chat
        if (onClick) {
            onClick({ id, title, mission, year, organization, status, type });
        }
    };
    
    const handleButtonClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Naviguer vers la page de détails
        router.visit(`/resources/${id}`);
    };
    
    const statusVariants = {
        'Completed': 'success',
        'In progress': 'warning',
        'Planned': 'info',
        'Cancelled': 'danger'
    };
    
    const typeIcons = {
        'document': '📄',
        'video': '🎬',
        'audio': '🎧',
        'lien': '🔗'
    };
    
    return (
        <Card 
            className="h-100 shadow-sm" 
            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
            onClick={handleCardClick}
        >
            <Card.Body className="d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <Badge bg={statusVariants[status] || 'secondary'} className="mb-2">
                        {status}
                    </Badge>
                    <span className="fs-4">{typeIcons[type] || '📌'}</span>
                </div>
                
                <Card.Title className="h5 mb-3" style={{ color: '#ffff' }}>{title}</Card.Title>
                
                <div className="d-flex flex-column gap-2 text-muted small mb-3">
                    {mission && (
                        <div className="d-flex align-items-center" style={{ color: '#ffff' }}>
                            <Clock size={14} className="me-2" />
                            <span>{mission}</span>
                        </div>
                    )}
                    
                    {year && (
                        <div className="d-flex align-items-center" style={{ color: '#ffff' }}>
                            <Calendar size={14} className="me-2" />
                            <span>{year}</span>
                        </div>
                    )}
                    
                    {organization && (
                        <div className="d-flex align-items-center" style={{ color: '#ffff' }}>
                            <Building size={14} className="me-2" />
                            <span>{organization}</span>
                        </div>
                    )}
                </div>

                {keywords.length > 0 && (
                    <div className="mb-2 d-flex flex-wrap gap-1">
                        {keywords.map((k, idx) => (
                            <Badge key={idx} bg="secondary" className="me-1">{k}</Badge>
                        ))}
                    </div>
                )}
                
                <div className="mt-auto">
                    <Button 
                        variant="outline-primary" 
                        size="sm" 
                        onClick={handleButtonClick}
                        className="w-100 d-flex align-items-center justify-content-center"
                    >
                        View details <ArrowRight size={16} className="ms-2" />
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
}
