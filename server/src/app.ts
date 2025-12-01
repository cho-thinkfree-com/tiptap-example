import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
// import blogRoutes from './routes/blog.routes'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { createPrismaClient, type DatabaseClient } from './lib/prismaClient.js'
import { PrismaAccountRepository } from './modules/accounts/accountRepository.js'
import { AccountService } from './modules/accounts/accountService.js'
import { AuthService } from './modules/auth/authService.js'
import { PrismaSessionRepository } from './modules/auth/sessionRepository.js'
import { PrismaPasswordResetRepository } from './modules/auth/passwordResetRepository.js'
import { AuditLogRepository } from './modules/audit/auditLogRepository.js'
import { AuditLogService } from './modules/audit/auditLogService.js'
import { WorkspaceAuditService } from './modules/audit/workspaceAuditService.js'
import { WorkspaceRepository } from './modules/workspaces/workspaceRepository.js'
import { MembershipRepository } from './modules/workspaces/membershipRepository.js'
import { MembershipAccessDeniedError, MembershipService } from './modules/workspaces/membershipService.js'
import { isReservedHandle } from './lib/reservedHandles.js'
import { WorkspaceNotFoundError } from './modules/workspaces/workspaceService.js'
import { WorkspaceService } from './modules/workspaces/workspaceService.js'
import { WorkspaceAccessService } from './modules/workspaces/workspaceAccess.js'
import { InvitationRepository } from './modules/workspaces/invitationRepository.js'
import { WorkspaceInvitationService } from './modules/workspaces/invitationService.js'
import { JoinRequestRepository } from './modules/workspaces/joinRequestRepository.js'
import { WorkspaceJoinRequestService } from './modules/workspaces/joinRequestService.js'
import { ExportJobRepository } from './modules/export/exportJobRepository.js'
import {
  ExportJobService,
} from './modules/export/exportJobService.js'
import { StorageService } from './modules/storage/storageService.js'

const __filename = fileURLToPath(import.meta.url)

  // Handle BigInt serialization
  ; (BigInt.prototype as any).toJSON = function () {
    return this.toString()
  }
const __dirname = path.dirname(__filename)

declare module 'fastify' {
  interface FastifyRequest {
    db: DatabaseClient
    accountId?: string
    sessionId?: string
    membershipId?: string  // Added for file system operations
    workspaceId?: string   // Added for convenience in middleware
    startTime?: number
  }
}

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  // CORS
  await app.register(fastifyCors as any, {
    origin: [process.env.FRONTEND_URL || 'http://localhost:9910'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // Cookie support
  app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || 'change-me-in-production',
  })

  // Static files
  app.register(fastifyStatic, {
    root: path.join(__dirname, '../../public'),
    prefix: '/public/',
  })

  const db = await createPrismaClient()

  const accountRepository = new PrismaAccountRepository(db)
  const sessionRepository = new PrismaSessionRepository(db)
  const passwordResetRepository = new PrismaPasswordResetRepository(db)
  const accountService = new AccountService(accountRepository)
  const authService = new AuthService(
    accountService,
    accountRepository,
    sessionRepository,
    passwordResetRepository,
  )

  const workspaceRepository = new WorkspaceRepository(db)
  const membershipRepository = new MembershipRepository(db)
  const auditLogRepository = new AuditLogRepository(db)
  const auditLogService = new AuditLogService(auditLogRepository)
  const workspaceAccess = new WorkspaceAccessService(workspaceRepository, membershipRepository)
  const workspaceService = new WorkspaceService(
    workspaceRepository,
    membershipRepository,
    workspaceAccess,
    accountRepository,
  )
  const membershipService = new MembershipService(membershipRepository, workspaceRepository, auditLogService)
  const invitationService = new WorkspaceInvitationService(
    new InvitationRepository(db),
    membershipRepository,
    workspaceRepository,
    accountRepository,
    auditLogService,
  )
  const joinRequestService = new WorkspaceJoinRequestService(
    new JoinRequestRepository(db),
    membershipRepository,
    workspaceRepository,
    accountRepository,
    auditLogService,
  )

  const exportJobRepository = new ExportJobRepository(db)
  const exportJobService = new ExportJobService(
    exportJobRepository,
    membershipRepository,
    workspaceAccess,
    auditLogService,
  )

  const workspaceAuditService = new WorkspaceAuditService(
    workspaceRepository,
    membershipRepository,
    auditLogService,
  )

  // app.register(blogRoutes, { prefix: '/api/v1/blog' })

  const storageService = new StorageService()

  // Import new unified repositories and service
  const { FileSystemRepository } = await import('./modules/filesystem/fileSystemRepository.js')
  const { RevisionRepository } = await import('./modules/filesystem/revisionRepository.js')
  const { ShareLinkRepository } = await import('./modules/filesystem/shareLinkRepository.js')
  const { FileSystemService } = await import('./modules/filesystem/fileSystemService.js')
  const { fileSystemRoutes } = await import('./modules/filesystem/fileSystemRoutes.js')

  const fileSystemRepository = new FileSystemRepository(db)
  const revisionRepository = new RevisionRepository(db)
  const shareLinkRepository = new ShareLinkRepository(db)

  const fileSystemService = new FileSystemService(
    fileSystemRepository,
    revisionRepository,
    shareLinkRepository,
    storageService,
    workspaceAccess
  )

  // Blog service
  const { BlogRepository } = await import('./modules/blog/blogRepository.js')
  const { BlogService } = await import('./modules/blog/blogService.js')
  const blogRepository = new BlogRepository(db)
  const blogService = new BlogService(blogRepository, storageService)

  // Register routes AFTER authenticate is defined
  const createUnauthorized = (message: string) => {
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = 401
    return error
  }

  const authenticate = async (request: FastifyRequest) => {
    const sessionId = request.cookies.session_id
    if (!sessionId) {
      throw createUnauthorized('Missing session')
    }

    const session = await db.session.findUnique({
      where: { id: sessionId },
    })

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw createUnauthorized('Invalid or expired session')
    }

    request.accountId = session.accountId
    request.sessionId = session.id
  }

  // Register unified file system routes
  app.register(fileSystemRoutes, { fileSystemService, authenticate, db })

  app.addHook('onRequest', async (request) => {
    request.db = db
    request.startTime = Date.now()
  })

  const requireAccountId = (request: FastifyRequest) => {
    const accountId = request.accountId
    if (!accountId) {
      throw createUnauthorized('Account missing')
    }
    return accountId
  }

  // ============================================================================
  // AUTH ROUTES
  // ============================================================================

  app.post('/api/v1/auth/signup', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      legalName: z.string().optional(),
    })
    const body = schema.parse(request.body)
    const { account, session } = await authService.signup({
      email: body.email,
      password: body.password,
      legalName: body.legalName,
    })
    reply.setCookie('session_id', session.sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60,
    })
    return { account, session }
  })

  app.post('/api/v1/auth/login', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string(),
    })
    const body = schema.parse(request.body)
    const { account, session } = await authService.login({
      email: body.email,
      password: body.password,
    })
    reply.setCookie('session_id', session.sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60,
    })
    return { account, session }
  })

  app.post('/api/v1/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    const sessionId = request.sessionId
    if (sessionId) {
      await authService.logout(sessionId)
    }
    reply.clearCookie('session_id', { path: '/' })
    return { success: true }
  })

  app.get('/api/v1/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const account = await accountService.findById(accountId)
    if (!account) {
      throw createUnauthorized('Account not found')
    }
    return { account }
  })

  // ============================================================================
  // WORKSPACE ROUTES
  // ============================================================================

  app.get('/api/v1/workspaces', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaces = await workspaceService.listForAccount(accountId)
    return { workspaces }
  })

  app.get('/api/v1/workspaces/:workspaceId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { workspaceId } = request.params as { workspaceId: string }
    const workspace = await workspaceService.getById(accountId, workspaceId)
    return workspace
  })

  app.post('/api/v1/workspaces', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const schema = z.object({
      name: z.string(),
      description: z.string().optional(),
      handle: z.string().optional(),
    })
    const body = schema.parse(request.body)

    if (body.handle && isReservedHandle(body.handle)) {
      return reply.status(400).send({ error: 'Handle is reserved' })
    }

    const workspace = await workspaceService.create(accountId, body)
    return workspace
  })

  app.patch('/api/v1/workspaces/:workspaceId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { workspaceId } = request.params as { workspaceId: string }
    const schema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      handle: z.string().optional(),
      visibility: z.enum(['private', 'listed', 'public']).optional(),
    })
    const body = schema.parse(request.body)

    if (body.handle && isReservedHandle(body.handle)) {
      return reply.status(400).send({ error: 'Handle is reserved' })
    }

    const workspace = await workspaceService.update(accountId, workspaceId, body)
    return workspace
  })

  app.get('/api/v1/workspaces/:workspaceId/members', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { workspaceId } = request.params as { workspaceId: string }
    await workspaceAccess.assertMember(accountId, workspaceId)
    const memberships = await membershipService.listMemberships(workspaceId)
    return { memberships }
  })

  app.post('/api/v1/workspaces/:workspaceId/members', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { workspaceId } = request.params as { workspaceId: string }
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(['owner', 'admin', 'member']),
    })
    const body = schema.parse(request.body)

    const invitee = await accountService.findByEmail(body.email)
    if (!invitee) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const membership = await membershipService.addMember(accountId, workspaceId, {
      accountId: invitee.id,
      role: body.role,
    })
    return membership
  })

  // Member management
  // Get current user's profile (must be before :accountId route)
  app.get('/api/v1/workspaces/:workspaceId/members/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireAccountId(request)
    const { workspaceId } = request.params as { workspaceId: string }
    await workspaceAccess.assertMember(userId, workspaceId)
    const memberProfile = await membershipService.getMemberProfile(workspaceId, userId)
    return memberProfile
  })

  // Update current user's profile
  app.patch('/api/v1/workspaces/:workspaceId/members/me', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireAccountId(request)
    const { workspaceId } = request.params as { workspaceId: string }
    await workspaceAccess.assertMember(userId, workspaceId)
    const body = request.body as any
    const updated = await membershipService.updateMemberProfile(workspaceId, userId, body)
    return updated
  })

  app.get('/api/v1/workspaces/:workspaceId/members/:accountId', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireAccountId(request)
    const { workspaceId, accountId } = request.params as { workspaceId: string; accountId: string }
    await workspaceAccess.assertMember(userId, workspaceId)
    const memberProfile = await membershipService.getMemberProfile(workspaceId, accountId)
    return memberProfile
  })

  app.patch('/api/v1/workspaces/:workspaceId/members/:accountId', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireAccountId(request)
    const { workspaceId, accountId } = request.params as { workspaceId: string; accountId: string }
    await workspaceAccess.assertMember(userId, workspaceId)
    const body = request.body as any
    const updated = await membershipService.updateMemberProfile(workspaceId, accountId, body)
    return updated
  })

  app.patch('/api/v1/workspaces/:workspaceId/members/:membershipId/role', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireAccountId(request)
    const { workspaceId, membershipId } = request.params as { workspaceId: string; membershipId: string }
    await workspaceAccess.assertAdminOrOwner(userId, workspaceId)
    const { role } = request.body as { role: string }
    const updated = await membershipService.changeMemberRole(membershipId, role)
    return updated
  })

  app.delete('/api/v1/workspaces/:workspaceId/members/:membershipId', { preHandler: authenticate }, async (request, reply) => {
    const userId = requireAccountId(request)
    const { workspaceId, membershipId } = request.params as { workspaceId: string; membershipId: string }
    await workspaceAccess.assertAdminOrOwner(userId, workspaceId)
    await membershipService.removeMemberById(membershipId)
    return { success: true }
  })

  // Account update
  app.patch('/api/v1/auth/update', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const body = request.body as any

    // Update account with new data
    const updatedAccount = await accountService.updateAccount(accountId, body)

    return {
      id: updatedAccount.id,
      email: updatedAccount.email,
      legalName: updatedAccount.legalName,
      preferredLocale: updatedAccount.preferredLocale,
      preferredTimezone: updatedAccount.preferredTimezone,
    }
  })

  // Share links (legacy routes for compatibility)
  app.get('/api/v1/documents/:documentId/share-links', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { documentId } = request.params as { documentId: string }
    // Get file system entry to check permissions
    const file = await fileSystemService.getFileSystemEntry(accountId, documentId)
    const shareLinks = await fileSystemService.getShareLinks(documentId)
    return shareLinks
  })

  app.post('/api/v1/share-links/:linkId/revoke', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { linkId } = request.params as { linkId: string }
    await fileSystemService.revokeShareLink(accountId, linkId)
    return { success: true }
  })

  app.patch('/api/v1/share-links/:linkId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { linkId } = request.params as { linkId: string }
    const body = request.body as any
    const updated = await fileSystemService.updateShareLink(accountId, linkId, body)
    return updated
  })

  app.post('/api/v1/share-links/:token/access', async (request, reply) => {
    const { token } = request.params as { token: string }
    const { password } = request.body as { password?: string }
    const data = await fileSystemService.resolveShareLink(token, password)
    return data
  })

  // Trash routes
  app.get('/api/v1/workspaces/:workspaceId/trash', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { workspaceId } = request.params as { workspaceId: string }
    await workspaceAccess.assertMember(accountId, workspaceId)
    const trashedItems = await fileSystemService.listTrash(workspaceId)
    return trashedItems.map((item) => ({
      ...item,
      size: item.size?.toString(),
      shareLinks: (item as any).shareLinks?.map((link: any) => ({
        ...link,
        requiresPassword: !!link.passwordHash,
        passwordHash: undefined,
      })),
    }))
  })

  app.delete('/api/v1/documents/:documentId/permanent', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { documentId } = request.params as { documentId: string }
    await fileSystemService.permanentlyDelete(accountId, documentId)
    return { success: true }
  })

  app.delete('/api/v1/folders/:folderId/permanent', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { folderId } = request.params as { folderId: string }
    await fileSystemService.permanentlyDelete(accountId, folderId)
    return { success: true }
  })

  // Asset upload routes
  app.post('/api/v1/workspaces/:workspaceId/documents/:documentId/assets/upload', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { workspaceId, documentId } = request.params as { workspaceId: string; documentId: string }
    const { filename, contentType } = request.body as { filename: string; contentType?: string }

    await workspaceAccess.assertMember(accountId, workspaceId)

    const assetKey = `workspaces/${workspaceId}/documents/${documentId}/assets/${Date.now()}-${filename}`
    const uploadUrl = await storageService.getPresignedPutUrl(assetKey, contentType || 'application/octet-stream', 3600)

    return { uploadUrl, assetKey }
  })

  // Blog routes (stubs for compatibility)
  app.get('/api/v1/blog/:handle/profile', async (request, reply) => {
    const { handle } = request.params as { handle: string }
    const profile = await blogService.getProfileByHandle(handle)
    if (!profile) {
      return reply.status(404).send({ error: 'Blog not found' })
    }
    return {
      id: profile.membershipId,
      ...profile,
    }
  })

  app.get('/api/v1/blog/:handle/documents', async (request, reply) => {
    const { handle } = request.params as { handle: string }
    const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number }
    const result = await blogService.getPublicDocuments(handle, Number(page), Number(limit))
    return result
  })

  app.get('/api/v1/blog/:workspaceId/:membershipId/profile', async (request, reply) => {
    const { membershipId } = request.params as { workspaceId: string; membershipId: string }
    const profile = await blogService.getProfileByMembershipId(membershipId)
    if (!profile) {
      return reply.status(404).send({ error: 'Blog not found' })
    }
    return {
      id: profile.membershipId,
      ...profile,
    }
  })

  app.get('/api/v1/blog/:workspaceId/:membershipId/documents', async (request, reply) => {
    const { membershipId } = request.params as { workspaceId: string; membershipId: string }
    const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number }
    const result = await blogService.getPublicDocumentsByMembershipId(membershipId, Number(page), Number(limit))
    return result
  })

  app.get('/api/v1/blog/:handle', async (request, reply) => {
    const { handle } = request.params as { handle: string }
    const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number }
    const [profile, docs] = await Promise.all([
      blogService.getProfileByHandle(handle),
      blogService.getPublicDocuments(handle, Number(page), Number(limit))
    ])
    if (!profile) {
      return reply.status(404).send({ error: 'Blog not found' })
    }
    return {
      profile: { id: profile.membershipId, ...profile },
      documents: docs.documents,
      pagination: docs.pagination
    }
  })

  app.get('/api/v1/blog/check/:handle', async (request, reply) => {
    const { handle } = request.params as { handle: string }
    const available = await blogService.checkHandleAvailability(handle)
    return { available }
  })

  // Get single blog document by index
  app.get('/api/v1/blog/:handle/documents/:documentNumber', async (request, reply) => {
    const { handle, documentNumber } = request.params as { handle: string; documentNumber: string }
    const docNumber = parseInt(documentNumber, 10)

    if (isNaN(docNumber)) {
      return reply.status(400).send({ error: 'Invalid document number' })
    }

    const result = await blogService.getDocumentByHandleAndIndex(handle, docNumber)
    if (!result) {
      return reply.status(404).send({ error: 'Document not found' })
    }

    return result
  })

  // Get author documents by share token
  app.get('/api/v1/share-links/:token/author-documents', async (request, reply) => {
    const { token } = request.params as { token: string }

    const shareLink = await db.shareLink.findUnique({
      where: { token },
      include: {
        file: true
      }
    })

    if (!shareLink || !shareLink.file) {
      return reply.status(404).send({ error: 'Link not found' })
    }

    const membershipId = shareLink.file.createdBy
    const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number }

    const [result, profile] = await Promise.all([
      blogService.getPublicDocumentsByMembershipId(membershipId, Number(page), Number(limit)),
      blogService.getProfileByMembershipId(membershipId)
    ])

    const transformedProfile = profile ? {
      id: profile.membershipId,
      ...profile,
    } : null

    return { ...result, profile: transformedProfile }
  })

  // Recent documents (legacy route)
  app.get('/api/v1/documents/recent', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { sortBy, sortOrder } = request.query as { sortBy?: string; sortOrder?: string }
    // Return recent files across all workspaces
    const recentFiles = await fileSystemService.getRecentFiles(accountId, 50)
    return recentFiles.map((item) => ({
      ...item,
      size: item.size?.toString(),
      lastModifiedByName: (item as any).currentRevision?.creator?.displayName || (item as any).currentRevision?.creator?.account?.legalName || 'Unknown',
      shareLinks: (item as any).shareLinks?.map((link: any) => ({
        ...link,
        requiresPassword: !!link.passwordHash,
        passwordHash: undefined,
      })),
    }))
  })

  // Public documents (legacy route)
  app.get('/api/v1/workspaces/:workspaceId/public-documents', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { workspaceId } = request.params as { workspaceId: string }
    await workspaceAccess.assertMember(accountId, workspaceId)

    // Get all documents with active share links (both public and link-only)
    const sharedDocs = await db.fileSystemEntry.findMany({
      where: {
        workspaceId,
        type: 'file',
        mimeType: 'application/x-odocs',
        deletedAt: null,
        shareLinks: {
          some: {
            revokedAt: null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        size: true,
        isStarred: true,
        shareLinks: {
          where: { revokedAt: null },
          select: {
            id: true,
            token: true,
            accessLevel: true,
            accessType: true,
            expiresAt: true,
            createdAt: true,
            passwordHash: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return sharedDocs.map((item) => ({
      ...item,
      size: item.size?.toString(),
      shareLinks: item.shareLinks.map((link) => ({
        ...link,
        requiresPassword: !!link.passwordHash,
        passwordHash: undefined,
      })),
    }))
  })

  // Error handlers
  app.setErrorHandler((error: Error | any, request, reply) => {
    // Known application errors
    if (error instanceof WorkspaceNotFoundError) {
      return reply.status(404).send({ error: 'Workspace not found' })
    }
    if (error instanceof MembershipAccessDeniedError) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    // Log all errors for debugging
    request.log.error(error)

    // Handle errors with statusCode (custom errors)
    const statusCode = error.statusCode || 500
    const message = error.message || 'Internal server error'

    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production'

    reply.status(statusCode).send({
      error: message,
      ...(isDevelopment && statusCode === 500 ? { stack: error.stack } : {}),
    })
  })

  app.addHook('onClose', async () => {
    await db.$disconnect()
  })

  return app
}

async function start() {
  try {
    const app = await buildServer()
    const port = Number(process.env.PORT) || 9920
    const host = process.env.HOST || '0.0.0.0'

    await app.listen({ port, host })
    console.log(`Server listening on ${host}:${port}`)
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()
