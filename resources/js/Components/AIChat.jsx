import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FaUser, FaRobot, FaTimes, FaPaperPlane } from 'react-icons/fa';
import { format } from 'date-fns';
import { fr, enUS, es, zhCN, ja, ar } from 'date-fns/locale';

// Fonction utilitaire pour obtenir l'emoji du drapeau
const getFlagEmoji = (countryCode) => {
    // Pour les codes de pays à deux lettres
    try {
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    } catch (e) {
        return ''; // Retourne une chaîne vide en cas d'erreur
    }
};

// Gestion du clic en dehors du menu déroulant
const useClickOutside = (ref, callback) => {
    useEffect(() => {
        const handleClick = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                callback();
            }
        };

        document.addEventListener('mousedown', handleClick);
        return () => {
            document.removeEventListener('mousedown', handleClick);
        };
    }, [ref, callback]);
};

// Composant AIChat
export default function AIChat({ selectedResourceId, selectedResource, onDeselectResource = () => {} }) {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    // Configuration des langues supportées
    const supportedLanguages = {
        en: { name: 'English', locale: enUS },
        fr: { name: 'Français', locale: fr },
        es: { name: 'Español', locale: es },
        zh: { name: '中文', locale: zhCN },
        ja: { name: '日本語', locale: ja },
        ar: { name: 'العربية', locale: ar, rtl: true }
    };
    
    const [language, setLanguage] = useState('en');
    const messagesEndRef = useRef(null);
    const [isFirstMessage, setIsFirstMessage] = useState(true);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
                content: "Please select your preferred language: " + Object.entries(supportedLanguages).map(([code, {name}]) => `${name} (${code})`).join(', '),
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
        setIsDropdownOpen(false);
        
        const welcomeMessages = {
            en: 'Great! How can I assist you today?',
            fr: 'Parfait ! En quoi puis-je vous aider aujourd\'hui ?',
            es: '¡Perfecto! ¿En qué puedo ayudarte hoy?',
            zh: '太好了！今天我能帮您什么忙？',
            ja: 'よろしいですね！今日はどのようなお手伝いができますか？',
            ar: 'رائع! كيف يمكنني مساعدتك اليوم؟'
        };
        
        setMessages([{
            id: Date.now(),
            role: 'assistant',
            content: welcomeMessages[selectedLanguage] || welcomeMessages['en']
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
        <div className="d-flex flex-column h-100" style={{ 
            backgroundColor: '#1e3a5f',
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* En-tête du chat */}
            <div className="chat-header d-flex justify-content-between align-items-center p-3 border-bottom shadow-sm" style={{
                backgroundColor: '#1e3a5f',
                color: '#fff'
            }}>
                <div className="d-flex align-items-center">
                    <FaRobot className="text-primary me-2" size={24} />
                    <h5 className="mb-0 fw-bold">ASTRAMIND</h5>
                </div>
                
                {/* Sélecteur de langue moderne avec état React */}
                <div className="position-relative">
                    <button 
                        className="btn btn-sm btn-outline-secondary d-flex align-items-center"
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        style={{
                            minWidth: '100px',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.25rem 0.75rem'
                        }}
                    >
                        <span className="me-2">
                            {supportedLanguages[language]?.name || 'Language'}
                        </span>
                        <svg 
                            width="12" 
                            height="12" 
                            fill="currentColor" 
                            viewBox="0 0 16 16"
                            style={{
                                transition: 'transform 0.2s',
                                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0)'
                            }}
                        >
                            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
                        </svg>
                    </button>
                    
                    {isDropdownOpen && (
                        <div 
                            className="position-absolute end-0 mt-1 bg-white border rounded shadow-sm"
                            style={{
                                minWidth: '150px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                zIndex: 1000
                            }}
                        >
                            <ul className="list-unstyled mb-0">
                                {Object.entries(supportedLanguages).map(([code, {name}]) => (
                                    <li key={code}>
                                        <button
                                            className={`w-100 text-start px-3 py-2 d-flex align-items-center ${language === code ? 'text-primary' : ''}`}
                                            onClick={() => {
                                                handleLanguageSelect(code);
                                                setIsDropdownOpen(false);
                                            }}
                                            style={{
                                                fontFamily: code === 'ar' ? 'Arial, sans-serif' : 'inherit',
                                                direction: code === 'ar' ? 'rtl' : 'ltr',
                                                textAlign: code === 'ar' ? 'right' : 'left',
                                                whiteSpace: 'nowrap',
                                                border: 'none',
                                                background: 'none',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <span className="me-2">{getFlagEmoji(code)}</span>
                                            {name}
                                            {language === code && (
                                                <span className="ms-auto">
                                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                        <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022z"/>
                                                    </svg>
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Zone des messages */}
            <div 
                className="chat-messages p-3" 
                style={{ 
                    backgroundColor: '#1e3a5f',
                    flex: '1 1 auto',
                    overflowY: 'auto',
                    padding: '15px',
                    paddingBottom: '100px', // Espace pour le champ de saisie
                    marginBottom: '80px', // Hauteur de la zone de saisie
                    maxHeight: 'calc(100vh - 150px)'
                }}
            >
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`message-container ${msg.role === 'user' ? 'user-message-container' : 'assistant-message-container'}`}
                        style={{
                            display: 'flex',
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            marginBottom: '15px',
                            width: '100%'
                        }}
                    >
                        <div 
                            className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}
                            style={{
                                maxWidth: '80%',
                                padding: '12px 16px',
                                borderRadius: '18px',
                                position: 'relative',
                                wordWrap: 'break-word',
                                backgroundColor: msg.role === 'user' ? '#4a6fa5' : '#2a4a7a',
                                color: 'white',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                marginLeft: msg.role === 'user' ? 'auto' : '0',
                                marginRight: msg.role === 'user' ? '0' : 'auto',
                                borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px',
                                borderBottomLeftRadius: msg.role === 'user' ? '18px' : '4px'
                            }}
                        >
                            <div className="message-content" style={{ lineHeight: '1.5' }}>
                                {msg.content}
                                <span 
                                    className="message-time" 
                                    style={{
                                        display: 'block',
                                        fontSize: '0.7rem',
                                        opacity: 0.8,
                                        marginTop: '6px',
                                        textAlign: 'right',
                                        color: 'rgba(255,255,255,0.7)'
                                    }}
                                >
                                    {formatTimestamp(msg.timestamp)}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="typing-indicator" style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        margin: '10px 0',
                        padding: '10px 15px',
                        width: 'fit-content',
                        backgroundColor: '#2a4a7a',
                        borderRadius: '18px',
                        borderBottomLeftRadius: '4px'
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            margin: '0 2px',
                            backgroundColor: 'rgba(255,255,255,0.7)',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'bounce 1.4s infinite ease-in-out both',
                            '&:nth-child(1)': { animationDelay: '-0.32s' },
                            '&:nth-child(2)': { animationDelay: '-0.16s' }
                        }}></span>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            margin: '0 2px',
                            backgroundColor: 'rgba(255,255,255,0.7)',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'bounce 1.4s infinite ease-in-out both',
                            '&:nth-child(1)': { animationDelay: '-0.32s' },
                            '&:nth-child(2)': { animationDelay: '-0.16s' }
                        }}></span>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            margin: '0 2px',
                            backgroundColor: 'rgba(255,255,255,0.7)',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'bounce 1.4s infinite ease-in-out both',
                            '&:nth-child(1)': { animationDelay: '-0.32s' },
                            '&:nth-child(2)': { animationDelay: '-0.16s' }
                        }}></span>
                    </div>
                )}
            </div>
            
            <style>{
                `@keyframes bounce {
                    0%, 80%, 100% { 
                        transform: scale(0);
                    } 40% { 
                        transform: scale(1.0);
                    }
                }`
            }</style>
            
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
