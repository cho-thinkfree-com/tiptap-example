import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export type LockMode = 'standard' | 'collab';

export interface LockHolder {
    accountId: string;
    socketId: string;
    displayName: string;
    workspaceId?: string;
    updatedAt: number;
}

export interface LockState {
    mode: LockMode | null;
    holder: LockHolder | null;
    collabCount: number;
}

export type LockStatus = 'idle' | 'loading' | 'acquired' | 'locked_standard' | 'locked_collab';

interface UseDocumentLockProps {
    docId: string;
    workspaceId: string;
    displayName: string;
    enabled?: boolean; // If false, won't try to acquire lock automatically, but will watch status
    onLockAcquired?: () => void;
}

export const useDocumentLock = ({ docId, workspaceId, displayName, enabled = true, onLockAcquired }: UseDocumentLockProps) => {
    const { socket } = useSocket();
    const { user } = useAuth();

    const [status, setStatus] = useState<LockStatus>('loading');
    const [lockHolder, setLockHolder] = useState<LockHolder | null>(null);
    const [stealState, setStealState] = useState<'none' | 'stealing' | 'cleanup' | 'rejected' | 'queued'>('none');
    const [stealErrorMessage, setStealErrorMessage] = useState<string | null>(null);
    const [queuePosition, setQueuePosition] = useState<number | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [alertMessage, setAlertMessage] = useState<{ title: string; message: string; type: 'warning' | 'info' | 'error' } | null>(null);

    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearHeartbeat = () => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    };

    const startHeartbeat = useCallback(() => {
        clearHeartbeat();
        if (!socket) return;

        heartbeatRef.current = setInterval(() => {
            socket.emit('doc:lock:heartbeat', { docId });
        }, 10000); // Send heartbeat every 10s
    }, [socket, docId]);

    const requestLock = useCallback(() => {
        if (!socket || !user) return;
        setStatus('loading');
        socket.emit('doc:lock:request', { docId, workspaceId, displayName });
    }, [socket, user, docId, workspaceId, displayName]);

    const releaseLock = useCallback(() => {
        if (!socket) return;
        socket.emit('doc:lock:release', { docId });
        setStatus('idle');
        clearHeartbeat();
    }, [socket, docId]);

    const requestSteal = useCallback(() => {
        if (!socket) return;
        socket.emit('doc:lock:request-steal', { docId });
        setStealErrorMessage(null);
        // Optimistic UI updates are handled by event listeners
    }, [socket, docId]);

    const earlyRelease = useCallback(() => {
        if (!socket) return;
        socket.emit('doc:lock:early-release', { docId });
    }, [socket, docId]);

    useEffect(() => {
        if (!socket) return;

        // Join the document room to receive updates (passive) & Get initial status
        socket.emit('doc:join', { docId });

        const onStatus = (data: { docId: string; status: LockState }) => {
            if (data.docId !== docId) return;

            const currentMode = data.status.mode;

            if (currentMode === 'collab') {
                setStatus('locked_collab');
            } else if (currentMode === 'standard') {
                if (data.status.holder && data.status.holder.socketId === socket.id) {
                    setStatus('acquired');
                    setLockHolder(data.status.holder);
                    startHeartbeat();
                } else {
                    // Check if we were trying to steal, but someone else got it
                    if (stealState !== 'none' && data.status.holder) {
                        const incomingSocketId = data.status.holder.socketId;
                        const targetSocketId = lockHolder?.socketId;

                        // If ownership changed to someone who is NOT me (already checked by else) 
                        // AND NOT the original target (meaning a 3rd party took it)
                        if (targetSocketId && incomingSocketId !== targetSocketId) {
                            console.log('[useDocumentLock] Steal failed - acquired by another user');

                            // If dialog is open, show error there
                            if (stealState === 'stealing' || stealState === 'cleanup' || stealState === 'queued' || stealState === 'rejected') {
                                setStealState('rejected');
                                setStealErrorMessage('다른 사용자가 먼저 권한을 획득했습니다.');
                                setCountdown(null);
                                setQueuePosition(null);
                            } else {
                                setStealState('none');
                                setCountdown(null);
                                setQueuePosition(null);
                                setAlertMessage({
                                    title: '권한 획득 실패',
                                    message: '다른 사용자가 먼저 권한을 획득했습니다. 필요하다면 다시 요청해주세요.',
                                    type: 'error'
                                });
                            }
                        }
                    }

                    setStatus('locked_standard');
                    setLockHolder(data.status.holder);
                }
            } else {
                // Free
                setStatus('idle');
                // Auto-acquire only if enabled
                if (enabled) {
                    requestLock();
                }
            }
        };

        const onGranted = (data: { docId: string }) => {
            if (data.docId !== docId) return;
            setStatus('acquired');
            setLockHolder({ accountId: user?.id || '', displayName: displayName, socketId: socket.id || '', updatedAt: Date.now() });
            setStealState('none');
            setStealErrorMessage(null);
            setCountdown(null);
            setAlertMessage(null);
            startHeartbeat();

            // Trigger callback for content refresh
            if (onLockAcquired) {
                onLockAcquired();
            }
        };

        const onDenied = (data: { docId: string; reason: string; currentLock: LockState }) => {
            if (data.docId !== docId) return;

            if (data.reason === 'locked_collab') {
                setStatus('locked_collab');
            } else {
                setStatus('locked_standard');
                setLockHolder(data.currentLock.holder);
            }
        };

        const onReleased = (data: { docId: string }) => {
            if (data.docId !== docId) return;
            // If we held it, we released it manually usually.
            // If someone else released, status-changed will fire.
        };

        const onStatusChanged = (_data: { docId: string }) => {
            // Re-fetch status to be sure
            socket.emit('doc:join', { docId });
        };

        // Steal Flow - Requester Side
        const onStealCountdown = (data: { docId: string; seconds: number }) => {
            if (data.docId !== docId) return;
            setStealState('stealing');
            setCountdown(data.seconds);
        };

        // Steal Flow - Holder Side
        const onStealAttempt = (data: { docId: string; seconds: number }) => {
            if (data.docId !== docId) return;
            setAlertMessage({
                title: '편집 권한 요청',
                message: `다른 사용자가 편집 권한을 요청했습니다. ${data.seconds}초 후 권한이 넘어갑니다.`,
                type: 'warning'
            });
            setCountdown(data.seconds);
        };

        const onStealCleanup = (data: { docId: string; seconds: number }) => {
            if (data.docId !== docId) return;
            setStealState('cleanup');
            setCountdown(data.seconds);

            if (status === 'acquired') {
                setAlertMessage({
                    title: '편집 종료 중',
                    message: `편집 권한을 넘겨주는 중입니다. (저장 및 정리 중... ${data.seconds}초)`,
                    type: 'info'
                });
            }
        };

        const onLockLost = (data: { docId: string }) => {
            if (data.docId !== docId) return;
            setStatus('idle'); // Or 'locked_by_other'
            clearHeartbeat();
            setAlertMessage({
                title: '편집 권한 종료',
                message: '편집 권한이 다른 사용자에게 넘어갔습니다. 뷰어 모드로 전환됩니다.',
                type: 'info'
            });
            // Force page reload to ensure clean state transition to Viewer
            window.location.reload();
        };

        const onStealComplete = (data: { docId: string }) => {
            if (data.docId !== docId) return;
            // 'granted' event is usually sent for the new owner, so we usually don't need to do anything here
            // But if we want to be safe or if granted isn't sent:
            if (stealState === 'cleanup' || stealState === 'stealing') {
                // We rely on onGranted for the state update
            }
        };

        const onStealRejected = (data: { docId: string }) => {
            if (data.docId !== docId) return;
            setStealState('rejected');
            setStealErrorMessage('현재 편집자가 권한 요청을 거절했습니다.');
            setCountdown(null);
            // No alert message, handled by Dialog
        };

        const onStealFailed = (data: { message: string }) => {
            // Always show steal failure in the dialog as this event is targeted to the requester
            setStealState('rejected');
            setStealErrorMessage(data.message || '다른 사용자가 먼저 권한을 획득했습니다.');
            setCountdown(null);
            setQueuePosition(null);
            setAlertMessage(null);
        };

        const onStealCancelled = (data: { docId: string }) => {
            if (data.docId !== docId) return;
            // If I am holder, clear warning
            if (status === 'acquired') {
                setAlertMessage(null);
                setCountdown(null);
            }
            // If I am observer, maybe just clear countdown if shown?
        };

        const onStealQueued = (data: { docId: string; position: number }) => {
            if (data.docId !== docId) return;
            setStealState('queued');
            setQueuePosition(data.position + 1); // 0-indexed to 1-indexed for display? Or keep 0-indexed and display +1 in UI.
            // Let's keep raw data here. 0-indexed.
            // Actually, in UI I did `queuePosition : '?'`.
            // Let's make it 1-indexed for user friendly.
            // But wait, the previous `LockComponents` code: `queuePosition !== null ... ? queuePosition : '?'`.
            // It didn't do +1.
            // So I should probably do +1 here or in UI.
            // Let's do it in UI?
            // "queuePosition" usually implies 1st, 2nd.
            // But 0-indexed from server.
            // Queue Position 0 means HEAD (Active Stealer).
            // But `steal-queued` is emitted only if NOT head.
            // So position will be >= 1.
            // So if my position is 1, I am 2nd in line? Or 1 person ahead of me?
            // "Wait Queue Position: 1" -> "1 person ahead".
            // "Current Wait Number: 1".
            // Let's pass raw 1-based or 0-based.
            // Server `getStealQueuePosition` returns index.
            // If Head is index 0. user is index 1.
            // User is "1st in waiting line"?
            // Let's passed raw index.
            setQueuePosition(data.position);
            setStealErrorMessage(null);
        };

        socket.on('doc:lock:status', onStatus);
        socket.on('doc:lock:granted', onGranted);
        socket.on('doc:lock:denied', onDenied);
        socket.on('doc:lock:released', onReleased);
        socket.on('doc:lock:status-changed', onStatusChanged);
        socket.on('doc:lock:steal-countdown', onStealCountdown);
        socket.on('doc:lock:steal-attempt', onStealAttempt);
        socket.on('doc:lock:steal-cleanup', onStealCleanup);
        socket.on('doc:lock:lost', onLockLost);
        socket.on('doc:lock:steal-complete', onStealComplete);
        socket.on('doc:lock:steal-rejected', onStealRejected);
        socket.on('doc:lock:steal-failed', onStealFailed);
        socket.on('doc:lock:steal-cancelled', onStealCancelled);
        socket.on('doc:lock:steal-queued', onStealQueued);

        // Countdown Timer Logic
        const timerInterval = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 0) return prev;
                return prev - 1;
            });
        }, 1000);

        return () => {
            socket.off('doc:lock:status', onStatus);
            socket.off('doc:lock:granted', onGranted);
            socket.off('doc:lock:denied', onDenied);
            socket.off('doc:lock:released', onReleased);
            socket.off('doc:lock:status-changed', onStatusChanged);
            socket.off('doc:lock:steal-countdown', onStealCountdown);
            socket.off('doc:lock:steal-attempt', onStealAttempt);
            socket.off('doc:lock:steal-cleanup', onStealCleanup);
            socket.off('doc:lock:lost', onLockLost);
            socket.off('doc:lock:steal-complete', onStealComplete);
            socket.off('doc:lock:steal-rejected', onStealRejected);
            socket.off('doc:lock:steal-failed', onStealFailed);
            socket.off('doc:lock:steal-cancelled', onStealCancelled);
            socket.off('doc:lock:steal-queued', onStealQueued);
            clearHeartbeat();
            clearInterval(timerInterval);
        };
    }, [socket, docId, displayName, user, startHeartbeat, status, stealState, requestLock, enabled, onLockAcquired]);

    return {
        status,
        lockHolder,
        stealState,
        stealErrorMessage,
        countdown,
        alertMessage,
        requestLock,
        releaseLock,
        requestSteal,
        earlyRelease,
        rejectSteal: useCallback(() => {
            if (!socket) return;
            socket.emit('doc:lock:deny-steal', { docId });
            setAlertMessage(null); // Clear alert on reject
        }, [socket, docId]),
        cancelSteal: useCallback(() => {
            if (!socket) return;
            // Emit cancel event
            socket.emit('doc:lock:cancel-steal', { docId });
            // Reset local state
            setStealState('none');
            setCountdown(null);
            setQueuePosition(null);
            setStealErrorMessage(null);
        }, [socket, docId]),
        setAlertMessage,
        queuePosition
    };
};
