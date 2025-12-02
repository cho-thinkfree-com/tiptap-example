import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useParams, useLocation } from 'react-router-dom';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
    children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { workspaceId } = useParams<{ workspaceId?: string }>();
    const location = useLocation();
    const currentWorkspaceRef = useRef<string | null>(null);

    // Initialize socket connection
    useEffect(() => {
        if (!isAuthenticated) {
            // Disconnect if not authenticated
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        // Create socket connection
        const serverUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9920';
        const newSocket = io(serverUrl, {
            withCredentials: true,
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setIsConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated]);

    // Handle workspace room joining/leaving
    useEffect(() => {
        if (!socket || !isConnected) return;

        // Extract workspaceId from URL path or params
        let currentWorkspace: string | null = null;

        if (workspaceId) {
            currentWorkspace = workspaceId;
        } else {
            // Try to extract from pathname (e.g., /workspace/:workspaceId/...)
            const match = location.pathname.match(/\/workspace\/([^\/]+)/);
            if (match) {
                currentWorkspace = match[1];
            }
        }

        // Leave previous workspace room if changed
        if (currentWorkspaceRef.current && currentWorkspaceRef.current !== currentWorkspace) {
            socket.emit('leave-workspace', currentWorkspaceRef.current);
            console.log('Left workspace room:', currentWorkspaceRef.current);
        }

        // Join new workspace room
        if (currentWorkspace) {
            socket.emit('join-workspace', currentWorkspace);
            console.log('Joined workspace room:', currentWorkspace);
            currentWorkspaceRef.current = currentWorkspace;
        } else {
            currentWorkspaceRef.current = null;
        }
    }, [socket, isConnected, workspaceId, location.pathname]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
