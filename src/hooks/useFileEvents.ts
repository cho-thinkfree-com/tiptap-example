import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

interface UseFileEventsOptions {
    workspaceId?: string;
    folderId?: string | null;
    onFileCreated?: (event: any) => void;
    onFileUpdated?: (event: any) => void;
    onFileDeleted?: (event: any) => void;
    onFileRestored?: (event: any) => void;
}

/**
 * Hook to listen for file system events via WebSocket
 * Automatically filters events by workspaceId if provided
 */
export const useFileEvents = (options: UseFileEventsOptions = {}) => {
    const { socket, isConnected } = useSocket();
    const { workspaceId, onFileCreated, onFileUpdated, onFileDeleted, onFileRestored } = options;

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleFileCreated = (event: any) => {
            // Filter by workspaceId if specified
            if (workspaceId && event.workspaceId !== workspaceId) return;

            console.log('[useFileEvents] file:created', event);
            onFileCreated?.(event);
        };

        const handleFileUpdated = (event: any) => {
            // Filter by workspaceId if specified
            if (workspaceId && event.workspaceId !== workspaceId) return;

            console.log('[useFileEvents] file:updated', event);
            onFileUpdated?.(event);
        };

        const handleFileDeleted = (event: any) => {
            // Filter by workspaceId if specified
            if (workspaceId && event.workspaceId !== workspaceId) return;

            console.log('[useFileEvents] file:deleted', event);
            onFileDeleted?.(event);
        };

        const handleFileRestored = (event: any) => {
            // Filter by workspaceId if specified
            if (workspaceId && event.workspaceId !== workspaceId) return;

            console.log('[useFileEvents] file:restored', event);
            onFileRestored?.(event);
        };

        // Register event listeners
        socket.on('file:created', handleFileCreated);
        socket.on('file:updated', handleFileUpdated);
        socket.on('file:deleted', handleFileDeleted);
        socket.on('file:restored', handleFileRestored);

        return () => {
            // Cleanup event listeners
            socket.off('file:created', handleFileCreated);
            socket.off('file:updated', handleFileUpdated);
            socket.off('file:deleted', handleFileDeleted);
            socket.off('file:restored', handleFileRestored);
        };
    }, [socket, isConnected, workspaceId, onFileCreated, onFileUpdated, onFileDeleted, onFileRestored]);
};
