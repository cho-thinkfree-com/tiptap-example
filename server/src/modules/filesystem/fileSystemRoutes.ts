import { FastifyInstance, FastifyRequest } from 'fastify';
import { FileSystemService } from './fileSystemService.js';
import { PrismaClient } from '@prisma/client';
import { validateOdocsContent } from '../../lib/odocsValidator.js';

export async function fileSystemRoutes(
    fastify: FastifyInstance,
    options: {
        fileSystemService: FileSystemService;
        authenticate: (request: FastifyRequest) => Promise<void>;
        db: PrismaClient;
    }
) {
    const { fileSystemService, authenticate, db } = options;

    // Middleware to resolve membershipId from workspaceId
    const resolveMembership = async (request: FastifyRequest, reply: any) => {
        const accountId = (request as any).accountId;
        const params = request.params as any;
        const workspaceId = params.workspaceId;

        if (!accountId || !workspaceId) {
            return; // Skip if no workspace context
        }

        // Find membership for this user in this workspace
        const membership = await db.workspaceMembership.findFirst({
            where: {
                workspaceId,
                accountId,
                status: 'active',
            },
        });

        if (!membership) {
            reply.status(403).send({ error: 'Not a member of this workspace' });
            return;
        }

        (request as any).membershipId = membership.id;
    };

    // Middleware for routes that only have documentId (finds workspace via document)
    const resolveMembershipByDocumentId = async (request: FastifyRequest, reply: any) => {
        const accountId = (request as any).accountId;
        const params = request.params as any;
        const documentId = params.documentId;

        if (!accountId || !documentId) {
            return;
        }

        // Find the document to get workspaceId
        const document = await db.fileSystemEntry.findUnique({
            where: { id: documentId },
            select: { workspaceId: true },
        });

        if (!document) {
            reply.status(404).send({ error: 'Document not found' });
            return;
        }

        // Find membership for this user in document's workspace
        const membership = await db.workspaceMembership.findFirst({
            where: {
                workspaceId: document.workspaceId,
                accountId,
                status: 'active',
            },
        });

        if (!membership) {
            reply.status(403).send({ error: 'Not a member of this workspace' });
            return;
        }

        (request as any).membershipId = membership.id;
        (request as any).workspaceId = document.workspaceId; // Also set for convenience
    };

    // Middleware for routes that only have fileId (finds workspace via file)
    const resolveMembershipByFileId = async (request: FastifyRequest, reply: any) => {
        const accountId = (request as any).accountId;
        const params = request.params as any;
        const fileId = params.fileId;

        if (!accountId || !fileId) {
            return;
        }

        // Find the file to get workspaceId
        const file = await db.fileSystemEntry.findUnique({
            where: { id: fileId },
            select: { workspaceId: true },
        });

        if (!file) {
            reply.status(404).send({ error: 'File not found' });
            return;
        }

        // Find membership for this user in file's workspace
        const membership = await db.workspaceMembership.findFirst({
            where: {
                workspaceId: file.workspaceId,
                accountId,
                status: 'active',
            },
        });

        if (!membership) {
            reply.status(403).send({ error: 'Not a member of this workspace' });
            return;
        }

        (request as any).membershipId = membership.id;
        (request as any).workspaceId = file.workspaceId;
    };

    // ============================================================================
    // FOLDER OPERATIONS
    // ============================================================================

    // Create folder
    fastify.post('/api/workspaces/:workspaceId/folders', {
        preHandler: [authenticate, resolveMembership],
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string };
            const { name, parentId } = req.body as { name: string; parentId?: string };
            const membershipId = (req as any).membershipId;

            const folder = await fileSystemService.createFolder(
                membershipId,
                workspaceId,
                name,
                parentId
            );

            return folder;
        },
    });

    // ============================================================================
    // DOCUMENT OPERATIONS (.odocs files)
    // ============================================================================

    // Create document
    fastify.post('/api/workspaces/:workspaceId/documents', {
        preHandler: [authenticate, resolveMembership],
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string };
            const { title, content, folderId } = req.body as {
                title: string;
                content?: any;
                folderId?: string;
            };
            const membershipId = (req as any).membershipId;

            const defaultContent = content || {
                type: 'doc',
                content: [],
            };

            const document = await fileSystemService.createDocument(
                membershipId,
                workspaceId,
                title,
                defaultContent,
                folderId
            );

            return document;
        },
    });

    // Get document content
    fastify.get('/api/documents/:documentId/content', {
        preHandler: [authenticate, resolveMembershipByDocumentId],
        handler: async (req, reply) => {
            const { documentId } = req.params as { documentId: string };
            const membershipId = (req as any).membershipId;

            const content = await fileSystemService.getDocumentContent(membershipId, documentId);
            return content;
        },
    });

    // Update document content
    fastify.put('/api/documents/:documentId/content', {
        preHandler: [authenticate, resolveMembershipByDocumentId],
        handler: async (req, reply) => {
            const { documentId } = req.params as { documentId: string };
            const { content } = req.body as { content: any };
            const membershipId = (req as any).membershipId;

            const document = await fileSystemService.updateDocument(
                membershipId,
                documentId,
                content
            );

            return document;
        },
    });

    // ============================================================================
    // FILE OPERATIONS (general files)
    // ============================================================================

    // Initiate file upload (presigned URL)
    fastify.post('/api/workspaces/:workspaceId/files/upload', {
        preHandler: [authenticate, resolveMembership],
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string };
            const { name, mimeType, size, folderId } = req.body as {
                name: string;
                mimeType: string;
                size: number;
                folderId?: string;
            };
            const membershipId = (req as any).membershipId;

            // Generate temporary file ID
            const tempFileId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const uploadKey = `workspaces/${workspaceId}/uploads/${tempFileId}`;

            // Get presigned URL for upload
            const uploadUrl = await fileSystemService['storageService'].getPresignedPutUrl(
                uploadKey,
                mimeType
            );

            return {
                uploadUrl,
                uploadKey,
                fileId: tempFileId,
            };
        },
    });

    // Confirm file upload
    fastify.post('/api/workspaces/:workspaceId/files/confirm', {
        preHandler: [authenticate, resolveMembership],
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string };
            const { uploadKey, name, mimeType, size, folderId } = req.body as {
                uploadKey: string;
                name: string;
                mimeType: string;
                size: number;
                folderId?: string;
            };
            const membershipId = (req as any).membershipId;

            // Get uploaded file from S3
            const buffer = await fileSystemService['storageService'].getObject(uploadKey);

            // Detect extension
            const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';

            // Validate .odocs files
            if (extension === '.odocs' || mimeType === 'application/x-odocs' || mimeType === 'application/vnd.odocs') {
                try {
                    const content = JSON.parse(buffer.toString('utf-8'));
                    const validation = validateOdocsContent(content);

                    if (!validation.valid) {
                        // Delete temp upload
                        await fileSystemService['storageService'].deleteObject(uploadKey);

                        return reply.status(400).send({
                            error: 'Invalid .odocs file format',
                            details: validation.error,
                        });
                    }
                } catch (e) {
                    // Delete temp upload
                    await fileSystemService['storageService'].deleteObject(uploadKey);

                    return reply.status(400).send({
                        error: 'Invalid .odocs file',
                        details: e instanceof Error ? e.message : 'Failed to parse JSON',
                    });
                }
            }

            // Create file entry
            const file = await fileSystemService.createFile(
                membershipId,
                workspaceId,
                name,
                mimeType,
                extension,
                buffer,
                folderId
            );

            // Delete temp upload
            await fileSystemService['storageService'].deleteObject(uploadKey);

            return {
                ...file,
                size: file.size?.toString(),
            };
        },
    });

    // Get file download URL
    fastify.get('/api/files/:fileId/download', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            console.log('[DOWNLOAD] Endpoint hit with fileId:', req.params);
            const { fileId } = req.params as { fileId: string };
            const membershipId = (req as any).membershipId;
            console.log('[DOWNLOAD] MembershipId:', membershipId);

            const url = await fileSystemService.getFileDownloadUrl(membershipId, fileId);
            console.log('[DOWNLOAD] Generated presigned URL, length:', url.length);

            // Return JSON instead of redirect so frontend can use fetch with credentials
            const response = { downloadUrl: url };
            console.log('[DOWNLOAD] Returning JSON response');
            return response;
        },
    });

    // ============================================================================
    // COMMON OPERATIONS (folders, documents, files)
    // ============================================================================

    // List files/folders in workspace root
    fastify.get('/api/workspaces/:workspaceId/files', {
        preHandler: [authenticate, resolveMembership],
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string };
            const membershipId = (req as any).membershipId;

            const items = await fileSystemService.listByWorkspace(
                membershipId,
                workspaceId,
                null // root folder
            );

            // Format for response
            return items.map((item) => ({
                ...item,
                size: item.size?.toString(),
                shareLinks: (item as any).shareLinks?.map((link: any) => ({
                    ...link,
                    requiresPassword: !!link.passwordHash,
                    passwordHash: undefined,
                })),
            }));
        },
    });

    // List files/folders in specific folder
    fastify.get('/api/workspaces/:workspaceId/files/:folderId', {
        preHandler: [authenticate, resolveMembership],
        handler: async (req, reply) => {
            const { workspaceId, folderId } = req.params as {
                workspaceId: string;
                folderId: string;
            };
            const membershipId = (req as any).membershipId;

            const items = await fileSystemService.listByWorkspace(
                membershipId,
                workspaceId,
                folderId
            );

            // Format for response
            return items.map((item) => ({
                ...item,
                size: item.size?.toString(),
                shareLinks: (item as any).shareLinks?.map((link: any) => ({
                    ...link,
                    requiresPassword: !!link.passwordHash,
                    passwordHash: undefined,
                })),
            }));
        },
    });

    // Get single file/folder
    fastify.get('/api/filesystem/:fileId', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            const membershipId = (req as any).membershipId;

            const item = await fileSystemService.getById(membershipId, fileId);
            return {
                ...item,
                size: item.size?.toString(),
                shareLinks: (item as any).shareLinks?.map((link: any) => ({
                    ...link,
                    requiresPassword: !!link.passwordHash,
                    passwordHash: undefined,
                })),
            };
        },
    });

    // Update metadata
    fastify.patch('/api/filesystem/:fileId', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            const body = req.body as {
                name?: string;
                displayName?: string;
                description?: string;
                isShared?: boolean;
                isStarred?: boolean;
            };
            const membershipId = (req as any).membershipId;

            const item = await fileSystemService.updateMetadata(membershipId, fileId, body);
            return item;
        },
    });

    // Rename
    fastify.patch('/api/filesystem/:fileId/rename', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            const { name } = req.body as { name: string };
            const membershipId = (req as any).membershipId;

            const item = await fileSystemService.rename(membershipId, fileId, name);
            return item;
        },
    });

    // Move
    fastify.patch('/api/filesystem/:fileId/move', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            const { parentId } = req.body as { parentId: string | null };
            const membershipId = (req as any).membershipId;

            const item = await fileSystemService.move(membershipId, fileId, parentId);
            return item;
        },
    });

    // Toggle star
    fastify.post('/api/filesystem/:fileId/star', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            const membershipId = (req as any).membershipId;

            const item = await fileSystemService.toggleStar(membershipId, fileId);
            return item;
        },
    });

    // Delete (soft)
    fastify.delete('/api/filesystem/:fileId', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            const membershipId = (req as any).membershipId;

            await fileSystemService.softDelete(membershipId, fileId);
            return { success: true };
        },
    });

    // Restore from trash
    fastify.post('/api/filesystem/:fileId/restore', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            const membershipId = (req as any).membershipId;

            const item = await fileSystemService.restore(membershipId, fileId);
            return item;
        },
    });

    // ============================================================================
    // SHARING
    // ============================================================================

    // Create share link
    fastify.post('/api/filesystem/:fileId/share', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            const { password, expiresAt, accessType } = req.body as {
                password?: string;
                expiresAt?: string;
                accessType?: 'private' | 'link' | 'public';
            };
            const membershipId = (req as any).membershipId;

            const shareLink = await fileSystemService.createShareLink(membershipId, fileId, {
                password,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
                accessType,
            });

            const urlPrefix = shareLink.accessType === 'public' ? '/public' : '/share';

            return {
                id: shareLink.id,
                token: shareLink.token,
                url: `${urlPrefix}/${shareLink.token}`,
                accessType: shareLink.accessType,
                expiresAt: shareLink.expiresAt,
                requiresPassword: !!shareLink.passwordHash,
            };
        },
    });

    // Get share links
    fastify.get('/api/filesystem/:fileId/share', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            // membershipId is resolved by middleware but not strictly needed for this call if we trust resolveMembershipByFileId to check access
            // But getShareLinks in service doesn't take membershipId, it just calls repo.
            // We should probably verify access. resolveMembershipByFileId does that.

            const links = await fileSystemService.getShareLinks(fileId);
            return links;
        },
    });

    // Get shared file (public - no auth)
    fastify.get('/api/share/:token', {
        handler: async (req, reply) => {
            const { token } = req.params as { token: string };
            const { password } = req.query as { password?: string };

            try {
                const result = await fileSystemService.getByShareToken(token, password);

                return {
                    file: {
                        id: result.file.id,
                        name: result.file.name,
                        type: result.file.type,
                        mimeType: result.file.mimeType,
                        extension: result.file.extension,
                        size: result.file.size?.toString(),
                        createdAt: result.file.createdAt,
                        updatedAt: result.file.updatedAt,
                    },
                    shareLink: result.shareLink,
                };
            } catch (err: any) {
                if (err.code === 'PASSWORD_REQUIRED') {
                    return reply.status(401).send({
                        error: 'Password required',
                        code: 'PASSWORD_REQUIRED',
                    });
                }
                throw err;
            }
        },
    });

    // Download shared file (public - no auth)
    fastify.get('/api/share/:token/download', {
        handler: async (req, reply) => {
            const { token } = req.params as { token: string };
            const { password } = req.query as { password?: string };

            const url = await fileSystemService.getSharedFileDownloadUrl(token, password);
            return reply.redirect(url);
        },
    });

    // ============================================================================
    // UTILITY
    // ============================================================================

    // Get ancestors (breadcrumb)
    fastify.get('/api/filesystem/:fileId/ancestors', {
        preHandler: [authenticate, resolveMembershipByFileId],
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string };
            const membershipId = (req as any).membershipId;

            const ancestors = await fileSystemService.getAncestors(membershipId, fileId);
            return ancestors;
        },
    });

    // Get starred items
    fastify.get('/api/workspaces/:workspaceId/starred', {
        preHandler: [authenticate, resolveMembership],
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string };
            const membershipId = (req as any).membershipId;

            const items = await fileSystemService.getStarred(membershipId, workspaceId);
            return items.map((item) => ({
                ...item,
                size: item.size?.toString(),
                shareLinks: (item as any).shareLinks?.map((link: any) => ({
                    ...link,
                    requiresPassword: !!link.passwordHash,
                    passwordHash: undefined,
                })),
            }));
        },
    });

    // Get recently modified
    fastify.get('/api/workspaces/:workspaceId/recent', {
        preHandler: [authenticate, resolveMembership],
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string };
            const { limit } = req.query as { limit?: number };
            const membershipId = (req as any).membershipId;

            const items = await fileSystemService.getRecentlyModified(
                membershipId,
                workspaceId,
                limit
            );

            return items.map((item) => ({
                ...item,
                size: item.size?.toString(),
            }));
        },
    });

    // Search
    fastify.get('/api/workspaces/:workspaceId/search', {
        preHandler: [authenticate, resolveMembership],
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string };
            const { q } = req.query as { q: string };
            const membershipId = (req as any).membershipId;

            const items = await fileSystemService.search(membershipId, workspaceId, q);
            return items.map((item) => ({
                ...item,
                size: item.size?.toString(),
            }));
        },
    });
}
