import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FaUser, FaRobot, FaTimes, FaPaperPlane } from 'react-icons/fa';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

export default function AIChat({ selectedResourceId, selectedResource, onDeselectResource = () => {} }) {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [language, setLanguage] = useState('en'); // 'en' ou 'fr'
    const messagesEndRef = useRef(null);
    const [isFirstMessage, setIsFirstMessage] = useState(true);

    // Charger les messages initiaux ou les suggestions
    useEffect(() => {
        if (selectedResourceId) {
            loadResourceContent(selectedResourceId);
        } else if (messages.length === 0 && !isFirstMessage) {
            // Ne charger le message de bienvenue que si aucun message n'est déjà affiché
            // et que ce n'est pas le premier message (sélection de langue)
            setMessages([{
                id: Date.now(),
                role: 'assistant',
                content: "Hello! I'm your AI assistant for NASA Bioscience. Ask me anything about the resources available."
            }]);
        } else if (isFirstMessage) {
            // Afficher la sélection de langue au premier chargement
            setMessages([{
                id: Date.now(),
                role: 'assistant',
                content: "In which language would you like to communicate? (English/Français)",
                isLanguageSelection: true
            }]);
        }
    }, [selectedResourceId, isFirstMessage]);

    // Function to scroll to the bottom of the messages
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadResourceContent = async (resourceId) => {
        if (!resourceId) {
            setMessages([{
                id: Date.now(),
                role: 'assistant',
                content: 'Hello! I\'m your AI assistant. How can I help you today?'
            }]);
            return;
        }
        
        try {
            const response = await axios.get(`/api/ai/resources/${resourceId}`);
            
            if (!response.data || !response.data.data) {
                throw new Error('API response invalid');
            }
            
            const resource = response.data.data;
            console.log('Resource loaded successfully:', resource);

            const title = resource.title || 'Untitled Resource';
            const currentTime = format(new Date(), 'HH:mm', {
                locale: language === 'fr' ? fr : enUS
            });

            setMessages(prev => [{
                id: Date.now(),
                role: 'assistant',
                content: (
                    <div className="resource-selection-message">
                        <div className="d-flex align-items-center mb-2">
                            <div className="resource-icon me-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <span className="fw-bold">{language === 'fr' ? 'Ressource sélectionnée' : 'Selected Resource'}</span>
                            <span className="text-muted ms-2" style={{ fontSize: '0.8rem' }}>{currentTime}</span>
                        </div>
                        <div className="resource-title mb-2">
                            {title}
                        </div>
                        <div className="resource-prompt">
                            {language === 'fr' 
                                ? 'Posez-moi des questions sur cette ressource !' 
                                : 'Ask me anything about this resource!'}
                        </div>
                    </div>
                )
            }, ...prev]);
        } catch (error) {
            console.error('Error loading resource:', error);
            let errorMessage = language === 'fr' 
                ? 'Désolé, une erreur s\'est produite. Veuillez réessayer.' 
                : 'Sorry, an error occurred. Please try again.';
            
            if (error.response) {
                // The request was made and the server responded with an error code
                console.error('Error details:', error.response.data);
                
                if (error.response.status === 404) {
                    errorMessage = language === 'fr' 
                        ? 'La ressource demandée est introuvable.' 
                        : 'The requested resource was not found.';
                } else if (error.response.data.error) {
                    errorMessage = error.response.data.error;
                } else if (error.response.data.message) {
                    errorMessage = error.response.data.message;
                }
            } else if (error.request) {
                // The request was made but no response was received
                console.error('No server response:', error.request);
                errorMessage = 'Unable to connect to the server. Check your internet connection.';
            } else {
                // Something happened in setting up the request
                console.error('Error:', error.message);
                errorMessage = 'An error occurred while processing your request.';
            }
            
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'assistant',
                content: errorMessage,
                isError: true
            }]);
        } finally {
            // Toujours s'assurer que l'état de chargement est réinitialisé
            setIsLoading(false);
        }
    };

    // Gérer la sélection de la langue
    const handleLanguageSelect = (selectedLanguage) => {
        setLanguage(selectedLanguage);
        setMessages([{
            id: Date.now(),
            role: 'assistant',
            content: selectedLanguage === 'fr' 
                ? 'Parfait ! En quoi puis-je vous aider aujourd\'hui ?' 
                : 'Great! How can I assist you today?'
        }]);
        setIsFirstMessage(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() || isLoading) return;

        const userMessage = {
            id: Date.now(),
            content: message,
            role: 'user',
            timestamp: new Date().toISOString(),
            language: language
        };

        setMessages(prev => [...prev, userMessage]);
        setMessage('');
        setIsLoading(true);

        try {
            const response = await axios.post('/api/chat/message', {
                message: message,
                language: language,
                resourceId: selectedResourceId ? parseInt(selectedResourceId) : undefined,
                context: {}
            });

            const botMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: response.data.message || 'No response from server',
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage = language === 'fr' 
                ? "Désolé, une erreur s'est produite. Veuillez réessayer." 
                : "Sorry, an error occurred. Please try again.";
            
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'assistant',
                content: errorMessage,
                isError: true,
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Formater la date en fonction de la langue
    const formatTimestamp = (timestamp) => {
        const date = timestamp ? new Date(timestamp) : new Date();
        return format(date, 'HH:mm', {
            locale: language === 'fr' ? fr : enUS
        });
    };

    return (
        <div className="d-flex flex-column" style={{ 
            backgroundColor: '#1e3a5f',
            height: '100vh',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* En-tête du chat */}
            <div className="chat-header d-flex justify-content-between align-items-center p-3 border-bottom bg-white shadow-sm">
                <div className="d-flex align-items-center">
                    <FaRobot className="text-primary me-2" size={24} />
                    <h5 className="mb-0 fw-bold">ASTRAMIND</h5>
                </div>
                
                {/* Sélecteur de langue */}
                <div className="language-selector">
                    <button 
                        className={`btn btn-sm ${language === 'fr' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => handleLanguageSelect('fr')}
                        disabled={isLoading}
                    >
                        FR
                    </button>
                    <button 
                        className={`btn btn-sm ms-2 ${language === 'en' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => handleLanguageSelect('en')}
                        disabled={isLoading}
                    >
                        EN
                    </button>
                </div>
            </div>
            
            {/* Zone des messages */}
            <div 
                className="chat-messages p-3 overflow-auto" 
                style={{ 
                    backgroundColor: '#1e3a5f',
                    flex: '1 1 auto',
                    overflowY: 'auto',
                    paddingBottom: '100px', // Espace pour le champ de saisie
                    marginBottom: '80px' // Hauteur de la zone de saisie
                }}
            >
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}
                    >
                        <div className="message-content">
                            {msg.content}
                            <span className="message-time">
                                {formatTimestamp(msg.timestamp)}
                            </span>
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                )}
            </div>
            
            {/* Zone de saisie en bas */}
            <div 
                className="chat-input p-3"
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: '#1e3a5f',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    padding: '15px',
                    zIndex: 10
                }}
            >
                <form onSubmit={handleSubmit} className="d-flex justify-content-center" style={{ width: '100%' }}>
                    <div style={{ position: 'relative', maxWidth: '800px', width: '100%' }}>
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="form-control"
                            placeholder={language === 'fr' ? 'Tapez votre message...' : 'Type your message...'}
                            disabled={isLoading}
                            style={{
                                backgroundColor: '#2a4a7a',
                                border: '1px solid #3a5a8a',
                                color: 'white',
                                borderRadius: '20px',
                                padding: '10px 50px 10px 20px',
                                width: '100%',
                                height: '44px',
                                boxSizing: 'border-box'
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                        {message && (
                            <button
                                type="button"
                                onClick={() => setMessage('')}
                                style={{
                                    position: 'absolute',
                                    right: '50px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ccc',
                                    cursor: 'pointer',
                                    padding: '5px'
                                }}
                            >
                                <FaTimes size={14} />
                            </button>
                        )}
                        <button 
                            type="submit"
                            disabled={!message.trim() || isLoading}
                            style={{
                                position: 'absolute',
                                right: '5px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '40px',
                                height: '40px',
                                backgroundColor: '#4a6fa5',
                                border: 'none',
                                borderRadius: '50%',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                            title={language === 'fr' ? 'Envoyer' : 'Send'}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a8ac5'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4a6fa5'}
                        >
                            {isLoading ? (
                                <div className="spinner-border spinner-border-sm" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            ) : (
                                <FaPaperPlane />
                            )}
                        </button>
                    </div>
                </form>
            </div>
            
            <style>{
                `.resource-selection-message {
                    background-color: rgba(76, 175, 80, 0.1);
                    border-left: 3px solid #4CAF50;
                    padding: 12px 15px;
                    border-radius: 8px;
                    margin: 10px 0;
                }
                .resource-title {
                    font-size: 1.05rem;
                    font-weight: 500;
                    color: #333;
                    margin-left: 28px;
                }
                .resource-prompt {
                    font-size: 0.9rem;
                    color: #666;
                    margin-top: 8px;
                    margin-left: 28px;
                }
                .resource-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    background-color: rgba(76, 175, 80, 0.2);
                    border-radius: 50%;
                }
                .typing-indicator {
                    display: flex;
                    align-items: center;
                    padding: 0.5rem 0;
                }
                .typing-indicator span {
                    width: 8px;
                    height: 8px;
                    margin: 0 2px;
                    background-color: #ffffff;
                    border-radius: 50%;
                    display: inline-block;
                    opacity: 0.6;
                }
                .typing-indicator span:nth-child(1) {
                    animation: typing 1s infinite;
                }
                .typing-indicator span:nth-child(2) {
                    animation: typing 1s infinite 0.2s;
                }
                .typing-indicator span:nth-child(3) {
                    animation: typing 1s infinite 0.4s;
                }
                @keyframes typing {
                    0%, 100% { opacity: 0.4; transform: translateY(0); }
                    50% { opacity: 1; transform: translateY(-3px); }
                }`
            }</style>
        </div>
    );
}
