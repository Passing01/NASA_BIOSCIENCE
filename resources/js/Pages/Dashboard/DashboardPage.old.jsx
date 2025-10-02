import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import AIChat from '@/Components/AIChat';
import ResourceList from '@/Components/ResourceList';
import { 
    Card, 
    Container, 
    Row, 
    Col,
    Tabs,
    Tab
} from 'react-bootstrap';

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState('resources');
    const [selectedResourceId, setSelectedResourceId] = useState(null);

    const handleResourceSelect = (resourceId) => {
        setSelectedResourceId(resourceId);
        setActiveTab('chat');
    };

    return (
        <AppLayout
            title="Dashboard"
            renderHeader={() => (
                <h2 className="font-semibold text-xl text-gray-800 leading-tight">
                    Dashboard - NASA Bioscience
                </h2>
            )}
        >
            <Head title="Dashboard" />

            <div className="py-6">
                <Container fluid>
                    <Row className="g-4">
                        <Col lg={4} className="d-flex flex-column" style={{ height: 'calc(100vh - 150px)' }}>
                            <Card className="h-100">
                                <Card.Header className="bg-dark text-white">
                                    <h5 className="mb-0">Resources</h5>
                                </Card.Header>
                                <Card.Body className="p-0 d-flex flex-column" style={{ overflow: 'hidden' }}>
                                    <ResourceList onResourceSelect={handleResourceSelect} />
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col lg={8} className="d-flex flex-column" style={{ height: 'calc(100vh - 150px)' }}>
                            <Card className="h-100">
                                <Card.Header className="bg-dark text-white">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0">AI Assistant</h5>
                                        <div>
                                            <button 
                                                className="btn btn-sm btn-outline-light me-2"
                                                onClick={() => {
                                                    setSelectedResourceId(null);
                                                    setActiveTab('chat');
                                                }}
                                            >
                                                New conversation
                                            </button>
                                        </div>
                                    </div>
                                </Card.Header>
                                <Card.Body className="p-0 d-flex flex-column" style={{ overflow: 'hidden' }}>
                                    <Tabs
                                        activeKey={activeTab}
                                        onSelect={(k) => setActiveTab(k)}
                                        className="mb-0"
                                    >
                                        <Tab eventKey="chat" title="Chat" className="h-100">
                                            <div className="h-100 d-flex flex-column">
                                                <AIChat selectedResourceId={selectedResourceId} />
                                            </div>
                                        </Tab>
                                        <Tab eventKey="resources" title="Resources" className="h-100">
                                            <div className="p-3">
                                                <h5>Available resources</h5>
                                                <p className="text-muted">Select a resource to start chatting with the AI.</p>
                                                <button 
                                                    className="btn btn-primary"
                                                    onClick={() => setActiveTab('chat')}
                                                >
                                                    See conversation
                                                </button>
                                            </div>
                                        </Tab>
                                    </Tabs>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </div>
        </AppLayout>
    );
}
