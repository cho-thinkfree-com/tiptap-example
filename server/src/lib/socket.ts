import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { SocketEvent } from '../types/events.js';
import type { DatabaseClient } from './prismaClient.js';

interface AuthenticatedSocket extends Socket {
    data: {
        accountId?: string;
        sessionId?: string;
    };
}

export class SocketService {
    private io: SocketIOServer;
    private db: DatabaseClient;

    constructor(httpServer: HttpServer, db: DatabaseClient) {
        this.db = db;
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:9910',
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
            const pubClient = createClient({ url: redisUrl });
            const subClient = pubClient.duplicate();

            pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
            subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

            await Promise.all([pubClient.connect(), subClient.connect()]);

            this.io.adapter(createAdapter(pubClient, subClient));
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
            console.log(`Socket connected: ${socket.id}, accountId: ${socket.data.accountId}`);

            // Handle joining workspace room
            socket.on('join-workspace', (workspaceId: string) => {
                const roomName = `workspace:${workspaceId}`;
                socket.join(roomName);
                console.log(`Socket ${socket.id} joined ${roomName}`);
            });

            // Handle leaving workspace room
            socket.on('leave-workspace', (workspaceId: string) => {
                const roomName = `workspace:${workspaceId}`;
                socket.leave(roomName);
                console.log(`Socket ${socket.id} left ${roomName}`);
            });

            socket.on('disconnect', () => {
                console.log(`Socket disconnected: ${socket.id}`);
            });
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
}

