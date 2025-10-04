import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function AIChat({ selectedResourceId }) {
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

    // Faire défiler vers le bas à chaque nouveau message
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadResourceContent = async (resourceId) => {
        if (!resourceId) {
            console.error('No resource ID provided');
            return;
        }
        
        try {
            setIsLoading(true);
            console.log(`Loading resource with ID: ${resourceId}`);
            
            const response = await axios.get(`/api/resources/${resourceId}/content`);
            
            if (!response.data || !response.data.data) {
                throw new Error('API response invalid');
            }
            
            const resource = response.data.data;
            console.log('Resource loaded successfully:', resource);

            const linkHref = `/resources/${resourceId}`;
            const contentHtml = `Selected resource: <a href="${linkHref}" target="_blank" rel="noopener noreferrer">${resource.title}</a>`;

            setMessages([{
                id: Date.now(),
                role: 'assistant',
                content: contentHtml,
                resourceId: resourceId
            }]);
        } catch (error) {
            console.error('Error loading resource:', error);
            
            let errorMessage = 'Sorry, I could not load this resource.';
            
            if (error.response) {
                // The request was made and the server responded with an error code
                console.error('Error details:', error.response.data);
                
                if (error.response.status === 404) {
                    errorMessage = 'The requested resource was not found.';
                    if (error.response.data.ressources_disponibles) {
                        errorMessage += ' Here are the available resources: ' + 
                            error.response.data.ressources_disponibles.map(r => r.title).join(', ');
                    }
                } else if (error.response.data.error) {
                    errorMessage = error.response.data.error;
                }
            } else if (error.request) {
                // The request was made but no response was received
                console.error('No server response:', error.request);
                errorMessage = 'Unable to connect to the server. Check your internet connection.';
            }
            
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'assistant',
                content: errorMessage,
                isError: true
            }]);
        } finally {
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
                resourceId: selectedResourceId || null
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

    return (
        <div className="chat-container">
            <div className="chat-header">
                ASTRAMIND
            </div>
            
            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.role}`}>
                        <div className="message-content">
                            {msg.content}
                            {msg.isError && <span className="text-danger"> (Error)</span>}
                        </div>
                    </div>
                ))}
                
                <div ref={messagesEndRef} />
            </div>

            <div className="message-input">
                {messages.some(m => m.isLanguageSelection) ? (
                    <div className="language-selection">
                        <button 
                            onClick={() => handleLanguageSelect('en')}
                            className="btn btn-primary me-2"
                        >
                            English
                        </button>
                        <button 
                            onClick={() => handleLanguageSelect('fr')}
                            className="btn btn-primary"
                        >
                            Français
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="d-flex">
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={language === 'fr' ? 'Tapez votre message...' : 'Type your message...'}
                            disabled={isLoading}
                            className="form-control me-2"
                        />
                        <button 
                            type="submit" 
                            disabled={isLoading || !message.trim()}
                            className="btn btn-primary"
                        >
                            {isLoading ? 
                                (language === 'fr' ? 'Envoi en cours...' : 'Sending...') : 
                                (language === 'fr' ? 'Envoyer' : 'Send')
                            }
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
