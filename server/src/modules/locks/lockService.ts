
import { createClient } from 'redis';
import type { DatabaseClient } from '../../lib/prismaClient.js';

export type LockMode = 'standard' | 'collab';

export interface LockHolder {
    accountId: string;
    socketId: string;
    displayName: string;
    workspaceId: string; // Used for permission checks if needed
    updatedAt: number; // Heartbeat timestamp
}

export interface LockState {
    mode: LockMode | null;
    holder: LockHolder | null; // For standard mode
    collabCount: number; // For collab mode
    stealRequest?: {
        requesterId: string;
        socketId: string;
        startedAt: number;
    } | null;
}

export class LockService {
    private redis: ReturnType<typeof createClient>;
    private db: DatabaseClient;

    constructor(redisClient: ReturnType<typeof createClient>, db: DatabaseClient) {
        this.redis = redisClient;
        this.db = db;
    }

    private getLockKey(docId: string) {
        return `doc:${docId}:lock`;
    }

    private getQueueKey(docId: string) {
        return `doc:${docId}:requests`;
    }

    /**
     * Get current lock status for a document
     */
    async getLockStatus(docId: string): Promise<LockState> {
        const key = this.getLockKey(docId);
        const queueKey = this.getQueueKey(docId);

        // Parallel fetch for efficiency
        const [data, stealRequestStr] = await Promise.all([
            this.redis.hGetAll(key),
            this.redis.lIndex(queueKey, 0) // Peek head of queue
        ]);

        if (!data || Object.keys(data).length === 0) {
            return { mode: null, holder: null, collabCount: 0 };
        }

        return {
            mode: (data.mode as LockMode) || null,
            holder: data.holder ? JSON.parse(data.holder) : null,
            collabCount: data.collabCount ? parseInt(data.collabCount, 10) : 0,
            stealRequest: stealRequestStr ? JSON.parse(stealRequestStr) : null,
        };
    }

    /**
     * Try to acquire a standard lock
     */
    async acquireStandardLock(
        docId: string,
        holderInfo: Omit<LockHolder, 'updatedAt'>
    ): Promise<{ success: boolean; reason?: 'locked_by_other' | 'locked_collab'; currentLock?: LockState }> {
        const key = this.getLockKey(docId);

        // Watch the key to ensure atomic check-and-set
        await this.redis.watch(key);

        const currentLock = await this.getLockStatus(docId);

        // Case 1: Already locked by collab
        if (currentLock.mode === 'collab' && currentLock.collabCount > 0) {
            await this.redis.unwatch();
            return { success: false, reason: 'locked_collab', currentLock };
        }

        // Case 2: Already locked by another standard user (and it's not me)
        // If it's me (same accountId), we might treat it as re-acquire (refresh) or just success.
        // For strictness, let's assume if socketId is different, it's a conflict (e.g. valid tab vs stale tab).
        // Case 2: Already locked by another standard user (or same user in different session)
        // Strict check: if socketId is different, it is a conflict.
        if (currentLock.mode === 'standard' && currentLock.holder && currentLock.holder.socketId !== holderInfo.socketId) {
            await this.redis.unwatch();
            return { success: false, reason: 'locked_by_other', currentLock };
        }

        const holderWithTimestamp: LockHolder = {
            ...holderInfo,
            updatedAt: Date.now(),
        };

        const multi = this.redis.multi();
        multi.hSet(key, {
            mode: 'standard',
            holder: JSON.stringify(holderWithTimestamp),
        });
        // Set an expiry (TTL) for the lock to prevent deadlocks if server crashes
        // The heartbeat must refresh this TTL.
        multi.expire(key, 60); // 60 seconds TTL

        const results = await multi.exec();

        if (!results) {
            // Transaction failed (key changed)
            return { success: false, reason: 'locked_by_other' }; // Retry logic could be handled by caller
        }

        return { success: true };
    }

    /**
     * Update heartbeat for standard lock
     */
    async updateHeartbeat(docId: string, accountId: string): Promise<boolean> {
        const key = this.getLockKey(docId);
        const currentLock = await this.getLockStatus(docId);

        if (currentLock.mode !== 'standard' || !currentLock.holder || currentLock.holder.accountId !== accountId) {
            return false;
        }

        const updatedHolder = {
            ...currentLock.holder,
            updatedAt: Date.now(),
        };

        await this.redis.hSet(key, 'holder', JSON.stringify(updatedHolder));
        await this.redis.expire(key, 60); // Refresh TTL
        return true;
    }

    /**
     * Register a steal request in Redis (FIFO Queue)
     */
    async registerStealRequest(docId: string, requestInfo: { requesterId: string; socketId: string; displayName: string; workspaceId: string }) {
        const queueKey = this.getQueueKey(docId);
        const requestData = {
            ...requestInfo,
            startedAt: Date.now()
        };
        // RPUSH to add to end of queue
        await this.redis.rPush(queueKey, JSON.stringify(requestData));
        // Ensure queue expires if lock is gone? 
        // We probably want the queue to live as long as the lock mechanism is relevant.
        // We can expire it when lock is released (empty) or just set a TTL.
        await this.redis.expire(queueKey, 300); // 5 minutes TTL for request queue to prevent stale data
    }

    /**
     * Flush and return all pending steal requests in the queue
     */
    async flushStealQueue(docId: string): Promise<any[]> {
        const queueKey = this.getQueueKey(docId);
        const requests = await this.redis.lRange(queueKey, 0, -1);
        await this.redis.del(queueKey);
        return requests.map(r => JSON.parse(r));
    }

    /**
     * Deny all pending steal requests (Holder rejected)
     */
    async denyStealRequest(docId: string, accountId: string): Promise<{ success: boolean; flushedRequests: any[] }> {
        const key = this.getLockKey(docId);
        const currentLock = await this.getLockStatus(docId);

        // Only holder can deny
        if (currentLock.mode !== 'standard' || !currentLock.holder || currentLock.holder.accountId !== accountId) {
            return { success: false, flushedRequests: [] };
        }

        const flushed = await this.flushStealQueue(docId);
        return { success: true, flushedRequests: flushed };
    }

    /**
     * Update the holder information for an existing lock.
     * This is an internal helper, primarily for transfers.
     */
    async updateLock(docId: string, holder: LockHolder) {
        const key = this.getLockKey(docId);
        await this.redis.hSet(key, 'holder', JSON.stringify(holder));
    }

    /**
     * Get the position of a requester in the steal queue (0-indexed).
     * Returns -1 if not found.
     */
    async getStealQueuePosition(docId: string, requesterId: string): Promise<number> {
        const queueKey = this.getQueueKey(docId);
        const requests = await this.redis.lRange(queueKey, 0, -1);

        return requests.findIndex(reqStr => {
            try {
                const req = JSON.parse(reqStr);
                return req.requesterId === requesterId;
            } catch {
                return false;
            }
        });
    }

    /**
     * Remove a specific steal request from the queue
     */
    async removeStealRequest(docId: string, requesterId: string): Promise<boolean> {
        const queueKey = this.getQueueKey(docId);
        const requests = await this.redis.lRange(queueKey, 0, -1);

        const targetRequestString = requests.find(reqStr => {
            try {
                const req = JSON.parse(reqStr);
                return req.requesterId === requesterId;
            } catch {
                return false;
            }
        });

        if (targetRequestString) {
            await this.redis.lRem(queueKey, 0, targetRequestString);
            return true;
        }
        return false;
    }

    /**
     * Consume (Pop) the next steal request from Queue
     */
    async consumeStealRequest(docId: string) {
        const queueKey = this.getQueueKey(docId);
        const reqStr = await this.redis.lPop(queueKey);
        return reqStr ? JSON.parse(reqStr) : null;
    }

    /**
     * Release standard lock (Voluntary)
     * If there is a pending steal request in Queue, transfer to head of queue, AND flush the rest.
     */
    async releaseStandardLock(docId: string, accountId: string): Promise<{ success: boolean; action: 'released' | 'transferred'; newHolderSocketId?: string; flushedRequests?: any[] }> {
        const key = this.getLockKey(docId);
        const currentLock = await this.getLockStatus(docId);

        // Only release if held by this user
        if (currentLock.mode !== 'standard' || !currentLock.holder || currentLock.holder.accountId !== accountId) {
            return { success: false, action: 'released' };
        }

        // Check Queue
        const nextRequest = await this.consumeStealRequest(docId);

        if (nextRequest) {
            const newHolder: LockHolder = {
                accountId: nextRequest.requesterId,
                socketId: nextRequest.socketId,
                displayName: nextRequest.displayName,
                workspaceId: currentLock.holder.workspaceId,
                updatedAt: Date.now()
            };

            const multi = this.redis.multi();
            multi.hSet(key, {
                mode: 'standard',
                holder: JSON.stringify(newHolder),
            });
            multi.expire(key, 60);
            await multi.exec();

            // Flush the rest of the queue because the lock just changed hands
            // The others failed to get it this time.
            const flushed = await this.flushStealQueue(docId);

            return { success: true, action: 'transferred', newHolderSocketId: nextRequest.socketId, flushedRequests: flushed };
        }

        // No steal request, just delete
        await this.redis.del(key);
        // Also clear queue just in case
        await this.redis.del(this.getQueueKey(docId));

        return { success: true, action: 'released' };
    }

    /**
     * Atomically transfer standard lock from current holder to new holder
     * (Called by Timer)
     */
    async transferStandardLock(
        docId: string,
        newHolderInfo: Omit<LockHolder, 'updatedAt'>
    ): Promise<{ success: boolean; flushedRequests?: any[] }> {
        const key = this.getLockKey(docId);
        const currentLock = await this.getLockStatus(docId);

        if (currentLock.mode !== 'standard' || !currentLock.holder) {
            return { success: false };
        }

        const holderWithTimestamp: LockHolder = {
            ...newHolderInfo,
            updatedAt: Date.now(),
        };

        const multi = this.redis.multi();
        multi.hSet(key, {
            mode: 'standard',
            holder: JSON.stringify(holderWithTimestamp),
        });
        multi.expire(key, 60);

        // Note: transferStandardLock is explicit. It mimics forcing the lock to a specific user.
        // It does NOT consume the queue itself (the caller should have consumed it).
        // But for consistency, if this user WAS in the queue, we should probably ensure they are removed.
        // But scanning list to remove is O(N). 
        // Since the timer flow calls this AFTER picking a user properly (ideally popping), 
        // we assume the caller handled the queue.

        try {
            await multi.exec();

            // Flush the rest because transfer is complete
            const flushed = await this.flushStealQueue(docId);

            return { success: true, flushedRequests: flushed };
        } catch (e) {
            console.error('Lock transfer error:', e);
            return { success: false };
        }
    }

    /**
     * Release any lock held by a specific socket (used on disconnect)
     */
    async releaseLockBySocket(socketId: string): Promise<{ docId: string; action: 'released' | 'transferred'; newHolderSocketId?: string; flushedRequests?: any[] }[]> {
        const results: { docId: string; action: 'released' | 'transferred'; newHolderSocketId?: string; flushedRequests?: any[] }[] = [];
        let cursor: any = '0';
        try {
            do {
                const reply = await this.redis.scan(cursor, {
                    MATCH: 'doc:*:lock',
                    COUNT: 100
                });
                cursor = reply.cursor;
                const keys = reply.keys;

                for (const key of keys) {
                    const data = await this.redis.hGetAll(key);
                    if (data.mode === 'standard' && data.holder) {
                        const holder = JSON.parse(data.holder) as LockHolder;
                        if (holder.socketId === socketId) {
                            const docId = key.split(':')[1];
                            const releaseRes = await this.releaseStandardLock(docId, holder.accountId);
                            if (releaseRes.success) {
                                results.push({
                                    docId,
                                    action: releaseRes.action,
                                    newHolderSocketId: releaseRes.newHolderSocketId,
                                    flushedRequests: releaseRes.flushedRequests
                                });
                            }
                        }
                    }
                }

                cursor = reply.cursor;
            } while (cursor !== 0 && cursor !== '0');

        } catch (e) {
            console.error('Error in releaseLockBySocket scan:', e);
        }

        return results;
    }

    /**
     * Increment collab session count.
     * Called when a user connects via Hocuspocus.
     */
    async incrementCollabSession(docId: string): Promise<{ success: boolean; reason?: 'locked_standard' }> {
        const key = this.getLockKey(docId);

        await this.redis.watch(key);
        const currentLock = await this.getLockStatus(docId);

        if (currentLock.mode === 'standard') {
            await this.redis.unwatch();
            return { success: false, reason: 'locked_standard' };
        }

        const multi = this.redis.multi();
        multi.hSet(key, 'mode', 'collab');
        multi.hIncrBy(key, 'collabCount', 1);
        multi.expire(key, 86400); // 24 hours TTL

        await multi.exec();
        return { success: true };
    }

    /**
     * Decrement collab session count.
     * Called when a user disconnects from Hocuspocus.
     */
    async decrementCollabSession(docId: string): Promise<void> {
        const key = this.getLockKey(docId);
        const count = await this.redis.hIncrBy(key, 'collabCount', -1);
        if (count <= 0) {
            await this.redis.del(key);
        }
    }

    /**
     * Force reset collab session.
     * Called when Hocuspocus reports 0 clients.
     */
    async resetCollabLock(docId: string): Promise<void> {
        const key = this.getLockKey(docId);
        await this.redis.del(key);
    }
}
