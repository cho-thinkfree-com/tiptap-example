import { FileSystemEntry, FileSystemType } from '@prisma/client';
import { FileSystemRepository } from './fileSystemRepository.js';
import { RevisionRepository } from './revisionRepository.js';
import { ShareLinkRepository } from './shareLinkRepository.js';
import { StorageService } from '../storage/storageService.js';
import { WorkspaceAccessService } from '../workspaces/workspaceAccess.js';
import type { SocketService } from '../../lib/socket.js';

const ODOCS_MIME_TYPE = 'application/x-odocs';

export class FileSystemService {
    constructor(
        private fileSystemRepo: FileSystemRepository,
        private revisionRepo: RevisionRepository,
        private shareLinkRepo: ShareLinkRepository,
        private storageService: StorageService,
        private workspaceAccess: WorkspaceAccessService,
        private socketService?: SocketService
    ) { }

    /**
     * Set the socket service after initialization (for dependency injection)
     */
    public setSocketService(socketService: SocketService): void {
        this.socketService = socketService;
    }

    // ============================================================================
    // CREATE OPERATIONS
    // ============================================================================

    private async getNextFileIndex(workspaceId: string): Promise<number> {
        return this.fileSystemRepo.getNextFileIndexAtomic(workspaceId);
    }

    async createFolder(
        membershipId: string,
        workspaceId: string,
        name: string,
        parentId?: string
    ): Promise<FileSystemEntry> {
        // Membership already validated by resolveMembership middleware

        const fileIndex = await this.getNextFileIndex(workspaceId);

        const folder = await this.fileSystemRepo.create({
            name,
            type: 'folder',
            workspaceId,
            parentId,
            createdBy: membershipId,
            fileIndex,
        });

        // Emit socket event
        if (this.socketService) {
            this.socketService.emitToWorkspace(workspaceId, {
                type: 'file:created',
                workspaceId,
                file: folder,
            });
        }

        return folder;
    }

    async createDocument(
        membershipId: string,
        workspaceId: string,
        title: string,
        content: any,
        parentId?: string
    ): Promise<FileSystemEntry> {
        // Membership already validated by resolveMembership middleware

        const fileIndex = await this.getNextFileIndex(workspaceId);

        // Create file entry
        const file = await this.fileSystemRepo.create({
            name: title,
            type: 'file',
            mimeType: ODOCS_MIME_TYPE,
            extension: '.odocs',
            workspaceId,
            parentId,
            createdBy: membershipId,
            fileIndex,
        });

        // Save content as revision
        const contentJson = JSON.stringify(content);
        const contentBuffer = Buffer.from(contentJson, 'utf-8');
        const size = BigInt(contentBuffer.length);

        // Upload to S3
        const storageKey = `workspaces/${workspaceId}/files/${file.id}/v1`;
        const latestKey = `workspaces/${workspaceId}/files/${file.id}/latest`;

        await this.storageService.uploadObject(storageKey, contentBuffer, ODOCS_MIME_TYPE);
        await this.storageService.uploadObject(latestKey, contentBuffer, ODOCS_MIME_TYPE);

        // Create revision
        const revision = await this.revisionRepo.create({
            fileId: file.id,
            storageKey,
            size,
            version: 1,
            createdBy: membershipId,
            changeNote: 'Initial version',
        });

        // Update file to point to this revision
        await this.fileSystemRepo.update(file.id, {
            currentRevisionId: revision.id,
            size,
        });

        const createdFile = await this.fileSystemRepo.findById(file.id) as FileSystemEntry;

        // Emit socket event
        if (this.socketService) {
            this.socketService.emitToWorkspace(workspaceId, {
                type: 'file:created',
                workspaceId,
                file: createdFile,
            });
        }

        return createdFile;
    }

    async createFile(
        membershipId: string,
        workspaceId: string,
        name: string,
        mimeType: string,
        extension: string,
        buffer: Buffer,
        parentId?: string
    ): Promise<FileSystemEntry> {
        // Membership already validated by resolveMembership middleware

        const size = BigInt(buffer.length);
        const fileIndex = await this.getNextFileIndex(workspaceId);

        // Create file entry
        const file = await this.fileSystemRepo.create({
            name,
            type: 'file',
            mimeType,
            extension,
            size,
            workspaceId,
            parentId,
            createdBy: membershipId,
            fileIndex,
        });

        // Upload to S3
        const storageKey = `workspaces/${workspaceId}/files/${file.id}/v1`;
        const latestKey = `workspaces/${workspaceId}/files/${file.id}/latest`;

        await this.storageService.uploadObject(storageKey, buffer, mimeType);
        await this.storageService.uploadObject(latestKey, buffer, mimeType);

        // Create revision
        const revision = await this.revisionRepo.create({
            fileId: file.id,
            storageKey,
            size,
            version: 1,
            createdBy: membershipId,
        });

        // Update file
        await this.fileSystemRepo.update(file.id, {
            currentRevisionId: revision.id,
        });

        return this.fileSystemRepo.findById(file.id) as Promise<FileSystemEntry>;
    }

    // ============================================================================
    // READ OPERATIONS
    // ============================================================================

    async getById(membershipId: string, fileId: string): Promise<FileSystemEntry> {
        const file = await this.fileSystemRepo.findById(fileId);
        if (!file) {
            throw new Error('File not found');
        }

        // Membership validated by resolveMembership middleware
        // Files can only be accessed within their workspace context

        return file;
    }

    async listByWorkspace(
        membershipId: string,
        workspaceId: string,
        parentId?: string | null
    ): Promise<FileSystemEntry[]> {
        // Membership validated by resolveMembership middleware

        return this.fileSystemRepo.findByWorkspace(workspaceId, { parentId });
    }

    async getDocumentContent(membershipId: string, fileId: string): Promise<any> {
        const file = await this.getById(membershipId, fileId);

        if (file.mimeType !== ODOCS_MIME_TYPE) {
            throw new Error('Not an OdoDocs document');
        }

        if (!file.currentRevisionId) {
            return { type: 'doc', content: [] }; // Empty document
        }

        // Get latest content from S3
        const latestKey = `workspaces/${file.workspaceId}/files/${file.id}/latest`;
        const buffer = await this.storageService.getObject(latestKey);
        const contentJson = buffer.toString('utf-8');

        return JSON.parse(contentJson);
    }

    async getFileDownloadUrl(membershipId: string, fileId: string): Promise<string> {
        const file = await this.getById(membershipId, fileId);

        if (!file.currentRevisionId) {
            throw new Error('File has no content');
        }

        // Ensure odocs files have .odocs extension in download filename
        let filename = file.name;
        if (file.mimeType === ODOCS_MIME_TYPE && !filename.endsWith('.odocs')) {
            filename += '.odocs';
        }

        const latestKey = `workspaces/${file.workspaceId}/files/${file.id}/latest`;
        return this.storageService.getPresignedGetUrl(latestKey, filename);
    }

    // ============================================================================
    // UPDATE OPERATIONS
    // ============================================================================

    async updateDocument(
        membershipId: string,
        fileId: string,
        content: any
    ): Promise<FileSystemEntry> {
        const file = await this.getById(membershipId, fileId);

        if (file.mimeType !== ODOCS_MIME_TYPE) {
            throw new Error('Not an OdoDocs document');
        }

        // Get next version
        const nextVersion = await this.revisionRepo.getNextVersion(fileId);

        // Save content
        const contentJson = JSON.stringify(content);
        const contentBuffer = Buffer.from(contentJson, 'utf-8');
        const size = BigInt(contentBuffer.length);

        // Upload to S3
        const storageKey = `workspaces/${file.workspaceId}/files/${file.id}/v${nextVersion}`;
        const latestKey = `workspaces/${file.workspaceId}/files/${file.id}/latest`;

        await this.storageService.uploadObject(storageKey, contentBuffer, ODOCS_MIME_TYPE);
        await this.storageService.uploadObject(latestKey, contentBuffer, ODOCS_MIME_TYPE);

        // Create revision
        const revision = await this.revisionRepo.create({
            fileId: file.id,
            storageKey,
            size,
            version: nextVersion,
            createdBy: membershipId,
        });

        // Update file
        await this.fileSystemRepo.update(file.id, {
            currentRevisionId: revision.id,
            size,
            lastModifiedBy: membershipId,
        });

        const updatedFile = await this.fileSystemRepo.findById(file.id) as FileSystemEntry;

        // Emit socket event for metadata changes (size, updatedAt, lastModifiedBy)
        if (this.socketService) {
            this.socketService.emitToWorkspace(file.workspaceId, {
                type: 'file:updated',
                workspaceId: file.workspaceId,
                fileId: file.id,
                updates: {
                    size,
                    updatedAt: updatedFile.updatedAt,
                    lastModifiedBy: membershipId,
                },
            });
        }

        return updatedFile;
    }

    async updateMetadata(
        membershipId: string,
        fileId: string,
        updates: {
            name?: string;
            displayName?: string;
            description?: string;
            isShared?: boolean;
            isStarred?: boolean;
        }
    ): Promise<FileSystemEntry> {
        const file = await this.getById(membershipId, fileId); // Verify access

        const updated = await this.fileSystemRepo.update(fileId, {
            ...updates,
            lastModifiedBy: membershipId,
        });

        // Emit socket event
        if (this.socketService) {
            this.socketService.emitToWorkspace(file.workspaceId, {
                type: 'file:updated',
                workspaceId: file.workspaceId,
                fileId,
                updates: {
                    ...updates,
                    lastModifiedBy: membershipId,
                },
            });
        }

        return updated;
    }

    async rename(
        membershipId: string,
        fileId: string,
        newName: string
    ): Promise<FileSystemEntry> {
        const file = await this.getById(membershipId, fileId); // Verify access

        const updated = await this.fileSystemRepo.update(fileId, {
            name: newName,
            lastModifiedBy: membershipId,
        });

        // Emit socket event
        if (this.socketService) {
            this.socketService.emitToWorkspace(file.workspaceId, {
                type: 'file:updated',
                workspaceId: file.workspaceId,
                fileId,
                updates: { name: newName },
            });
        }

        return updated;
    }

    async move(
        membershipId: string,
        fileId: string,
        newParentId: string | null
    ): Promise<FileSystemEntry> {
        const file = await this.getById(membershipId, fileId); // Verify access
        const oldParentId = file.parentId;

        const updated = await this.fileSystemRepo.update(fileId, {
            parentId: newParentId,
            lastModifiedBy: membershipId,
        });

        // Emit socket event with move information
        if (this.socketService) {
            this.socketService.emitToWorkspace(file.workspaceId, {
                type: 'file:updated',
                workspaceId: file.workspaceId,
                fileId,
                updates: { parentId: newParentId },
                oldParentId,
                newParentId,
            });
        }

        return updated;
    }

    async toggleStar(membershipId: string, fileId: string): Promise<FileSystemEntry> {
        const file = await this.getById(membershipId, fileId);
        const newIsStarred = !file.isStarred;

        const updated = await this.fileSystemRepo.update(fileId, {
            isStarred: newIsStarred,
            lastModifiedBy: membershipId,
        });

        // Emit socket event
        if (this.socketService) {
            this.socketService.emitToWorkspace(file.workspaceId, {
                type: 'file:updated',
                workspaceId: file.workspaceId,
                fileId,
                updates: { isStarred: newIsStarred },
            });
        }

        return updated;
    }

    // ============================================================================
    // DELETE OPERATIONS
    // ============================================================================

    async softDelete(membershipId: string, fileId: string): Promise<void> {
        const file = await this.getById(membershipId, fileId); // Verify access
        await this.fileSystemRepo.softDelete(fileId, membershipId);

        // Emit socket event
        if (this.socketService) {
            this.socketService.emitToWorkspace(file.workspaceId, {
                type: 'file:deleted',
                workspaceId: file.workspaceId,
                fileId,
                deletedAt: new Date(),
            });
        }
    }

    async restore(membershipId: string, fileId: string): Promise<FileSystemEntry> {
        const file = await this.fileSystemRepo.findById(fileId);
        if (!file) {
            throw new Error('File not found');
        }

        // Membership validated by resolveMembership middleware

        const restored = await this.fileSystemRepo.restore(fileId);

        // Emit socket event
        if (this.socketService) {
            this.socketService.emitToWorkspace(file.workspaceId, {
                type: 'file:restored',
                workspaceId: file.workspaceId,
                file: restored,
            });
        }

        return restored;
    }

    async hardDelete(membershipId: string, fileId: string): Promise<void> {
        const file = await this.fileSystemRepo.findById(fileId);
        if (!file) {
            throw new Error('File not found');
        }

        // Membership validated by resolveMembership middleware

        // Delete from S3
        if (file.type === 'file' && file.currentRevisionId) {
            // Delete all versions from S3
            try {
                // For documents and general files, we store them at standardized paths
                const storageKeyV1 = `workspaces/${file.workspaceId}/files/${file.id}/v1`;
                const latestKey = `workspaces/${file.workspaceId}/files/${file.id}/latest`;

                await Promise.all([
                    this.storageService.deleteObject(storageKeyV1).catch(() => { }), // Ignore if doesn't exist
                    this.storageService.deleteObject(latestKey).catch(() => { }),
                ]);

                // TODO: For files with multiple versions, we should list all objects with prefix
                // and delete them all. For now, we only delete v1 and latest.
            } catch (error) {
                console.error('Failed to delete S3 objects:', error);
                // Continue with DB deletion even if S3 deletion fails
            }
        }

        // Delete from DB
        await this.fileSystemRepo.hardDelete(fileId);
    }

    // ============================================================================
    // SHARING
    // ============================================================================

    async createShareLink(
        membershipId: string,
        fileId: string,
        options: {
            password?: string;
            expiresAt?: Date;
            accessType?: 'private' | 'link' | 'public';
        }
    ): Promise<any> {
        const file = await this.getById(membershipId, fileId);

        // Check for existing link (active or revoked) to support permalinks
        const existingLinks = await this.shareLinkRepo.findByFileId(fileId);
        console.log(`[createShareLink] fileId=${fileId} existingLinks=${existingLinks.length}`);
        const existingLink = existingLinks[0]; // Reuse latest

        if (existingLink) {
            const updates: any = {
                revokedAt: null, // Reactivate
                accessType: options.accessType || 'link',
                expiresAt: options.expiresAt,
            };

            if (options.password) {
                const bcrypt = await import('bcryptjs');
                updates.passwordHash = await bcrypt.hash(options.password, 10);
            } else {
                // If password is not provided during creation/reactivation, clear any old password
                updates.passwordHash = null;
            }

            const updated = await this.shareLinkRepo.update(existingLink.id, updates);

            // Emit socket event - refetch file to get updated shareLinks
            if (this.socketService) {
                const updatedFile = await this.fileSystemRepo.findById(fileId);
                if (updatedFile) {
                    this.socketService.emitToWorkspace(file.workspaceId, {
                        type: 'file:updated',
                        workspaceId: file.workspaceId,
                        fileId,
                        updates: { shareLinks: updatedFile.shareLinks } as any,
                    });
                }
            }

            return updated;
        }

        let passwordHash: string | undefined;
        if (options.password) {
            const bcrypt = await import('bcryptjs');
            passwordHash = await bcrypt.hash(options.password, 10);
        }

        const created = await this.shareLinkRepo.create({
            fileId: file.id,
            workspaceId: file.workspaceId,
            createdBy: membershipId,
            accessType: options.accessType || 'link',
            passwordHash,
            expiresAt: options.expiresAt,
        });

        // Emit socket event - refetch file to get updated shareLinks
        if (this.socketService) {
            const updatedFile = await this.fileSystemRepo.findById(fileId);
            if (updatedFile) {
                this.socketService.emitToWorkspace(file.workspaceId, {
                    type: 'file:updated',
                    workspaceId: file.workspaceId,
                    fileId,
                    updates: { shareLinks: updatedFile.shareLinks } as any,
                });
            }
        }

        return created;
    }

    async getByShareToken(token: string, password?: string): Promise<any> {
        const shareLink = await this.shareLinkRepo.findByToken(token);

        if (!shareLink) {
            throw new Error('Share link not found');
        }

        if (shareLink.revokedAt) {
            throw new Error('Share link has been revoked');
        }

        if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
            throw new Error('Share link has expired');
        }

        // Check password
        if (shareLink.passwordHash) {
            if (!password) {
                const error: any = new Error('Share link password required or incorrect');
                error.statusCode = 401;
                error.code = 'PASSWORD_REQUIRED';
                throw error;
            }

            const bcrypt = await import('bcryptjs');
            const valid = await bcrypt.compare(password, shareLink.passwordHash);
            if (!valid) {
                const error: any = new Error('Share link password required or incorrect');
                error.statusCode = 401;
                throw error;
            }
        }

        // Increment view count
        await this.fileSystemRepo.incrementViewCount(shareLink.fileId);

        let content = null;
        if (shareLink.file.mimeType === ODOCS_MIME_TYPE && shareLink.file.currentRevision) {
            try {
                // Use storageKey from revision if available
                // If not, try latest key
                let key = shareLink.file.currentRevision.storageKey;
                if (!key) {
                    key = `workspaces/${shareLink.file.workspaceId}/files/${shareLink.file.id}/latest`;
                }

                const buffer = await this.storageService.getObject(key);
                const contentJson = buffer.toString('utf-8');
                content = JSON.parse(contentJson);
            } catch (err) {
                console.error('Failed to load shared document content:', err);
                // Return without content (viewer might show error or empty)
            }
        }

        // Get updated file with incremented view count
        const updatedFile = await this.fileSystemRepo.findById(shareLink.fileId);

        return {
            file: {
                ...updatedFile,
                currentRevision: shareLink.file.currentRevision ? {
                    ...shareLink.file.currentRevision,
                    content
                } : null
            },
            shareLink: {
                accessType: shareLink.accessType,
                requiresPassword: !!shareLink.passwordHash,
                expiresAt: shareLink.expiresAt,
                accessLevel: shareLink.accessLevel,
            },
        };
    }

    async getSharedFileDownloadUrl(token: string, password?: string): Promise<string> {
        const { file } = await this.getByShareToken(token, password);

        // Ensure odocs files have .odocs extension in download filename
        let filename = file.name;
        if (file.mimeType === ODOCS_MIME_TYPE && !filename.endsWith('.odocs')) {
            filename += '.odocs';
        }

        const latestKey = `workspaces/${file.workspaceId}/files/${file.id}/latest`;
        return this.storageService.getPresignedGetUrl(latestKey, filename);
    }

    // ============================================================================
    // UTILITY
    // ============================================================================

    async getAncestors(membershipId: string, fileId: string): Promise<FileSystemEntry[]> {
        await this.getById(membershipId, fileId); // Verify access
        return this.fileSystemRepo.getAncestors(fileId);
    }

    async getStarred(membershipId: string, workspaceId: string): Promise<FileSystemEntry[]> {
        // Membership validated by resolveMembership middleware
        return this.fileSystemRepo.getStarred(workspaceId);
    }

    async getRecentlyModified(
        membershipId: string,
        workspaceId: string,
        limit?: number
    ): Promise<FileSystemEntry[]> {
        // Membership validated by resolveMembership middleware
        return this.fileSystemRepo.getRecentlyModified(workspaceId, limit);
    }

    async search(
        membershipId: string,
        workspaceId: string,
        query: string
    ): Promise<FileSystemEntry[]> {
        // Membership validated by resolveMembership middleware
        return this.fileSystemRepo.search(workspaceId, query);
    }

    // ============================================================================
    // ADDITIONAL METHODS FOR COMPATIBILITY
    // ============================================================================

    async getFileSystemEntry(membershipId: string, fileId: string): Promise<FileSystemEntry> {
        // This is a compatibility wrapper
        return this.getById(membershipId, fileId);
    }

    async getShareLinks(fileId: string): Promise<any[]> {
        return this.shareLinkRepo.findByFileId(fileId);
    }

    async revokeShareLink(membershipId: string, linkId: string): Promise<void> {
        // Revoke the link - the revoke method returns the updated ShareLink
        const revokedLink = await this.shareLinkRepo.revoke(linkId);

        const fileId = revokedLink.fileId;
        const file = await this.fileSystemRepo.findById(fileId);

        // Emit socket event - refetch file to get updated shareLinks
        if (this.socketService && file) {
            const updatedFile = await this.fileSystemRepo.findById(fileId);
            if (updatedFile) {
                this.socketService.emitToWorkspace(file.workspaceId, {
                    type: 'file:updated',
                    workspaceId: file.workspaceId,
                    fileId,
                    updates: { shareLinks: updatedFile.shareLinks } as any,
                });
            }
        }
    }

    async updateShareLink(membershipId: string, linkId: string, body: any): Promise<any> {
        const updates: any = { ...body };

        if (body.password) {
            const bcrypt = await import('bcryptjs');
            updates.passwordHash = await bcrypt.hash(body.password, 10);
            delete updates.password;
        } else if (body.password === null) {
            updates.passwordHash = null;
            delete updates.password;
        }

        // If making public, clear password protection
        if (body.accessType === 'public') {
            updates.passwordHash = null;
        }

        // Update returns the updated ShareLink with fileId
        const updated = await this.shareLinkRepo.update(linkId, updates);

        const fileId = updated.fileId;
        const file = await this.fileSystemRepo.findById(fileId);

        // Emit socket event - refetch file to get updated shareLinks
        if (this.socketService && file) {
            const updatedFile = await this.fileSystemRepo.findById(fileId);
            if (updatedFile) {
                this.socketService.emitToWorkspace(file.workspaceId, {
                    type: 'file:updated',
                    workspaceId: file.workspaceId,
                    fileId,
                    updates: { shareLinks: updatedFile.shareLinks } as any,
                });
            }
        }

        return updated;
    }

    async resolveShareLink(token: string, password?: string): Promise<any> {
        return this.getByShareToken(token, password);
    }

    async listTrash(workspaceId: string): Promise<FileSystemEntry[]> {
        return this.fileSystemRepo.findDeleted(workspaceId);
    }

    async permanentlyDelete(membershipId: string, fileId: string): Promise<void> {
        return this.hardDelete(membershipId, fileId);
    }

    async getRecentFiles(accountId: string, limit: number): Promise<FileSystemEntry[]> {
        return this.fileSystemRepo.findRecentByAccount(accountId, limit);
    }
}
