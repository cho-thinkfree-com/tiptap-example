import { FastifyInstance, FastifyRequest } from 'fastify'
import { FileService } from './fileService.js'
import { z } from 'zod'

export async function fileRoutes(
    fastify: FastifyInstance,
    options: {
        fileService: FileService
        authenticate: (request: FastifyRequest) => Promise<void>
    }
) {
    const { fileService, authenticate } = options

    // Upload Request (Presigned URL)
    fastify.post('/api/workspaces/:workspaceId/files/upload', {
        preHandler: authenticate,
        schema: {
            params: z.object({ workspaceId: z.string() }),
            body: z.object({
                name: z.string(),
                mimeType: z.string(),
                size: z.number(),
                folderId: z.string().optional(),
            }),
        },
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string }
            const body = req.body as { name: string; mimeType: string; size: number; folderId?: string }
            const accountId = req.accountId!

            const result = await fileService.initiateUpload(accountId, workspaceId, body)
            return {
                ...result,
                file: {
                    ...result.file,
                    size: result.file.size.toString(), // BigInt serialization
                }
            }
        },
    })

    // Download URL
    fastify.get('/api/files/:fileId/download', {
        preHandler: authenticate,
        schema: {
            params: z.object({ fileId: z.string() }),
        },
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string }
            const accountId = req.accountId!

            const url = await fileService.getDownloadUrl(accountId, fileId)
            // Return JSON instead of redirect so frontend can use fetch with credentials
            return { downloadUrl: url }
        },
    })

    // List Files
    fastify.get('/api/workspaces/:workspaceId/files', {
        preHandler: authenticate,
        schema: {
            params: z.object({ workspaceId: z.string() }),
            querystring: z.object({
                folderId: z.string().optional(),
            }),
        },
        handler: async (req, reply) => {
            const { workspaceId } = req.params as { workspaceId: string }
            const { folderId } = req.query as { folderId?: string }
            const accountId = req.accountId!

            const files = await fileService.listFiles(accountId, workspaceId, folderId)
            return files.map(f => ({
                ...f,
                size: f.size.toString(),
            }))
        },
    })

    // Delete File
    fastify.delete('/api/files/:fileId', {
        preHandler: authenticate,
        schema: {
            params: z.object({ fileId: z.string() }),
        },
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string }
            const accountId = req.accountId!

            await fileService.deleteFile(accountId, fileId)
            return { success: true }
        },
    })

    // Create Share Link for File
    fastify.post('/api/files/:fileId/share', {
        preHandler: authenticate,
        schema: {
            params: z.object({ fileId: z.string() }),
            body: z.object({
                password: z.string().optional(),
                expiresAt: z.string().datetime().optional(),
                accessType: z.enum(['private', 'link', 'public']).optional(),
            }),
        },
        handler: async (req, reply) => {
            const { fileId } = req.params as { fileId: string }
            const body = req.body as { password?: string; expiresAt?: string; accessType?: 'private' | 'link' | 'public' }
            const accountId = req.accountId!

            const shareLink = await fileService.createShareLink(accountId, fileId, {
                password: body.password,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
                accessType: body.accessType,
            })

            return {
                token: shareLink.token,
                url: `/share/${shareLink.token}`,
                accessType: shareLink.accessType,
                expiresAt: shareLink.expiresAt,
            }
        },
    })

    // Get shared file info (public - no auth needed)
    fastify.get('/api/share/:token/file', {
        schema: {
            params: z.object({ token: z.string() }),
            querystring: z.object({
                password: z.string().optional(),
            }),
        },
        handler: async (req, reply) => {
            const { token } = req.params as { token: string }
            const { password } = req.query as { password?: string }

            try {
                const { file, shareLink } = await fileService.getFileByShareToken(token, password)
                return {
                    file: {
                        id: file.id,
                        name: file.originalName,
                        size: file.size.toString(),
                        mimeType: file.mimeType,
                        extension: file.extension,
                        createdAt: file.createdAt,
                    },
                    shareLink: {
                        accessType: shareLink.accessType,
                        requiresPassword: !!shareLink.passwordHash,
                        expiresAt: shareLink.expiresAt,
                    },
                }
            } catch (err: any) {
                if (err.code === 'PASSWORD_REQUIRED') {
                    return reply.status(401).send({ error: 'Password required', code: 'PASSWORD_REQUIRED' })
                }
                throw err
            }
        },
    })

    // Download shared file (public - no auth needed)
    fastify.get('/api/share/:token/file/download', {
        schema: {
            params: z.object({ token: z.string() }),
            querystring: z.object({
                password: z.string().optional(),
            }),
        },
        handler: async (req, reply) => {
            const { token } = req.params as { token: string }
            const { password } = req.query as { password?: string }

            const url = await fileService.getSharedFileDownloadUrl(token, password)
            return reply.redirect(url)
        },
    })

    // View shared file (public - no auth needed)
    fastify.get('/api/share/:token/file/view', {
        schema: {
            params: z.object({ token: z.string() }),
            querystring: z.object({
                password: z.string().optional(),
            }),
        },
        handler: async (req, reply) => {
            const { token } = req.params as { token: string }
            const { password } = req.query as { password?: string }

            const url = await fileService.getSharedFileViewUrl(token, password)
            return reply.redirect(url)
        },
    })
}
