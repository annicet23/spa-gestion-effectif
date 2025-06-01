import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './ChatPage.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const socket = io(API_BASE_URL);

function ChatPage() {
    const { user, loading } = useAuth();
    const [messageInput, setMessageInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [chatType, setChatType] = useState('broadcast');
    const [file, setFile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [unreadCounts, setUnreadCounts] = useState({});
    const [lastMessageTimestamps, setLastMessageTimestamps] = useState({});
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState({});
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Main effect for socket connection and data loading
    useEffect(() => {
        if (loading || !user) {
            return;
        }

        socket.emit('identify', user.id);

        const handleChatMessage = (message) => {
            console.log("[ChatPage] Message reçu :", message);

            setMessages((prevMessages) => {
                const isForSelectedChat =
                    (chatType === 'broadcast' && message.receiver_id === null && !message.group_id) ||
                    (chatType === 'private' && selectedChat &&
                        ((message.sender_id === user.id && message.receiver_id === selectedChat.id) ||
                         (message.sender_id === selectedChat.id && message.receiver_id === user.id))) ||
                    (chatType === 'group' && selectedChat && message.group_id === selectedChat.id);

                if (!isForSelectedChat) {
                    const chatId = message.group_id ? `group-${message.group_id}` : message.sender_id;
                    setUnreadCounts(prevCounts => ({
                        ...prevCounts,
                        [chatId]: (prevCounts[chatId] || 0) + 1
                    }));
                }

                // Update last message timestamp for sorting
                const chatIdentifier = message.group_id ? `group-${message.group_id}` :
                                         (message.receiver_id === user.id ? message.sender_id : message.receiver_id);
                setLastMessageTimestamps(prev => ({
                    ...prev,
                    [chatIdentifier]: new Date(message.timestamp).getTime()
                }));

                return isForSelectedChat ? [...prevMessages, message] : prevMessages;
            });
        };

        const handleTypingStart = (data) => {
            if (data.userId !== user.id) {
                setTypingUsers(prev => ({
                    ...prev,
                    [data.userId]: { username: data.username, timestamp: Date.now() }
                }));
            }
        };

        const handleTypingStop = (data) => {
            setTypingUsers(prev => {
                const newTyping = { ...prev };
                delete newTyping[data.userId];
                return newTyping;
            });
        };

        socket.on('chatMessage', handleChatMessage);
        socket.on('typingStart', handleTypingStart);
        socket.on('typingStop', handleTypingStop);

        const loadChatData = async () => {
            try {
                const usersRes = await axios.get(`${API_BASE_URL}api/chat/users`);
                setUsers(usersRes.data.filter(u => u.id !== user.id));

                const groupsRes = await axios.get(`${API_BASE_URL}api/chat/groups`);
                setGroups(groupsRes.data);

                // Load unread counts and timestamps
                const unreadRes = await axios.get(`${API_BASE_URL}api/chat/unread-status?userId=${user.id}`);
                const initialUnreadCounts = {};
                const initialLastMessageTimestamps = {};

                unreadRes.data.forEach(chatStatus => {
                    const chatIdKey = chatStatus.group_id ? `group-${chatStatus.group_id}` : chatStatus.other_user_id;
                    if (chatStatus.unread_count > 0) {
                        initialUnreadCounts[chatIdKey] = chatStatus.unread_count;
                    }
                    initialLastMessageTimestamps[chatIdKey] = new Date(chatStatus.last_message_timestamp).getTime();
                });

                setUnreadCounts(initialUnreadCounts);
                setLastMessageTimestamps(initialLastMessageTimestamps);

                // Load initial chat history
                let historyUrl = '';
                if (chatType === 'broadcast') {
                    historyUrl = `${API_BASE_URL}api/chat/messages?type=broadcast`;
                } else if (chatType === 'private' && selectedChat) {
                    historyUrl = `${API_BASE_URL}api/chat/messages?type=private&targetId=${selectedChat.id}&currentUserId=${user.id}`;
                } else if (chatType === 'group' && selectedChat) {
                    historyUrl = `${API_BASE_URL}api/chat/messages?type=group&groupId=${selectedChat.id}`;
                }

                if (historyUrl) {
                    const historyRes = await axios.get(historyUrl);
                    setMessages(historyRes.data);
                }
            } catch (error) {
                console.error('Erreur lors du chargement des données du chat:', error);
            }
        };

        loadChatData();

        // Cleanup typing indicators every 3 seconds
        const typingCleanup = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => {
                const filtered = {};
                Object.entries(prev).forEach(([userId, data]) => {
                    if (now - data.timestamp < 3000) {
                        filtered[userId] = data;
                    }
                });
                return filtered;
            });
        }, 3000);

        return () => {
            socket.off('chatMessage', handleChatMessage);
            socket.off('typingStart', handleTypingStart);
            socket.off('typingStop', handleTypingStop);
            clearInterval(typingCleanup);
        };
    }, [user, loading, chatType, selectedChat]);

    // Mark messages as read
    const markMessagesAsRead = useCallback(async (chatId, chatTypeToMark) => {
        if (!user) return;
        try {
            setUnreadCounts(prevCounts => {
                const newCounts = { ...prevCounts };
                const key = chatTypeToMark === 'group' ? `group-${chatId}` : chatId;
                delete newCounts[key];
                return newCounts;
            });

            await axios.post(`${API_BASE_URL}api/chat/mark-as-read`, {
                userId: user.id,
                chatId: chatId,
                chatType: chatTypeToMark
            });
        } catch (error) {
            console.error('Erreur lors du marquage des messages comme lus:', error);
        }
    }, [user]);

    // Handle chat selection
    const handleChatSelect = useCallback(async (chatObject, type) => {
        setSelectedChat(chatObject);
        setChatType(type);
        setMessages([]);
        setSearchTerm('');

        let historyUrl = '';
        if (type === 'private') {
            historyUrl = `${API_BASE_URL}api/chat/messages?type=private&targetId=${chatObject.id}&currentUserId=${user.id}`;
        } else if (type === 'group') {
            historyUrl = `${API_BASE_URL}api/chat/messages?type=group&groupId=${chatObject.id}`;
        } else if (type === 'broadcast') {
            historyUrl = `${API_BASE_URL}api/chat/messages?type=broadcast`;
        }

        if (historyUrl) {
            try {
                const historyRes = await axios.get(historyUrl);
                setMessages(historyRes.data);
                if (type !== 'broadcast') {
                    markMessagesAsRead(chatObject.id, type);
                }
            } catch (error) {
                console.error('Erreur lors du chargement de l\'historique des messages:', error);
            }
        }
    }, [user, markMessagesAsRead]);

    // Handle broadcast selection
    const handleBroadcastSelect = useCallback(() => {
        handleChatSelect(null, 'broadcast');
    }, [handleChatSelect]);

    // Handle typing indicators
    const handleInputChange = useCallback((e) => {
        setMessageInput(e.target.value);

        if (!isTyping && e.target.value.trim()) {
            setIsTyping(true);
            socket.emit('typingStart', {
                userId: user.id,
                username: user.username,
                chatType,
                chatId: selectedChat?.id
            });
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.emit('typingStop', {
                userId: user.id,
                chatType,
                chatId: selectedChat?.id
            });
        }, 2000);
    }, [isTyping, user, chatType, selectedChat]);

    // Handle message sending
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (loading || !user) return;

        // Stop typing when sending
        if (isTyping) {
            setIsTyping(false);
            socket.emit('typingStop', {
                userId: user.id,
                chatType,
                chatId: selectedChat?.id
            });
        }

        let fileData = null;

        if (file) {
            const formData = new FormData();
            formData.append('chatFile', file);

            try {
                const uploadRes = await axios.post(`${API_BASE_URL}api/chat/upload-file`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                fileData = uploadRes.data.file;
            } catch (error) {
                console.error('Erreur lors de l\'upload du fichier:', error);
                alert('Erreur lors de l\'upload du fichier.');
                return;
            }
        }

        if (messageInput.trim() || fileData) {
            const messagePayload = {
                senderId: user.id,
                messageText: messageInput.trim() || null,
                receiverId: chatType === 'private' && selectedChat ? selectedChat.id : null,
                groupId: chatType === 'group' && selectedChat ? selectedChat.id : null,
                fileData: fileData
            };

            socket.emit('chatMessage', messagePayload);
            setMessageInput('');
            setFile(null);
            if (document.getElementById('fileInput')) {
                document.getElementById('fileInput').value = '';
            }
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            // Check file size (max 10MB)
            if (selectedFile.size > 10 * 1024 * 1024) {
                alert('Le fichier est trop volumineux. Taille maximum : 10MB');
                e.target.value = '';
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim() || selectedGroupMembers.length === 0) {
            alert("Veuillez donner un nom au groupe et sélectionner au moins un membre.");
            return;
        }

        try {
            const response = await axios.post(`${API_BASE_URL}api/chat/groups`, {
                name: newGroupName,
                members: [...selectedGroupMembers, user.id]
            });

            setGroups(prevGroups => [...prevGroups, response.data]);
            setShowCreateGroupModal(false);
            setNewGroupName('');
            setSelectedGroupMembers([]);
            handleChatSelect(response.data, 'group');
        } catch (error) {
            console.error('Erreur lors de la création du groupe:', error);
            alert('Échec de la création du groupe. Veuillez réessayer.');
        }
    };

    const handleToggleGroupMember = (userId) => {
        setSelectedGroupMembers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    // Fonction pour formater le timestamp du dernier message
    const formatLastMessageTime = useCallback((timestamp) => {
        const now = new Date();
        const messageDate = new Date(timestamp);
        const diffInMinutes = Math.floor((now - messageDate) / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 1) {
            return 'À l\'instant';
        } else if (diffInMinutes < 60) {
            return `Il y a ${diffInMinutes}min`;
        } else if (diffInHours < 24) {
            return `Il y a ${diffInHours}h`;
        } else if (diffInDays === 1) {
            return 'Hier';
        } else if (diffInDays < 7) {
            return `Il y a ${diffInDays}j`;
        } else {
            return messageDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit'
            });
        }
    }, []);

    // TRI CHRONOLOGIQUE: Plus récent en haut
    const DISPLAY_CHAT_LIMIT = 8;
    const chatsToDisplay = useMemo(() => {
        const allChats = [
            ...users.map(u => ({ ...u, type: 'private', chat_id: u.id, display_name: u.username })),
            ...groups.map(g => ({ ...g, type: 'group', chat_id: g.id, display_name: g.name }))
        ].filter(chat => {
            if (!searchTerm) return true;
            return chat.display_name.toLowerCase().includes(searchTerm.toLowerCase());
        });

        // TRI CHRONOLOGIQUE: Plus récent en haut (sans priorité pour non lus)
        allChats.sort((a, b) => {
            const aId = a.type === 'group' ? `group-${a.id}` : a.id;
            const bId = b.type === 'group' ? `group-${b.id}` : b.id;

            const aLastMessageTime = lastMessageTimestamps[aId] || 0;
            const bLastMessageTime = lastMessageTimestamps[bId] || 0;

            // Tri uniquement par timestamp (plus récent en premier)
            if (aLastMessageTime !== bLastMessageTime) {
                return bLastMessageTime - aLastMessageTime;
            }

            // Si même timestamp, tri alphabétique
            return a.display_name.localeCompare(b.display_name);
        });

        return searchTerm === '' ? allChats.slice(0, DISPLAY_CHAT_LIMIT) : allChats;
    }, [users, groups, searchTerm, lastMessageTimestamps]);

    // Get current typing users for selected chat
    const currentTypingUsers = useMemo(() => {
        return Object.values(typingUsers).filter(userTyping =>
            // Filter typing users for current chat context
            true // You can add chat-specific filtering here if needed
        );
    }, [typingUsers]);

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Chargement...</span>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center mt-5 alert alert-danger">
                Vous devez être connecté pour accéder au chat.
            </div>
        );
    }

    return (
        <div className="chat-page-wrapper">
            <div className="container-fluid chat-page d-flex flex-column p-0">
                <div className="row flex-grow-1 mx-0">
                    {/* Sidebar - Users and Groups */}
                    <div className="col-12 col-md-3 border-end p-0 d-flex flex-column bg-light-subtle">
                        <div className="card shadow-sm border-0 flex-grow-1 rounded-0">
                            <div className="card-header bg-primary text-white d-flex align-items-center justify-content-between">
                                <h5 className="mb-0">
                                    <i className="bi bi-people-fill me-2"></i>
                                    Conversations
                                    {Object.keys(unreadCounts).length > 0 && (
                                        <span className="badge bg-danger ms-2">
                                            {Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)}
                                        </span>
                                    )}
                                </h5>
                                <button
                                    className="btn btn-sm btn-outline-light"
                                    onClick={() => setShowCreateGroupModal(true)}
                                    title="Créer un nouveau groupe"
                                >
                                    <i className="bi bi-plus-lg"></i>
                                </button>
                            </div>

                            {/* Search Bar */}
                            <div className="user-search-bar p-3 border-bottom">
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0">
                                        <i className="bi bi-search text-muted"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0"
                                        placeholder="Rechercher..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <button
                                            className="btn btn-outline-secondary border-start-0"
                                            type="button"
                                            onClick={() => setSearchTerm('')}
                                        >
                                            <i className="bi bi-x"></i>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Chat List */}
                            <ul className="list-group list-group-flush chat-users-list">
                                {/* Broadcast Chat */}
                                <li
                                    className={`list-group-item list-group-item-action ${chatType === 'broadcast' && !selectedChat ? 'active' : ''}`}
                                    onClick={handleBroadcastSelect}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="d-flex align-items-center justify-content-between w-100">
                                        <div className="d-flex align-items-center">
                                            <i className="bi bi-megaphone-fill me-3 text-warning"></i>
                                            <span className="fw-semibold">Chat de diffusion</span>
                                        </div>
                                    </div>
                                </li>

                                {/* Individual Chats avec ordre chronologique */}
                                {chatsToDisplay.map((chat) => {
                                    const chatKey = chat.type === 'group' ? `group-${chat.id}` : chat.id;
                                    const unreadCount = unreadCounts[chatKey] || 0;
                                    const lastMessageTime = lastMessageTimestamps[chatKey];

                                    return (
                                        <li
                                            key={`${chat.type}-${chat.id}`}
                                            className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center
                                                ${selectedChat?.id === chat.id && chatType === chat.type ? 'active' : ''}`}
                                            onClick={() => handleChatSelect(chat, chat.type)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="d-flex align-items-center flex-grow-1">
                                                <i className={`bi ${chat.type === 'group' ? 'bi-people-fill text-info' : 'bi-person-fill text-primary'} me-3`}></i>
                                                <div className="flex-grow-1">
                                                    <div className="d-flex align-items-center justify-content-between">
                                                        <span className={`chat-name ${unreadCount > 0 ? 'fw-bold' : 'fw-normal'}`}>
                                                            {chat.display_name}
                                                        </span>
                                                        {/* Badge des messages non lus */}
                                                        {unreadCount > 0 && (
                                                            <span className="badge bg-danger rounded-pill unread-badge ms-2">
                                                                {unreadCount > 99 ? '99+' : unreadCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Timestamp du dernier message */}
                                                    {lastMessageTime && (
                                                        <small className="text-muted d-block">
                                                            {formatLastMessageTime(lastMessageTime)}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}

                                {/* Show more indicator */}
                                {searchTerm === '' && (users.length + groups.length) > DISPLAY_CHAT_LIMIT && (
                                    <li className="list-group-item text-center text-muted small py-3">
                                        <i className="bi bi-three-dots"></i>
                                        {(users.length + groups.length) - DISPLAY_CHAT_LIMIT} autres conversations
                                    </li>
                                )}

                                {/* No results */}
                                {chatsToDisplay.length === 0 && searchTerm !== '' && (
                                    <li className="list-group-item text-center text-muted py-4">
                                        <i className="bi bi-search me-2"></i>
                                        Aucune conversation trouvée
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Main Chat Area */}
                    <div className="col-12 col-md-9 p-0 d-flex flex-column bg-light">
                        <div className="card shadow-sm border-0 flex-grow-1 rounded-0">
                            {/* Chat Header */}
                            <div className="card-header bg-success text-white d-flex align-items-center justify-content-between">
                                <div>
                                    {chatType === 'broadcast' && (
                                        <h5 className="mb-0">
                                            <i className="bi bi-megaphone-fill me-2"></i>
                                            Chat de diffusion
                                        </h5>
                                    )}
                                    {chatType === 'private' && selectedChat && (
                                        <h5 className="mb-0">
                                            <i className="bi bi-chat-dots-fill me-2"></i>
                                            {selectedChat.username}
                                        </h5>
                                    )}
                                    {chatType === 'group' && selectedChat && (
                                        <h5 className="mb-0">
                                            <i className="bi bi-people-fill me-2"></i>
                                            {selectedChat.name}
                                        </h5>
                                    )}
                                    {!selectedChat && chatType !== 'broadcast' && (
                                        <h5 className="mb-0">Sélectionnez une conversation</h5>
                                    )}
                                </div>

                                {/* Connection Status */}
                                <div className="d-flex align-items-center">
                                    <span className="badge bg-light text-success">
                                        <i className="bi bi-circle-fill me-1" style={{fontSize: '0.5rem'}}></i>
                                        En ligne
                                    </span>
                                </div>
                            </div>

                            {/* Messages Container */}
                            <div className="card-body chat-messages-container p-3">
                                {messages.map((msg, index) => (
                                    <div
                                        key={msg.id || index}
                                        className={`d-flex ${msg.sender_id === user.id ? 'justify-content-end' : 'justify-content-start'} mb-3`}
                                    >
                                        <div className={`chat-bubble p-3 rounded shadow-sm ${
                                            msg.sender_id === user.id
                                                ? 'bg-primary text-white my-message'
                                                : 'bg-light text-dark other-message'
                                        }`}>
                                            {msg.sender_id !== user.id && (
                                                <small className="message-sender-username d-block mb-1 fw-bold">
                                                    {users.find(u => u.id === msg.sender_id)?.username || 'Inconnu'}
                                                </small>
                                            )}

                                            {msg.message_text && (
                                                <p className="mb-1 message-text">{msg.message_text}</p>
                                            )}

                                            {msg.file_url && (
                                                <div className="mt-2">
                                                    {msg.file_mime_type && msg.file_mime_type.startsWith('image/') ? (
                                                        <img
                                                            src={msg.file_url}
                                                            alt={msg.original_file_name}
                                                            className="img-fluid rounded message-image"
                                                            style={{ maxWidth: '250px', maxHeight: '200px', cursor: 'pointer' }}
                                                        />
                                                    ) : (
                                                        <a
                                                            href={msg.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-sm btn-info text-white d-flex align-items-center"
                                                        >
                                                            <i className="bi bi-download me-1"></i>
                                                            Télécharger {msg.original_file_name}
                                                            ({Math.round(msg.file_size_bytes / 1024)} KB)
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            <small className="message-timestamp d-block text-end mt-1">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </small>
                                        </div>
                                    </div>
                                ))}

                                {/* Typing Indicators */}
                                {currentTypingUsers.length > 0 && (
                                    <div className="d-flex justify-content-start mb-3">
                                        <div className="chat-bubble bg-light text-muted p-3 rounded shadow-sm">
                                            <div className="typing-indicator">
                                                <span className="typing-dot"></span>
                                                <span className="typing-dot"></span>
                                                <span className="typing-dot"></span>
                                            </div>
                                            <small>
                                                {currentTypingUsers.map(u => u.username).join(', ')}
                                                {currentTypingUsers.length === 1 ? ' est en train d\'écrire...' : ' sont en train d\'écrire...'}
                                            </small>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div className="card-footer bg-white border-top p-3">
                                <form onSubmit={handleSendMessage} className="d-flex align-items-center gap-2">
                                    <label htmlFor="fileInput" className="btn btn-outline-secondary flex-shrink-0" title="Joindre un fichier">
                                        <i className="bi bi-paperclip"></i>
                                    </label>
                                    <input
                                        type="file"
                                        id="fileInput"
                                        className="d-none"
                                        onChange={handleFileChange}
                                        accept="image/*,.pdf,.doc,.docx,.txt"
                                    />

                                    {file && (
                                        <div className="file-preview bg-light rounded p-2 d-flex align-items-center">
                                            <i className="bi bi-file-earmark me-2"></i>
                                            <span className="text-truncate me-2" style={{ maxWidth: '100px' }}>
                                                {file.name}
                                            </span>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger p-1"
                                                onClick={() => {
                                                    setFile(null);
                                                    document.getElementById('fileInput').value = '';
                                                }}
                                            >
                                                <i className="bi bi-x"></i>
                                            </button>
                                        </div>
                                    )}

                                    <input
                                        type="text"
                                        className="form-control flex-grow-1"
                                        placeholder={selectedChat || chatType === 'broadcast' ? "Écrivez votre message..." : "Sélectionnez une conversation"}
                                        value={messageInput}
                                        onChange={handleInputChange}
                                        disabled={!user || (!selectedChat && chatType !== 'broadcast')}
                                        maxLength={1000}
                                    />

                                    <button
                                        type="submit"
                                        className="btn btn-primary flex-shrink-0"
                                        disabled={!user || (!selectedChat && chatType !== 'broadcast') || (!messageInput.trim() && !file)}
                                        title="Envoyer le message"
                                    >
                                        <i className="bi bi-send-fill"></i>
                                    </button>
                                </form>

                                {/* Character count */}
                                {messageInput.length > 800 && (
                                    <small className="text-muted mt-1 d-block text-end">
                                        {messageInput.length}/1000 caractères
                                    </small>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Group Modal */}
            {showCreateGroupModal && (
                <div className="create-group-modal-backdrop" onClick={(e) => {
                    if (e.target === e.currentTarget) setShowCreateGroupModal(false);
                }}>
                    <div className="create-group-modal">
                        <div className="modal-header">
                            <h5 className="modal-title">
                                <i className="bi bi-people-fill me-2"></i>
                                Créer un nouveau groupe
                            </h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => setShowCreateGroupModal(false)}
                                aria-label="Fermer"
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="mb-3">
                                <label htmlFor="groupName" className="form-label">
                                    <i className="bi bi-tag me-2"></i>
                                    Nom du groupe
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="groupName"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="Ex: Équipe Projet"
                                    maxLength={50}
                                />
                                <small className="form-text text-muted">
                                    {newGroupName.length}/50 caractères
                                </small>
                            </div>

                            <div className="mb-3">
                                <label className="form-label">
                                    <i className="bi bi-person-plus me-2"></i>
                                    Sélectionner les membres ({selectedGroupMembers.length} sélectionné{selectedGroupMembers.length > 1 ? 's' : ''})
                                </label>
                                <div className="group-member-selection">
                                    {users.length === 0 ? (
                                        <p className="text-muted text-center">Aucun utilisateur disponible</p>
                                    ) : (
                                        users.map(user => (
                                            <div key={user.id} className="form-check">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id={`user-${user.id}`}
                                                    checked={selectedGroupMembers.includes(user.id)}
                                                    onChange={() => handleToggleGroupMember(user.id)}
                                                />
                                                <label className="form-check-label" htmlFor={`user-${user.id}`}>
                                                    <i className="bi bi-person me-2"></i>
                                                    {user.username}
                                                </label>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowCreateGroupModal(false)}
                            >
                                <i className="bi bi-x-circle me-2"></i>
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleCreateGroup}
                                disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
                            >
                                <i className="bi bi-check-circle me-2"></i>
                                Créer le groupe
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatPage;