import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { SocketEvent } from '../types/events.js';
import type { DatabaseClient } from './prismaClient.js';
import { LockService } from '../modules/locks/lockService.js';

interface AuthenticatedSocket extends Socket {
    data: {
        accountId?: string;
        sessionId?: string;
    };
}

export class SocketService {
    private io: SocketIOServer;
    private db: DatabaseClient;
    private lockService!: LockService;
    private redisClient!: ReturnType<typeof createClient>;
    private pubClient!: ReturnType<typeof createClient>;
    private subClient!: ReturnType<typeof createClient>;

    // Keep track of steal timers in memory for simplicity in this MVP
    // Map<docId, NodeJS.Timeout>
    private stealTimers: Map<string, NodeJS.Timeout> = new Map();
    // Map<docId, RequesterInfo> - Store requester details for atomic transfer on early-release
    private stealRequests: Map<string, { socketId: string, accountId: string, displayName: string, workspaceId: string }> = new Map();

    constructor(httpServer: HttpServer, db: DatabaseClient) {
        this.db = db;
        const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:9910').split(',').map(url => url.trim());
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: allowedOrigins,
                credentials: true,
            },
        });

        this.setupRedisAdapter();
        this.setupMiddleware();
        this.setupConnectionHandler();
    }

    private async setupRedisAdapter() {
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
        const redisUrl = `redis://${redisHost}:${redisPort}`;

        try {
            this.pubClient = createClient({ url: redisUrl });
            this.subClient = this.pubClient.duplicate();
            // Client for LockService
            this.redisClient = createClient({ url: redisUrl });

            this.pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
            this.subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));
            this.redisClient.on('error', (err) => console.error('Redis Client Error:', err));

            await Promise.all([
                this.pubClient.connect(),
                this.subClient.connect(),
                this.redisClient.connect()
            ]);

            this.io.adapter(createAdapter(this.pubClient, this.subClient));
            this.lockService = new LockService(this.redisClient, this.db);

            console.log(`Socket.IO Redis adapter connected to ${redisUrl}`);
        } catch (error) {
            console.warn('Redis adapter not available, using in-memory adapter. Multi-server sync disabled.', error);
            // Continue without Redis adapter - will work for single server
        }
    }

    private setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket: AuthenticatedSocket, next) => {
            try {
                // Extract session cookie from handshake
                const cookies = socket.handshake.headers.cookie;
                if (!cookies) {
                    return next(new Error('Missing session'));
                }

                // Parse session_id from cookies
                const sessionIdMatch = cookies.match(/session_id=([^;]+)/);
                if (!sessionIdMatch) {
                    return next(new Error('Missing session'));
                }

                const sessionId = sessionIdMatch[1];

                // Validate session in database
                const session = await this.db.session.findUnique({
                    where: { id: sessionId },
                });

                if (!session || session.revokedAt || session.expiresAt < new Date()) {
                    return next(new Error('Invalid or expired session'));
                }

                // Attach user info to socket
                socket.data.accountId = session.accountId;
                socket.data.sessionId = session.id;

                next();
            } catch (error) {
                console.error('Socket authentication error:', error);
                next(new Error('Authentication failed'));
            }
        });
    }

    private setupConnectionHandler() {
        this.io.on('connection', (socket: AuthenticatedSocket) => {
            // console.log(`Socket connected: ${socket.id}, accountId: ${socket.data.accountId}`);

            const accountId = socket.data.accountId;
            if (!accountId) return;

            // Handle joining workspace room
            socket.on('join-workspace', (workspaceId: string) => {
                const roomName = `workspace:${workspaceId}`;
                socket.join(roomName);
            });

            // Handle leaving workspace room
            socket.on('leave-workspace', (workspaceId: string) => {
                const roomName = `workspace:${workspaceId}`;
                socket.leave(roomName);
            });

            // --- Document Lock Events ---

            // Join Document Room (Passive View / status check)
            socket.on('doc:join', async (data: { docId: string }) => {
                const roomName = `doc:${data.docId}`;
                socket.join(roomName);

                if (this.lockService) {
                    const status = await this.lockService.getLockStatus(data.docId);
                    socket.emit('doc:lock:status', { docId: data.docId, status });
                }
            });

            // Request Lock
            socket.on('doc:lock:request', async (data: { docId: string, displayName: string, workspaceId: string }) => {
                if (!this.lockService) {
                    socket.emit('doc:lock:error', { message: 'Lock service unavailable' });
                    return;
                }

                try {
                    const result = await this.lockService.acquireStandardLock(data.docId, {
                        accountId,
                        socketId: socket.id,
                        displayName: data.displayName,
                        workspaceId: data.workspaceId
                    });

                    if (result.success) {
                        socket.join(`doc:${data.docId}`);
                        socket.emit('doc:lock:granted', { docId: data.docId });
                        // Broadcast status change to others in doc room
                        this.io.to(`doc:${data.docId}`).emit('doc:lock:status-changed', { docId: data.docId });
                    } else {
                        socket.emit('doc:lock:denied', {
                            docId: data.docId,
                            reason: result.reason,
                            currentLock: result.currentLock
                        });
                        // Also join the room to receive future updates (viewers need updates)
                        socket.join(`doc:${data.docId}`);
                    }
                } catch (e) {
                    console.error('Lock acquire error:', e);
                    socket.emit('doc:lock:error', { message: 'Internal error' });
                }
            });

            // Release Lock (Voluntary - Close or Stop Editing)
            socket.on('doc:lock:release', async (data: { docId: string }) => {
                if (!this.lockService) return;

                try {
                    const result = await this.lockService.releaseStandardLock(data.docId, accountId);

                    if (result.success) {
                        if (result.action === 'transferred' && result.newHolderSocketId) {
                            socket.emit('doc:lock:released', { docId: data.docId }); // Confirm release to sender
                            this.io.to(result.newHolderSocketId).emit('doc:lock:granted', { docId: data.docId });
                            this.io.to(`doc:${data.docId}`).emit('doc:lock:status-changed', { docId: data.docId });
                            console.log(`[Socket] Lock voluntarily transferred to ${result.newHolderSocketId}`);
                        } else {
                            socket.emit('doc:lock:released', { docId: data.docId });
                            // Notify everyone else
                            this.io.to(`doc:${data.docId}`).emit('doc:lock:status-changed', { docId: data.docId });
                        }

                        // Clear any steal timer if exists
                        if (this.stealTimers.has(data.docId)) {
                            clearTimeout(this.stealTimers.get(data.docId)!);
                            this.stealTimers.delete(data.docId);
                        }
                        if (this.stealRequests.has(data.docId)) {
                            this.stealRequests.delete(data.docId);
                        }
                    }
                } catch (e) {
                    console.error('Lock release error:', e);
                }
            });

            // Heartbeat
            socket.on('doc:lock:heartbeat', async (data: { docId: string }) => {
                if (!this.lockService) return;
                await this.lockService.updateHeartbeat(data.docId, accountId);
            });

            // Steal Request
            socket.on('doc:lock:request-steal', async (data: { docId: string }) => {
                if (!this.lockService) return;
                console.log(`[Socket] Steal request received for doc ${data.docId} from ${socket.id}`);

                try {
                    const lockStatus = await this.lockService.getLockStatus(data.docId);

                    if (lockStatus.mode !== 'standard' || !lockStatus.holder) {
                        socket.emit('doc:lock:error', { message: 'Not stealable' });
                        return;
                    }

                    const holderSocketId = lockStatus.holder.socketId;

                    const requesterDisplayName = 'Requester';

                    // Always register in FIFO queue
                    await this.lockService.registerStealRequest(data.docId, {
                        requesterId: accountId!,
                        socketId: socket.id,
                        displayName: requesterDisplayName,
                        workspaceId: lockStatus.holder.workspaceId
                    });
                    console.log('[Socket] Steal request registered in FIFO queue.');

                    // If a steal process is already active (timer running), 
                    // this request is just added to the queue. We don't need to restart timer or alert holder again.
                    if (this.stealTimers.has(data.docId)) {
                        console.log('[Socket] Steal timer already active. Request queued.');
                        const position = await this.lockService.getStealQueuePosition(data.docId, accountId);
                        socket.emit('doc:lock:steal-queued', { docId: data.docId, position });
                        return;
                    }

                    // Start new Steal Process

                    // 1. Notify Requester (Start Progress) - Actually loop all requesters? 
                    // Current simplified: Notify THIS requester.
                    socket.emit('doc:lock:steal-countdown', { docId: data.docId, seconds: 30 });

                    // 2. Notify Holder (Alert)
                    this.io.to(holderSocketId).emit('doc:lock:steal-attempt', {
                        docId: data.docId,
                        seconds: 30
                    });

                    // 3. Set Timer
                    const timer = setTimeout(() => {
                        // Phase 2: Cleanup (10s)
                        this.io.to(holderSocketId).emit('doc:lock:steal-cleanup', {
                            docId: data.docId,
                            seconds: 10
                        });
                        socket.emit('doc:lock:steal-cleanup', {
                            docId: data.docId,
                            seconds: 10
                        });

                        // Wait 10s then force switch
                        const cleanupTimer = setTimeout(async () => {
                            try {
                                // Consume head of queue (First-In)
                                const requester = await this.lockService.consumeStealRequest(data.docId);

                                if (requester) {
                                    const newDisplayName = requester.displayName || 'Unknown User';

                                    const result = await this.lockService.transferStandardLock(data.docId, {
                                        accountId: requester.accountId,
                                        socketId: requester.socketId,
                                        displayName: newDisplayName,
                                        workspaceId: requester.workspaceId,
                                    });

                                    if (result.success) {
                                        // Notify Old Holder -> Lost
                                        this.io.to(holderSocketId).emit('doc:lock:lost', { docId: data.docId });

                                        // Notify New Holder -> Granted
                                        this.io.to(requester.socketId).emit('doc:lock:granted', { docId: data.docId });

                                        // Notify Losers
                                        if (result.flushedRequests) {
                                            result.flushedRequests.forEach(req => {
                                                this.io.to(req.socketId).emit('doc:lock:steal-failed', { message: 'Other user acquired lock first.' });
                                            });
                                        }

                                        // Broadcast
                                        this.io.to(`doc:${data.docId}`).emit('doc:lock:status-changed', { docId: data.docId });
                                    } else {
                                        socket.emit('doc:lock:error', { message: 'Failed to transfer lock' });
                                    }
                                }

                                this.stealTimers.delete(data.docId);
                                // Queue cleanup handled by consumeStealRequest logic or expiration
                            } catch (e) {
                                console.error('Steal finalize error:', e);
                            }
                        }, 10000); // 10s cleanup

                        this.stealTimers.set(data.docId, cleanupTimer);

                    }, 30000); // 30s wait

                    this.stealTimers.set(data.docId, timer);

                } catch (err) {
                    console.error('[Socket] Error in steal request handler:', err);
                    socket.emit('doc:lock:error', { message: 'Internal error during steal request' });
                }
            });

            // Holder Deny Steal
            socket.on('doc:lock:deny-steal', async (data: { docId: string }) => {
                if (this.stealTimers.has(data.docId)) {
                    clearTimeout(this.stealTimers.get(data.docId)!);
                    this.stealTimers.delete(data.docId);

                    const result = await this.lockService.denyStealRequest(data.docId, accountId);

                    if (result.success && result.flushedRequests) {
                        this._notifyFailedRequesters(result.flushedRequests, data.docId, 'Lock holder rejected your steal request.');
                    }
                }
            });

            // Requester Cancel Steal
            socket.on('doc:lock:cancel-steal', async (data: { docId: string }) => {
                const currentStatus = await this.lockService.getLockStatus(data.docId);
                const activeSteal = currentStatus.stealRequest;

                // Remove the request from queue regardless of position
                const removed = await this.lockService.removeStealRequest(data.docId, accountId);

                if (removed) {
                    // Check if the cancelled request was the active one (Head of Queue)
                    if (activeSteal && activeSteal.requesterId === accountId) {
                        // Yes, this was the active steal process. Stop it.
                        if (this.stealTimers.has(data.docId)) {
                            clearTimeout(this.stealTimers.get(data.docId)!);
                            this.stealTimers.delete(data.docId);
                        }

                        // Notify Holder & Room that steal is cancelled (for the previous head)
                        this.io.to(`doc:${data.docId}`).emit('doc:lock:steal-cancelled', { docId: data.docId });

                        // Promote Next User in Queue
                        const newStatus = await this.lockService.getLockStatus(data.docId);
                        const newHead = newStatus.stealRequest; // This is the new head after removal

                        if (newHead && newStatus.holder) {
                            console.log(`[Socket] Promoting next steal requester for doc ${data.docId} after cancellation.`);
                            // Start the logic for the new head
                            const duration = 30000;

                            // 1. Notify New Head
                            this.io.to(newHead.socketId).emit('doc:lock:steal-countdown', { docId: data.docId, seconds: 30 });

                            // 2. Notify Holder
                            this.io.to(newStatus.holder.socketId).emit('doc:lock:steal-attempt', { docId: data.docId, seconds: 30 });

                            // 3. Start Timer
                            const timer = setTimeout(() => {
                                // Phase 2: Cleanup (10s)
                                this.io.to(newStatus.holder!.socketId).emit('doc:lock:steal-cleanup', {
                                    docId: data.docId,
                                    seconds: 10
                                });
                                this.io.to(newHead.socketId).emit('doc:lock:steal-cleanup', {
                                    docId: data.docId,
                                    seconds: 10
                                });

                                // Wait 10s then force switch
                                const cleanupTimer = setTimeout(async () => {
                                    try {
                                        // Consume head of queue (First-In)
                                        const requester = await this.lockService.consumeStealRequest(data.docId);

                                        if (requester) {
                                            const newDisplayName = requester.displayName || 'Unknown User';

                                            const result = await this.lockService.transferStandardLock(data.docId, {
                                                accountId: requester.accountId,
                                                socketId: requester.socketId,
                                                displayName: newDisplayName,
                                                workspaceId: requester.workspaceId,
                                            });

                                            if (result.success) {
                                                // Notify Old Holder -> Lost
                                                this.io.to(newStatus.holder!.socketId).emit('doc:lock:lost', { docId: data.docId });

                                                // Notify New Holder -> Granted
                                                this.io.to(requester.socketId).emit('doc:lock:granted', { docId: data.docId });

                                                // Notify Losers
                                                if (result.flushedRequests) {
                                                    this._notifyFailedRequesters(result.flushedRequests, data.docId, 'Other user acquired lock first.');
                                                }

                                                // Broadcast
                                                this.io.to(`doc:${data.docId}`).emit('doc:lock:status-changed', { docId: data.docId });
                                            } else {
                                                this.io.to(newHead.socketId).emit('doc:lock:error', { message: 'Failed to transfer lock' });
                                            }
                                        }

                                        this.stealTimers.delete(data.docId);
                                    } catch (e) {
                                        console.error('Steal finalize error after cancellation:', e);
                                    }
                                }, 10000); // 10s cleanup

                                this.stealTimers.set(data.docId, cleanupTimer);

                            }, 30000); // 30s wait

                            this.stealTimers.set(data.docId, timer);
                        }
                    } else {
                        // If the cancelled request was not the active one,
                        // we might want to notify the requester that they are no longer in queue.
                        socket.emit('doc:lock:steal-failed', { message: 'Your steal request has been cancelled.' });
                    }
                }
            });

            // Early Release (Holder gives up lock early - Approved)
            socket.on('doc:lock:early-release', async (data: { docId: string }) => {
                if (this.stealTimers.has(data.docId)) {
                    clearTimeout(this.stealTimers.get(data.docId)!);
                    this.stealTimers.delete(data.docId);

                    // Use updated releaseStandardLock which handles transfer automatically from FIFO Queue
                    const result = await this.lockService.releaseStandardLock(data.docId, accountId);

                    if (result.success) {
                        if (result.action === 'transferred' && result.newHolderSocketId) {
                            // 1. Notify Old Holder (Self) -> Lost (Forces reload/viewer)
                            socket.emit('doc:lock:lost', { docId: data.docId });
                            // 2. Notify New Holder -> Granted
                            this.io.to(result.newHolderSocketId).emit('doc:lock:granted', { docId: data.docId });

                            // 3. Notify Flushed (Losers)
                            if (result.flushedRequests) {
                                this._notifyFailedRequesters(result.flushedRequests, data.docId, 'Other user acquired lock first.');
                            }

                            // 4. Broadcast
                            this.io.to(`doc:${data.docId}`).emit('doc:lock:status-changed', { docId: data.docId });
                        } else if (result.action === 'released') {
                            socket.emit('doc:lock:lost', { docId: data.docId });
                            socket.emit('doc:lock:released', { docId: data.docId });
                            this.io.to(`doc:${data.docId}`).emit('doc:lock:status-changed', { docId: data.docId });
                        }
                    }
                }
            });

            socket.on('disconnect', async () => {
                // If user was a lock holder, release it
                if (this.lockService && accountId) {
                    const results = await this.lockService.releaseLockBySocket(socket.id);
                    // Broadcast updates for released docs
                    for (const { docId, action, newHolderSocketId, flushedRequests } of results) {
                        if (action === 'transferred' && newHolderSocketId) {
                            this.io.to(newHolderSocketId).emit('doc:lock:granted', { docId });
                            console.log(`[Socket] Disconnect transfer -> Granted to ${newHolderSocketId}`);
                        }

                        if (flushedRequests) {
                            this._notifyFailedRequesters(flushedRequests, docId, 'Other user acquired lock first (via disconnect).');
                        }

                        this.io.to(`doc:${docId}`).emit('doc:lock:status-changed', { docId });

                        // Cleanup steal timers/requests
                        if (this.stealTimers.has(docId)) {
                            clearTimeout(this.stealTimers.get(docId)!);
                            this.stealTimers.delete(docId);
                        }
                        if (this.stealRequests.has(docId)) {
                            this.stealRequests.delete(docId);
                        }
                    }
                }
            });
        });
    }

    /**
     * Helper to notify failed steal requesters
     */
    private _notifyFailedRequesters(requests: any[], docId: string, message: string) {
        requests.forEach(req => {
            this.io.to(req.socketId).emit('doc:lock:steal-failed', { message });
        });
    }

    /**
     * Emit an event to all clients in a workspace room
     */
    public emitToWorkspace(workspaceId: string, event: SocketEvent): void {
        const roomName = `workspace:${workspaceId}`;
        this.io.to(roomName).emit(event.type, event);
        console.log(`Emitted ${event.type} to ${roomName}`);
    }

    /**
     * Get the Socket.IO server instance
     */
    public getIO(): SocketIOServer {
        return this.io;
    }

    /**
     * Get the LockService instance (for use in Hocuspocus or other modules)
     */
    public getLockService(): LockService {
        return this.lockService;
    }
}
