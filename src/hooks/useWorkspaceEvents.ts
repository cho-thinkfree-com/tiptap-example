import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

interface UseWorkspaceEventsOptions {
    workspaceId?: string;
    onWorkspaceUpdated?: (event: any) => void;
}

/**
 * Hook to listen for workspace events via WebSocket
 */
export const useWorkspaceEvents = (options: UseWorkspaceEventsOptions = {}) => {
    const { socket, isConnected } = useSocket();
    const { workspaceId, onWorkspaceUpdated } = options;

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleWorkspaceUpdated = (event: any) => {
            // Filter by workspaceId if specified
            if (workspaceId && event.workspaceId !== workspaceId) return;

            console.log('[useWorkspaceEvents] workspace:updated', event);
            onWorkspaceUpdated?.(event);
        };

        // Register event listener
        socket.on('workspace:updated', handleWorkspaceUpdated);

        return () => {
            // Cleanup event listener
            socket.off('workspace:updated', handleWorkspaceUpdated);
        };
    }, [socket, isConnected, workspaceId, onWorkspaceUpdated]);
};
