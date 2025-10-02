import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Button, Card, Form, ListGroup, Spinner } from 'react-bootstrap';
import { Send, Robot, X } from 'react-bootstrap-icons';

const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: "Hello! I'm your AI assistant for NASA Bioscience. I respond only to questions related to a selected resource.",
            sender: 'bot',
            timestamp: new Date()
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        // Ajouter le message de l'utilisateur
        const userMessage = {
            id: Date.now(),
            text: message,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setMessage('');
        setIsLoading(true);

        try {
            // Envoyer le message à l'API
            const response = await axios.post('/api/chat/message', {
                message: message
            });

            // Ajouter la réponse du bot
            const botMessage = {
                id: Date.now() + 1,
                text: response.data.response,
                sender: 'bot',
                timestamp: new Date(),
                isCached: response.data.cached || false
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Error sending message :', error);
            
            let errorText = 'Sorry, an error occurred while processing your request. Please try again later.';
            
            // Handle rate limit errors
            if (error.response) {
                if (error.response.status === 429) {
                    errorText = 'You have exceeded the request limit. Please wait before trying again.';
                } else if (error.response.data?.message) {
                    errorText = error.response.data.message;
                }
            }
            
            const errorMessage = {
                id: Date.now() + 1,
                text: errorText,
                sender: 'bot',
                timestamp: new Date(),
                isError: true
            };
            
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="position-fixed bottom-0 end-0 m-4" style={{ zIndex: 1050 }}>
            {isOpen ? (
                <Card style={{ width: '350px', maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
                    <Card.Header className="d-flex justify-content-between align-items-center bg-primary text-white">
                        <div className="d-flex align-items-center">
                            <Robot className="me-2" />
                            <span>AI Assistant for NASA</span>
                        </div>
                        <Button 
                            variant="link" 
                            className="text-white p-0" 
                            onClick={() => setIsOpen(false)}
                            aria-label="Fermer le chat"
                        >
                            <X size={20} />
                        </Button>
                    </Card.Header>
                    <Card.Body className="p-0 d-flex flex-column" style={{ flex: 1, overflow: 'hidden' }}>
                        <div className="p-3 overflow-auto" style={{ flex: 1, maxHeight: '400px' }}>
                            <ListGroup variant="flush">
                                {messages.map((msg) => (
                                    <ListGroup.Item 
                                        key={msg.id} 
                                        className={`border-0 p-2 mb-2 ${msg.sender === 'user' ? 'text-end' : 'text-start'} ${msg.isError ? 'text-danger' : ''}`}
                                    >
                                        <div 
                                            className={`d-inline-block p-2 rounded-3 position-relative ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-light'}`}
                                        >
                                            <div>{msg.text}</div>
                                            <div className="d-flex justify-content-between align-items-center mt-1">
                                                <small className={`${msg.sender === 'user' ? 'text-white-50' : 'text-muted'}`}>
                                                    {formatTime(msg.timestamp)}
                                                </small>
                                                {msg.isCached && (
                                                    <small className="text-muted ms-2">
                                                        <i className="bi bi-arrow-repeat"></i> Response from cache
                                                    </small>
                                                )}
                                            </div>
                                        </div>
                                    </ListGroup.Item>
                                ))}
                                {isLoading && (
                                    <ListGroup.Item className="border-0 p-2 text-start">
                                        <div className="d-flex align-items-center">
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            <span>The AI is thinking...</span>
                                        </div>
                                    </ListGroup.Item>
                                )}
                                <div ref={messagesEndRef} />
                            </ListGroup>
                        </div>
                        <div className="border-top p-2">
                            <Form onSubmit={handleSubmit} className="d-flex">
                                <Form.Control
                                    type="text"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type your message... (Responses are provided only for questions related to resources)"
                                    className="rounded-start"
                                    disabled={isLoading}
                                />
                                <Button 
                                    variant="primary" 
                                    type="submit" 
                                    disabled={!message.trim() || isLoading}
                                    className="rounded-start-0"
                                >
                                    <Send />
                                </Button>
                            </Form>
                        </div>
                    </Card.Body>
                </Card>
            ) : (
                <Button 
                    variant="primary" 
                    className="rounded-circle p-3" 
                    onClick={() => setIsOpen(true)}
                    aria-label="Ouvrir le chat"
                >
                    <Robot size={24} />
                </Button>
            )}
        </div>
    );
};

export default ChatWidget;
