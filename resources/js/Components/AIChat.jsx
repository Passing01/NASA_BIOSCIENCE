import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function AIChat({ selectedResourceId }) {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Charger les messages initiaux ou les suggestions
    useEffect(() => {
        if (selectedResourceId) {
            loadResourceContent(selectedResourceId);
        } else if (messages.length === 0) {
            // Ne charger le message de bienvenue que si aucun message n'est déjà affiché
            setMessages([{
                id: Date.now(),
                role: 'assistant',
                content: "Bonjour ! Je suis votre assistant IA pour NASA Bioscience. Posez vos questions en lien direct avec une ressource sélectionnée."
            }]);
        }
    }, [selectedResourceId]); // Ne pas inclure messages dans les dépendances pour éviter les boucles infinies

    // Faire défiler vers le bas à chaque nouveau message
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadResourceContent = async (resourceId) => {
        if (!resourceId) {
            console.error('Aucun ID de ressource fourni');
            return;
        }
        
        try {
            setIsLoading(true);
            console.log(`Chargement de la ressource avec l'ID: ${resourceId}`);
            
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

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || isLoading) return;

        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: message
        };

        // Ajouter le message de l'utilisateur
        setMessages(prev => [...prev, userMessage]);
        setMessage('');
        setIsLoading(true);

        try {
            // Préparer le contexte de la conversation (les 5 derniers messages)
            const context = messages
                .slice(-5)
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

            // Call the API to get a response
            console.log('Envoi du message avec les données :', {
                message: userMessage.content,
                context,
                resourceId: selectedResourceId ? parseInt(selectedResourceId) : null
            });
            
            const hasResource = !!(selectedResourceId && parseInt(selectedResourceId));

            if (hasResource) {
                // Streaming SSE via fetch POST
                const assistantId = Date.now() + 1;
                setMessages(prev => [...prev, {
                    id: assistantId,
                    role: 'assistant',
                    content: '',
                }]);

                console.log('Envoi de la requête de streaming...');
                const resp = await fetch('/api/ai/chat/stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    },
                    body: JSON.stringify({
                        message: userMessage.content,
                        context,
                        resourceId: parseInt(selectedResourceId),
                    })
                });

                console.log('Réponse reçue, statut:', resp.status);
                console.log('En-têtes de la réponse:', Object.fromEntries(resp.headers.entries()));

                if (!resp.ok) {
                    const errorText = await resp.text();
                    console.error('Erreur de réponse:', resp.status, errorText);
                    throw new Error(`Erreur HTTP ${resp.status}: ${errorText}`);
                }

                if (!resp.body) {
                    throw new Error('Le corps de la réponse est vide');
                }

                const reader = resp.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';
                let done = false;
                let fullResponse = '';

                console.log('Début de la lecture du flux SSE...');
                
                try {
                    while (!done) {
                        const { value, done: readerDone } = await reader.read();
                        done = readerDone;
                        
                        if (value) {
                            // Décoder les données reçues
                            const chunk = decoder.decode(value, { stream: !readerDone });
                            console.log('Chunk reçu:', chunk);
                            buffer += chunk;
                            
                            // Traiter les événements SSE (format: "event: name\ndata: {...}\n\n")
                            const events = buffer.split('\n\n');
                            buffer = events.pop() || ''; // Garder la dernière partie incomplète
                            
                            console.log('Événements à traiter:', events.length, 'Buffer restant:', buffer.length);
                            
                            for (const event of events) {
                                if (!event.trim()) continue;
                                
                                console.log('Traitement de l\'événement:', event);
                                
                                let eventData = '';
                                let inDataSection = false;
                                
                                // Parser manuellement l'événement SSE
                                const lines = event.split('\n');
                                for (const line of lines) {
                                    console.log('Traitement de la ligne:', line);
                                    
                                    if (line.startsWith('data: ')) {
                                        eventData += line.substring(6); // Enlever 'data: '
                                        inDataSection = true;
                                        console.log('Données trouvées:', eventData);
                                    } else if (inDataSection && line.startsWith(':')) {
                                        // Ligne de commentaire, ignorer
                                        console.log('Commentaire ignoré:', line);
                                    } else if (inDataSection && (line.trim() === '' || line === 'event: done')) {
                                        // Fin de la section de données
                                        inDataSection = false;
                                        
                                        // Traiter les données si elles existent
                                        if (eventData) {
                                            console.log('Données complètes à parser:', eventData);
                                            try {
                                                const data = JSON.parse(eventData);
                                                console.log('Données parsées avec succès:', data);
                                                
                                                // Vérifier si c'est un événement de fin
                                                if (line.trim() === 'event: done') {
                                                    console.log('Événement de fin reçu');
                                                    done = true;
                                                    continue;
                                                }
                                                
                                                // Traiter la structure de réponse
                                                if (data.delta) {
                                                    // Format de réponse en streaming
                                                    console.log('Delta reçu:', data.delta);
                                                    fullResponse += data.delta;
                                                    console.log('Réponse complète mise à jour:', fullResponse);
                                                    setMessages(prev => {
                                                        const updated = prev.map(m => 
                                                            m.id === assistantId 
                                                                ? { ...m, content: fullResponse } 
                                                                : m
                                                        );
                                                        console.log('Messages après mise à jour:', updated);
                                                        return updated;
                                                    });
                                                } else if (data.candidates?.[0]?.content?.parts) {
                                                    // Format de réponse Gemini
                                                    console.log('Réponse Gemini reçue:', data.candidates[0].content.parts);
                                                    for (const part of data.candidates[0].content.parts) {
                                                        if (part.text) {
                                                            fullResponse += part.text;
                                                            console.log('Texte ajouté à la réponse:', part.text);
                                                            setMessages(prev => {
                                                                const updated = prev.map(m => 
                                                                    m.id === assistantId 
                                                                        ? { ...m, content: fullResponse } 
                                                                        : m
                                                                );
                                                                console.log('Messages après mise à jour Gemini:', updated);
                                                                return updated;
                                                            });
                                                        }
                                                    }
                                                } else {
                                                    console.warn('Format de réponse non reconnu:', data);
                                                }
                                            } catch (e) {
                                                console.warn('Erreur de parsing des données SSE:', e, 'Données:', eventData);
                                            }
                                        }
                                        
                                        eventData = ''; // Réinitialiser pour le prochain événement
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Erreur lors de la lecture du flux SSE:', e);
                    throw e;
                } finally {
                    reader.releaseLock();
                }
                // Pas de suggestedQuestions via stream pour l'instant
            } else {
                // Pas de ressource -> réponse non-stream (refus côté backend)
                try {
                    const response = await axios.post('/api/ai/chat', {
                        message: userMessage.content,
                        context,
                        resourceId: null,
                        fastMode: false
                    });
                    
                    console.log('Réponse reçue :', response.data);
                    setMessages(prev => [...prev, {
                        id: Date.now() + 1,
                        role: 'assistant',
                        content: response.data.response,
                        suggestedQuestions: response.data.suggested_questions || []
                    }]);
                } catch (error) {
                    console.error('Erreur lors de la récupération de la réponse non-stream:', error);
                    throw error; // Laisser le bloc catch externe gérer l'erreur
                }
            }
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message :', error);
            console.error('Détails de l\'erreur:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // Vérifier si c'est une erreur de parsing JSON
            if (error instanceof SyntaxError && error.message.includes('JSON')) {
                console.warn('Erreur de parsing JSON - Données reçues:', error.data || 'Aucune donnée');
            }
            
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: `Désolé, une erreur est survenue : ${error.message || 'Erreur inconnue'}. Veuillez réessayer.`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                Assistant IA pour NASA Bioscience
            </div>
            
            <div className="chat-messages">
                {messages.map((msg) => (
                    <div 
                        key={msg.id} 
                        className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
                    >
                        {/* Contenu du message avec HTML */}
                        {msg.role === 'assistant' ? (
                            <div 
                                className="message-content"
                                dangerouslySetInnerHTML={{ __html: msg.content }}
                            />
                        ) : (
                            <div className="message-content">
                                {msg.content}
                            </div>
                        )}
                        
                        {/* Questions suggérées */}
                        {msg.role === 'assistant' && msg.suggestedQuestions?.length > 0 && (
                            <div className="suggested-questions">
                                <p>Questions suggérées :</p>
                                <div className="suggested-questions-list">
                                    {msg.suggestedQuestions.map((question, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setMessage(question)}
                                            className="suggested-question"
                                        >
                                            {question}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                
                {isLoading && (
                    <div className="message assistant-message">
                        <div className="typing-indicator">
                            <div className="typing-dot" style={{ animationDelay: '0ms' }}></div>
                            <div className="typing-dot" style={{ animationDelay: '150ms' }}></div>
                            <div className="typing-dot" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
                <form onSubmit={handleSendMessage} className="chat-form">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Posez votre question liée à la ressource..."
                        className="chat-input"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!message.trim() || isLoading}
                        className="send-button"
                    >
                        Envoyer
                    </button>
                </form>
            </div>
        </div>
    );
}
