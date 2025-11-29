import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import blogRoutes from './routes/blog.routes'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { DocumentStatus, DocumentVisibility } from '@prisma/client'
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
import { DocumentRepository, type DocumentListFilters } from './modules/documents/documentRepository.js'
import { DocumentRevisionRepository } from './modules/documents/documentRevisionRepository.js'
import { FolderRepository } from './modules/documents/folderRepository.js'
import { FolderService } from './modules/documents/folderService.js'
import { DocumentService } from './modules/documents/documentService.js'
import { DocumentPermissionRepository } from './modules/documents/documentPermissionRepository.js'
import { DocumentAccessService } from './modules/documents/documentAccessService.js'
import { DocumentPermissionService } from './modules/documents/documentPermissionService.js'
import { ShareLinkService } from './modules/documents/shareLinkService.js'
import { DocumentTagRepository } from './modules/documents/documentTagRepository.js'
import {
  DocumentTagService,
  DocumentTagAlreadyExistsError,
  DocumentTagNotFoundError,
} from './modules/documents/documentTagService.js'
import { DocumentShareLinkRepository } from './modules/documents/documentShareLinkRepository.js'
import { DocumentShareLinkSessionRepository } from './modules/documents/documentShareLinkSessionRepository.js'
import { ExternalCollaboratorRepository } from './modules/documents/externalCollaboratorRepository.js'
import { ExportJobRepository } from './modules/export/exportJobRepository.js'
import {
  ExportJobService,
  ExportJobNotReadyError,
  ExportJobRetryLimitExceededError,
  ExportJobRetryNotAllowedError,
} from './modules/export/exportJobService.js'

export interface ServerOptions {
  prisma?: DatabaseClient
  logger?: boolean
}

export const buildServer = async ({ prisma, logger = true }: ServerOptions = {}) => {
  const db = prisma ?? createPrismaClient()
  const app = Fastify({ logger })

  await app.register(fastifyCors as any, {
    origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
  })

  app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET || 'super-secret-cookie-secret',
    hook: 'onRequest',
  })

  app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'docs/api/v1/openapi'),
    prefix: '/api/v1/openapi/',
    decorateReply: false,
  })

  const accountRepository = new PrismaAccountRepository(db)
  const accountService = new AccountService(accountRepository)
  const sessionRepository = new PrismaSessionRepository(db)
  const passwordResetRepository = new PrismaPasswordResetRepository(db)
  const authService = new AuthService(
    accountService,
    accountRepository,
    sessionRepository,
    passwordResetRepository,
  )

  const auditLogRepository = new AuditLogRepository(db)
  const auditLogService = new AuditLogService(auditLogRepository)

  const workspaceRepository = new WorkspaceRepository(db)
  const membershipRepository = new MembershipRepository(db)
  const workspaceAccess = new WorkspaceAccessService(workspaceRepository, membershipRepository)
  const workspaceService = new WorkspaceService(workspaceRepository, membershipRepository, workspaceAccess, accountRepository)
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

  const documentRepository = new DocumentRepository(db)
  const documentRevisionRepository = new DocumentRevisionRepository(db)
  const folderRepository = new FolderRepository(db)
  const folderService = new FolderService(folderRepository, workspaceAccess, documentRepository, membershipRepository)
  const documentPermissionRepository = new DocumentPermissionRepository(db)
  const documentAccessService = new DocumentAccessService(
    documentRepository,
    documentPermissionRepository,
    membershipRepository,
  )
  const documentPermissionService = new DocumentPermissionService(
    documentRepository,
    documentPermissionRepository,
    membershipRepository,
    documentAccessService,
    auditLogService,
  )
  const documentShareLinkRepository = new DocumentShareLinkRepository(db)
  const documentShareLinkSessionRepository = new DocumentShareLinkSessionRepository(db)
  const documentTagService = new DocumentTagService(new DocumentTagRepository(db), workspaceAccess)
  const externalCollaboratorRepository = new ExternalCollaboratorRepository(db)
  const shareLinkService = new ShareLinkService(
    documentRepository,
    documentShareLinkRepository,
    documentShareLinkSessionRepository,
    externalCollaboratorRepository,
    membershipRepository,
    documentRevisionRepository,
    auditLogService,
  )

  const documentService = new DocumentService(
    documentRepository,
    documentRevisionRepository,
    folderRepository,
    membershipRepository,
    workspaceAccess,
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

  // app.register(shareLinkRoutes, { prefix: '/api/v1/share-links' })
  // app.register(trashRoutes, { prefix: '/api/v1/trash' })
  app.register(blogRoutes, { prefix: '/api/v1/blog' })

  app.addHook('onRequest', async (request) => {
    request.db = db
    request.startTime = Date.now()
  })

  app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime ?? Date.now())
    app.log.info(
      { method: request.method, path: request.url, status: reply.statusCode, duration },
      'handled request',
    )
  })

  app.addHook('onClose', async () => {
    exportJobService.shutdown()
    if (!prisma) {
      await db.$disconnect()
    }
  })

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

  const createError = (statusCode: number, message: string) => {
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = statusCode
    return error
  }

  const requireAccountId = (request: FastifyRequest) => {
    const accountId = request.accountId
    if (!accountId) {
      throw createUnauthorized('Account missing')
    }
    return accountId
  }

  const documentStatusValues: Set<string> = new Set(Object.values(DocumentStatus))
  const documentVisibilityValues: Set<string> = new Set(Object.values(DocumentVisibility))
  const documentStatusArray = Object.values(DocumentStatus) as DocumentStatus[]
  const documentVisibilityArray = Object.values(DocumentVisibility) as DocumentVisibility[]

  const parseBoolean = (value?: string) => {
    if (value === undefined) return undefined
    return value === '1' || value.toLowerCase() === 'true'
  }

  const parseDocumentFilters = (query: Record<string, unknown>): DocumentListFilters => {
    const filters: DocumentListFilters = {}
    const folderId = typeof query.folderId === 'string' ? query.folderId : undefined
    const status = typeof query.status === 'string' && documentStatusValues.has(query.status) ? (query.status as DocumentStatus) : undefined
    const visibility =
      typeof query.visibility === 'string' && documentVisibilityValues.has(query.visibility)
        ? (query.visibility as DocumentVisibility)
        : undefined
    const search = typeof query.search === 'string' ? query.search.trim() : undefined
    const includeDeleted = typeof query.includeDeleted === 'string' ? parseBoolean(query.includeDeleted) : undefined
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined
    const sortOrder = typeof query.sortOrder === 'string' && (query.sortOrder === 'asc' || query.sortOrder === 'desc') ? query.sortOrder : undefined

    if (folderId !== undefined) filters.folderId = folderId
    if (status) filters.status = status
    if (visibility) filters.visibility = visibility
    if (search) filters.search = search
    if (includeDeleted !== undefined) filters.includeDeleted = includeDeleted
    if (sortBy) filters.sortBy = sortBy as any
    if (sortOrder) filters.sortOrder = sortOrder as any
    return filters
  }

  const searchRequestSchema = z.object({
    workspaceId: z.string().uuid(),
    folderId: z.string().uuid().nullable().optional(),
    status: z.enum(documentStatusArray as [DocumentStatus, ...DocumentStatus[]]).optional(),
    visibility: z.enum(documentVisibilityArray as [DocumentVisibility, ...DocumentVisibility[]]).optional(),
    search: z.string().trim().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
  })

  const activityRequestSchema = z.object({
    workspaceId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    entityType: z.string().optional(),
    action: z.string().optional(),
  })

  const exportRequestSchema = z.object({
    workspaceId: z.string().uuid(),
    documentId: z.string().uuid().optional(),
    format: z.enum(['pdf', 'md', 'html'] as const),
  })

  const parseQueryNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 1) {
      return parsed
    }
    return fallback
  }

  const loadDocumentWorkspace = async (documentId: string) => {
    const document = await documentRepository.findById(documentId)
    if (!document || document.deletedAt) {
      throw createError(404, 'Document not found')
    }
    return document
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof WorkspaceNotFoundError) {
      reply.status(404).send({ message: error.message })
      return
    }
    if (error instanceof MembershipAccessDeniedError) {
      reply.status(403).send({ message: error.message })
      return
    }
    if ((error as Error).name === 'DocumentNotFoundError' || (error as Error).name === 'FolderNotFoundError') {
      reply.status(404).send({ message: (error as Error).message })
      return
    }
    if ((error as Error).name === 'ShareLinkPasswordRequiredError') {
      reply.status(401).send({ message: (error as Error).message, code: 'PASSWORD_REQUIRED' })
      return
    }
    if (error instanceof z.ZodError) {
      reply.status(400).send({ message: 'Invalid query parameters', issues: error.issues })
      return
    }
    const statusCode = (error as { statusCode?: number; status?: number }).statusCode ?? (error as { status?: number }).status ?? 500
    reply.status(statusCode).send({ message: (error as Error)?.message ?? 'Internal server error' })
  })

  const emailSchema = z.object({ email: z.string().trim().email() })
  const transferSchema = z.object({ newOwnerAccountId: z.string().uuid() })
  const changeRoleSchema = z.object({ role: z.enum(['owner', 'admin', 'member']) })
  const invitationAcceptSchema = z.object({ token: z.string() })
  const joinRequestSchema = z.object({ message: z.string().max(500).optional() })

  app.post('/api/v1/auth/signup', async (request, reply) => {
    const account = await authService.signup(request.body as any)
    reply.status(201).send({
      id: account.id,
      email: account.email,
      status: account.status,
      preferredLocale: account.preferredLocale,
      preferredTimezone: account.preferredTimezone,
    })
  })

  app.post('/api/v1/auth/login', async (request, reply) => {
    const result = await authService.login(request.body as any)

    reply.setCookie('session_id', result.sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: result.expiresAt,
    })

    reply.send(result)
  })

  app.get('/api/v1/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const account = await accountRepository.findById(accountId)
    if (!account) {
      throw createError(404, 'Account not found')
    }
    reply.send({
      ...account,
      preferredTimezone: account.preferredTimezone ?? 'UTC',
    })
  })

  app.patch('/api/v1/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    await authService.updateAccount(accountId, request.body as any)
    const account = await accountRepository.findById(accountId)
    reply.send(account)
  })

  app.post('/api/v1/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    if (request.sessionId) {
      await authService.logout(request.sessionId)
    }
    reply.clearCookie('session_id', { path: '/' })
    reply.send({ ok: true })
  })

  app.post('/api/v1/auth/logout-all', { preHandler: authenticate }, async (request, reply) => {
    if (!request.accountId) {
      throw createUnauthorized('Account missing')
    }
    await authService.logoutAll(request.accountId)
    reply.send({ ok: true })
  })



  app.post('/api/v1/auth/password-reset/request', async (request, reply) => {
    const result = await authService.requestPasswordReset(request.body as any)
    reply.send(result)
  })

  app.post('/api/v1/auth/password-reset/confirm', async (request, reply) => {
    await authService.confirmPasswordReset(request.body as any)
    reply.send({ ok: true })
  })

  app.post('/api/v1/auth/delete', async (request, reply) => {
    await authService.deleteAccount(request.body as any)
    reply.send({ ok: true })
  })

  app.post('/api/v1/workspaces', { preHandler: authenticate }, async (request, reply) => {
    const ownerId = requireAccountId(request)
    const workspace = await workspaceService.create(ownerId, request.body as any)
    reply.status(201).send(workspace)
  })

  app.get('/api/v1/workspaces', { preHandler: authenticate }, async (request, reply) => {
    const ownerId = requireAccountId(request)
    const workspaces = await workspaceService.listOwned(ownerId)
    reply.send({ items: workspaces })
  })

  app.get('/api/v1/workspaces/:workspaceId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    await workspaceAccess.assertMember(accountId, workspaceId)
    const workspace = await workspaceService.getById(workspaceId)
    if (!workspace) {
      throw createError(404, 'Workspace not found')
    }
    reply.send(workspace)
  })

  app.patch('/api/v1/workspaces/:workspaceId', { preHandler: authenticate }, async (request, reply) => {
    const ownerId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const updated = await workspaceService.update(ownerId, workspaceId, request.body as any)
    reply.send(updated)
  })

  app.delete('/api/v1/workspaces/:workspaceId', { preHandler: authenticate }, async (request, reply) => {
    const ownerId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    await workspaceService.softDelete(ownerId, workspaceId)
    reply.status(204).send()
  })

  app.get('/api/v1/workspaces/:workspaceId/members', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const members = await membershipService.listMembers(accountId, workspaceId)
    reply.send({ items: members })
  })

  app.post('/api/v1/workspaces/:workspaceId/members', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const membership = await membershipService.addMember(accountId, workspaceId, request.body as any)
    reply.status(201).send(membership)
  })

  app.patch<{
    Params: { workspaceId: string; accountId: string }
    Body: { role?: 'owner' | 'admin' | 'member'; status?: 'active' | 'invited' | 'pending' | 'removed' }
  }>(
    '/api/v1/workspaces/:workspaceId/members/:accountId',
    { preHandler: [authenticate] },
    async (request) => {
      const { workspaceId, accountId } = request.params
      const { role, status } = request.body
      const requesterId = requireAccountId(request)
      const membership = await membershipService.updateMember(requesterId, workspaceId, accountId, {
        role,
        status,
      })
      return membership
    },
  )

  app.get<{
    Params: { workspaceId: string }
  }>(
    '/api/v1/workspaces/:workspaceId/members/me',
    { preHandler: [authenticate] },
    async (request) => {
      const { workspaceId } = request.params
      const accountId = requireAccountId(request)
      const membership = await membershipService.getMember(workspaceId, accountId)
      return membership
    },
  )

  app.patch<{
    Params: { workspaceId: string }
    Body: {
      displayName?: string
      avatarUrl?: string
      timezone?: string
      preferredLocale?: string
      blogTheme?: string
      blogHandle?: string
      blogDescription?: string
    }
  }>(
    '/api/v1/workspaces/:workspaceId/members/me',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.params
      const accountId = requireAccountId(request)

      // Validate blog handle if provided
      if (request.body.blogHandle !== undefined && request.body.blogHandle !== null) {
        const handle = request.body.blogHandle.trim()

        if (handle.length > 0) {
          // Check length
          if (handle.length < 4 || handle.length > 32) {
            return reply.status(400).send({
              error: 'Blog handle must be between 4 and 32 characters'
            })
          }

          // Check format (only lowercase letters, numbers, and hyphens)
          if (!/^[a-z0-9-]+$/.test(handle)) {
            return reply.status(400).send({
              error: 'Blog handle can only contain lowercase letters, numbers, and hyphens'
            })
          }

          // Check if it starts or ends with hyphen
          if (handle.startsWith('-') || handle.endsWith('-')) {
            return reply.status(400).send({
              error: 'Blog handle cannot start or end with a hyphen'
            })
          }

          // Check reserved words
          if (isReservedHandle(handle)) {
            return reply.status(400).send({
              error: 'This handle is reserved and cannot be used'
            })
          }
        }
      }

      const membership = await membershipService.updateMember(
        accountId,
        workspaceId,
        accountId,
        request.body,
      )
      return membership
    },
  )

  app.delete('/api/v1/workspaces/:workspaceId/members/:accountId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const targetAccountId = (request.params as { accountId: string }).accountId
    await membershipService.removeMember(accountId, workspaceId, targetAccountId)
    reply.status(204).send()
  })

  app.post('/api/v1/workspaces/:workspaceId/invitations', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const payload = emailSchema.parse(request.body)
    const result = await invitationService.sendInvitation(accountId, workspaceId, payload.email)
    reply.status(201).send(result)
  })

  app.post('/api/v1/invitations/accept', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const payload = invitationAcceptSchema.parse(request.body)
    await invitationService.acceptInvitation(payload.token, accountId)
    reply.send({ ok: true })
  })

  app.post('/api/v1/workspaces/:workspaceId/join-requests', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const result = await joinRequestService.requestJoin(accountId, workspaceId, joinRequestSchema.parse(request.body).message)
    reply.send(result)
  })

  app.post('/api/v1/workspaces/:workspaceId/join-requests/:requestId/approve', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const requestId = (request.params as { requestId: string }).requestId
    await joinRequestService.approve(accountId, workspaceId, requestId)
    reply.send({ ok: true })
  })

  app.post('/api/v1/workspaces/:workspaceId/join-requests/:requestId/deny', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const requestId = (request.params as { requestId: string }).requestId
    await joinRequestService.deny(accountId, workspaceId, requestId)
    reply.send({ ok: true })
  })

  app.post('/api/v1/workspaces/:workspaceId/transfer-ownership', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const newOwnerAccountId = transferSchema.parse(request.body).newOwnerAccountId
    await membershipService.transferOwnership(accountId, workspaceId, newOwnerAccountId)
    reply.send({ ok: true })
  })

  app.patch('/api/v1/workspaces/:workspaceId/members/:accountId/role', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const targetAccountId = (request.params as { accountId: string }).accountId
    const { role } = changeRoleSchema.parse(request.body)
    await membershipService.changeRole(accountId, workspaceId, targetAccountId, role)
    reply.send({ ok: true })
  })

  app.post('/api/v1/workspaces/:workspaceId/members/:accountId/leave', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const targetAccountId = (request.params as { accountId: string }).accountId
    if (targetAccountId !== accountId) {
      throw createError(403, 'Cannot leave on behalf of another member')
    }
    await membershipService.leaveWorkspace(accountId, workspaceId)
    reply.send({ ok: true })
  })

  const loadFolderWorkspaceId = async (folderId: string) => {
    const folder = await folderRepository.findById(folderId)
    if (!folder) {
      throw createError(404, 'Folder not found')
    }
    return folder.workspaceId
  }

  app.get('/api/v1/workspaces/:workspaceId/folders', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const query = request.query as any
    const includeDeleted = parseBoolean(typeof query.includeDeleted === 'string' ? query.includeDeleted : undefined)
    const folders = await folderService.listFolders(accountId, workspaceId, Boolean(includeDeleted))
    reply.send({ folders })
  })

  app.patch('/api/v1/documents/:documentId/starred', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const { isStarred } = request.body as { isStarred: boolean }
    const document = await documentService.toggleImportant(accountId, documentId, isStarred)
    reply.send(document)
  })

  app.patch('/api/v1/folders/:folderId/starred', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    const { isStarred } = request.body as { isStarred: boolean }
    const folder = await folderService.toggleImportant(accountId, workspaceId, folderId, isStarred)
    reply.send(folder)
  })

  app.post('/api/v1/workspaces/:workspaceId/folders', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const folder = await folderService.createFolder(accountId, workspaceId, request.body as any)
    reply.status(201).send(folder)
  })

  app.patch('/api/v1/folders/:folderId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    const folder = await folderService.updateFolder(accountId, workspaceId, folderId, request.body as any)
    reply.send(folder)
  })

  app.put('/api/v1/folders/:folderId/move', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    const folder = await folderService.moveFolder(accountId, workspaceId, folderId, request.body as any)
    reply.send(folder)
  })

  app.delete('/api/v1/folders/:folderId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    await folderService.deleteFolder(accountId, workspaceId, folderId)
    reply.status(204).send()
  })

  app.get('/api/v1/folders/:folderId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    const result = await folderService.getFolderWithAncestors(accountId, workspaceId, folderId)
    reply.send(result)
  })

  app.get('/api/v1/workspaces/:workspaceId/documents/check-title', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const { workspaceId } = request.params as { workspaceId: string }
    const { title, folderId, excludeId } = request.query as {
      title: string
      folderId?: string
      excludeId?: string
    }

    await workspaceAccess.assertMember(accountId, workspaceId)

    const docs = await documentRepository.listByWorkspace(workspaceId, {
      folderId: folderId || null,
    })

    const isDuplicate = docs.some((doc) => doc.title.toLowerCase() === title.toLowerCase() && doc.id !== excludeId)

    reply.send({ isDuplicate })
  })

  app.get('/api/v1/workspaces/:workspaceId/documents', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const filters = parseDocumentFilters(request.query as Record<string, unknown>)
    const documents = await documentService.listWorkspaceDocuments(accountId, workspaceId, filters)
    reply.send(documents)
  })

  app.get('/api/v1/workspaces/:workspaceId/documents/recent', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const query = request.query as any
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined
    const sortOrder = typeof query.sortOrder === 'string' && (query.sortOrder === 'asc' || query.sortOrder === 'desc') ? query.sortOrder : undefined

    await workspaceAccess.assertMember(accountId, workspaceId)
    const documents = await documentRepository.listRecentByWorkspaces([workspaceId], { limit: 50, sortBy, sortOrder })
    reply.send(documents)
  })

  app.post('/api/v1/workspaces/:workspaceId/documents', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const document = await documentService.createDocument(accountId, workspaceId, request.body as any)
    reply.status(201).send(document)
  })

  app.patch('/api/v1/documents/:documentId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const updated = await documentService.updateDocument(accountId, document.workspaceId, documentId, request.body as any)
    reply.send(updated)
  })

  app.delete('/api/v1/documents/:documentId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    await documentService.softDelete(accountId, documentId)
    reply.status(204).send()
  })

  // Trash management endpoints
  app.get('/api/v1/workspaces/:workspaceId/trash', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const query = request.query as any
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined
    const sortOrder = typeof query.sortOrder === 'string' && (query.sortOrder === 'asc' || query.sortOrder === 'desc') ? query.sortOrder : undefined

    const [documents, folders] = await Promise.all([
      documentService.listTrashed(accountId, workspaceId, { sortBy, sortOrder }),
      folderService.listTrashed(accountId, workspaceId, { sortBy, sortOrder })
    ])
    reply.send({ documents, folders })
  })

  app.post('/api/v1/trash/restore/document/:documentId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await documentService.restoreDocument(accountId, documentId)
    reply.send(document)
  })

  app.delete('/api/v1/trash/document/:documentId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    await documentService.permanentlyDeleteDocument(accountId, documentId)
    reply.status(204).send()
  })

  app.post('/api/v1/trash/restore/folder/:folderId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const folder = await folderService.restoreFolder(accountId, folderId)
    reply.send(folder)
  })

  app.delete('/api/v1/trash/folder/:folderId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    await folderService.permanentlyDeleteFolder(accountId, folderId)
    reply.status(204).send()
  })


  app.post('/api/v1/documents/:documentId/tags', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    try {
      const tag = await documentTagService.addTag(accountId, document.workspaceId, documentId, request.body)
      reply.status(201).send(tag)
    } catch (error) {
      if (error instanceof DocumentTagAlreadyExistsError) {
        throw createError(409, error.message)
      }
      throw error
    }
  })

  app.delete('/api/v1/documents/:documentId/tags/:tagName', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const tagName = decodeURIComponent((request.params as { tagName: string }).tagName)
    const document = await loadDocumentWorkspace(documentId)
    try {
      await documentTagService.removeTag(accountId, document.workspaceId, documentId, tagName)
      reply.status(204).send()
    } catch (error) {
      if (error instanceof DocumentTagNotFoundError) {
        throw createError(404, error.message)
      }
      throw error
    }
  })

  app.get('/api/v1/documents/recent', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const query = request.query as any
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined
    const sortOrder = typeof query.sortOrder === 'string' && (query.sortOrder === 'asc' || query.sortOrder === 'desc') ? query.sortOrder : undefined
    const documents = await documentService.listRecentDocuments(accountId, { sortBy, sortOrder })
    reply.send({ items: documents })
  })

  app.get('/api/v1/documents/:documentId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    await documentAccessService.assertCanView(accountId, document.workspaceId, documentId)
    reply.send(document)
  })

  app.post('/api/v1/documents/:documentId/revisions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    await loadDocumentWorkspace(documentId)
    const revision = await documentService.appendRevision(accountId, documentId, request.body as any)
    reply.status(201).send(revision)
  })



  app.post('/api/v1/folders/:folderId/tags', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    const { name } = request.body as { name: string }
    const tag = await folderService.addTag(accountId, workspaceId, folderId, name)
    reply.status(201).send(tag)
  })

  app.delete('/api/v1/folders/:folderId/tags/:tagName', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    const tagName = decodeURIComponent((request.params as { tagName: string }).tagName)
    await folderService.removeTag(accountId, workspaceId, folderId, tagName)
    reply.status(204).send()
  })

  app.get('/api/v1/workspaces/:workspaceId/starred', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId

    // We reuse listByWorkspace but filter by isImportant
    // But listByWorkspace in DocumentRepository and FolderRepository needs to support isImportant filter
    // I already added isImportant to filters in repositories.

    const [documents, folders] = await Promise.all([
      documentService.listWorkspaceDocuments(accountId, workspaceId, { isImportant: true }),
      folderService.listFolders(accountId, workspaceId, false) // Need to filter folders by isImportant
    ])

    // Wait, folderService.listFolders calls folderRepository.listByWorkspace.
    // I updated folderRepository.listByWorkspace to accept options including isImportant.
    // But folderService.listFolders only accepts includeDeleted.
    // I need to update folderService.listFolders to accept options.

    // Let's fix folderService.listFolders first or just use repository directly here? 
    // Better to update service.

    // For now, I will filter in memory or update service in next step if I can't do it here.
    // Actually, I can update folderService.listFolders signature in the previous step or now.
    // I'll assume I'll update it.

    // Re-reading my changes to folderService.ts:
    // I did NOT update listFolders signature in folderService.ts.
    // I only updated folderRepository.ts.

    // So I need to update FolderService.listFolders as well.

    reply.send({ documents: documents.documents, folders: folders.filter(f => f.isImportant) })
  })

  app.get('/api/v1/workspaces/:workspaceId/public-documents', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const query = request.query as any
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined
    const sortOrder = typeof query.sortOrder === 'string' && (query.sortOrder === 'asc' || query.sortOrder === 'desc') ? query.sortOrder : undefined

    await workspaceAccess.assertMember(accountId, workspaceId)

    // Fetch documents with visibility='public'
    const result = await documentService.listWorkspaceDocuments(accountId, workspaceId, {
      visibility: 'public',
      sortBy,
      sortOrder
    })

    reply.send({ items: result.documents })
  })

  app.get('/api/v1/documents/:documentId/revisions/latest', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    await loadDocumentWorkspace(documentId)
    const latest = await documentService.getLatestRevision(accountId, documentId)
    reply.send(latest)
  })

  app.get('/api/v1/documents/:documentId/permissions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const permissions = await documentPermissionService.listPermissions(accountId, document.workspaceId, documentId)
    reply.send(permissions)
  })

  app.post('/api/v1/documents/:documentId/permissions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const permission = await documentPermissionService.grantPermission(accountId, document.workspaceId, documentId, request.body)
    reply.status(201).send(permission)
  })

  app.delete('/api/v1/documents/:documentId/permissions/:permissionId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const permissionId = (request.params as { permissionId: string }).permissionId
    const document = await loadDocumentWorkspace(documentId)
    await documentPermissionService.revokePermission(accountId, document.workspaceId, documentId, permissionId)
    reply.status(204).send()
  })

  app.patch('/api/v1/documents/:documentId/workspace-access', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const updated = await documentPermissionService.updateWorkspaceAccess(accountId, document.workspaceId, documentId, request.body)
    reply.send(updated)
  })

  app.get('/api/v1/documents/:documentId/permissions/summary', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const summary = await documentPermissionService.getSummary(accountId, document.workspaceId, documentId)
    reply.send(summary)
  })

  app.get('/api/v1/documents/:documentId/share-links', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const shareLinks = await shareLinkService.list(accountId, document.workspaceId, documentId)
    reply.send({ shareLinks })
  })

  app.get('/api/v1/documents/:documentId/download', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)

    // Check access
    await documentAccessService.assertCanView(accountId, document.workspaceId, documentId)

    const revision = await documentRevisionRepository.findLatest(documentId)
    if (!revision) {
      throw createError(404, 'Document content not found')
    }

    const filename = encodeURIComponent(`${document.title}.odocs`)

    reply.header('Content-Type', 'application/vnd.odocs')
    reply.header('Content-Disposition', `attachment; filename = "${filename}"; filename *= UTF - 8''${filename} `)
    reply.send(JSON.stringify(revision.content))
  })

  app.post('/api/v1/documents/:documentId/share-links', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const result = await shareLinkService.create(accountId, document.workspaceId, documentId, request.body)
    reply.status(201).send(result)
  })

  app.delete('/api/v1/share-links/:shareLinkId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const shareLinkId = (request.params as { shareLinkId: string }).shareLinkId
    const shareLink = await documentShareLinkRepository.findById(shareLinkId)
    if (!shareLink || shareLink.revokedAt) {
      throw createError(404, 'Share link not found')
    }
    const document = await loadDocumentWorkspace(shareLink.documentId)
    await shareLinkService.revoke(accountId, document.workspaceId, shareLinkId)
    reply.status(204).send()
  })

  app.patch('/api/v1/share-links/:shareLinkId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const shareLinkId = (request.params as { shareLinkId: string }).shareLinkId
    const shareLink = await documentShareLinkRepository.findById(shareLinkId)
    if (!shareLink || shareLink.revokedAt) {
      throw createError(404, 'Share link not found')
    }
    const document = await loadDocumentWorkspace(shareLink.documentId)
    const updated = await shareLinkService.updateOptions(accountId, document.workspaceId, shareLinkId, request.body)
    reply.send(updated)
  })

  app.delete('/api/v1/share-links/:shareLinkId/guest-sessions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const shareLinkId = (request.params as { shareLinkId: string }).shareLinkId
    const shareLink = await documentShareLinkRepository.findById(shareLinkId)
    if (!shareLink || shareLink.revokedAt) {
      throw createError(404, 'Share link not found')
    }
    const document = await loadDocumentWorkspace(shareLink.documentId)
    await shareLinkService.revokeGuestSessions(accountId, document.workspaceId, shareLinkId)
    reply.status(204).send()
  })

  app.post('/api/v1/share-links/:token/access', async (request, reply) => {
    const token = (request.params as { token: string }).token
    console.log(`[Debug] Resolving share token: ${token} `)
    try {
      const payload = await shareLinkService.resolveToken(token, request.body)
      console.log(`[Debug] Token resolved successfully for document: ${payload.document.id} `)
      reply.send(payload)
    } catch (err) {
      console.error(`[Debug] Failed to resolve token: ${token} `, err)
      throw err
    }
  })

  app.get('/api/v1/share-links/:token/author/documents', async (request, reply) => {
    const token = (request.params as { token: string }).token
    try {
      const documents = await shareLinkService.getAuthorPublicDocuments(token)
      reply.send({ documents })
    } catch (err) {
      console.error(`[Debug] Failed to fetch author documents for token: ${token} `, err)
      throw err
    }
  })

  app.post('/api/v1/share-links/:token/accept', async (request, reply) => {
    const token = (request.params as { token: string }).token
    const result = await shareLinkService.acceptGuest(token, request.body)
    reply.send(result)
  })

  app.post('/api/v1/search', { preHandler: authenticate }, async (request, reply) => {
    const payload = searchRequestSchema.parse(request.body)
    const accountId = requireAccountId(request)
    await workspaceAccess.assertMember(accountId, payload.workspaceId)
    const filters: DocumentListFilters = {}
    if (payload.folderId !== undefined) filters.folderId = payload.folderId
    if (payload.status) filters.status = payload.status
    if (payload.visibility) filters.visibility = payload.visibility
    if (payload.search) filters.search = payload.search
    const { documents } = await documentService.listWorkspaceDocuments(accountId, payload.workspaceId, filters)
    const page = payload.page
    const pageSize = payload.pageSize
    const start = (page - 1) * pageSize
    const slice = documents.slice(start, start + pageSize)
    reply.send({
      documents: slice,
      page,
      pageSize,
      total: documents.length,
      hasNextPage: start + pageSize < documents.length,
    })
  })

  app.get('/api/v1/workspaces/:workspaceId/activity-feed', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const requestQuery = request.query as any
    const payload = activityRequestSchema.parse({
      workspaceId,
      page: parseQueryNumber(requestQuery.page, 1),
      pageSize: parseQueryNumber(requestQuery.pageSize, 25),
      from: typeof requestQuery.from === 'string' ? requestQuery.from : undefined,
      to: typeof requestQuery.to === 'string' ? requestQuery.to : undefined,
      entityType: typeof requestQuery.entityType === 'string' ? requestQuery.entityType : undefined,
      action: typeof requestQuery.action === 'string' ? requestQuery.action : undefined,
    })
    await workspaceAccess.assertMember(accountId, workspaceId)
    const query = {
      workspaceId,
      page: payload.page,
      pageSize: payload.pageSize,
      from: payload.from ? new Date(payload.from) : undefined,
      to: payload.to ? new Date(payload.to) : undefined,
      entityTypes: payload.entityType ? payload.entityType.split(',').map((value) => value.trim()).filter(Boolean) : undefined,
      action: payload.action,
    }
    const logs = await auditLogRepository.list(query)
    reply.send(logs)
  })

  app.post('/api/v1/export', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const payload = exportRequestSchema.parse(request.body)
    const job = await exportJobService.createJob(accountId, payload)
    reply.status(201).send(job)
  })

  app.get('/api/v1/export/:jobId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const jobId = (request.params as { jobId: string }).jobId
    const job = await exportJobService.getJob(jobId)
    if (!job) {
      throw createError(404, 'Export job not found')
    }
    await workspaceAccess.assertMember(accountId, job.workspaceId)
    reply.send(job)
  })

  app.get('/api/v1/export/:jobId/result', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const jobId = (request.params as { jobId: string }).jobId
    try {
      const url = await exportJobService.getJobResult(accountId, jobId)
      reply.send({ resultUrl: url })
    } catch (error) {
      if (error instanceof ExportJobNotReadyError) {
        return reply.status(400).send({ message: error.message })
      }
      throw error
    }
  })

  app.post('/api/v1/export/:jobId/cancel', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const jobId = (request.params as { jobId: string }).jobId
    await exportJobService.cancelJob(accountId, jobId)
    reply.send({ ok: true })
  })

  app.post('/api/v1/export/:jobId/retry', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const jobId = (request.params as { jobId: string }).jobId
    try {
      await exportJobService.retryJob(accountId, jobId)
      reply.send({ ok: true })
    } catch (error) {
      if (
        error instanceof ExportJobRetryNotAllowedError ||
        error instanceof ExportJobRetryLimitExceededError
      ) {
        return reply.status(400).send({ message: error.message })
      }
      throw error
    }
  })

  app.get('/api/v1/workspaces/:workspaceId/audit', { preHandler: authenticate }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string }
    const accountId = request.accountId
    if (!accountId) {
      throw createUnauthorized('Account id missing')
    }
    const logs = await workspaceAuditService.list(accountId, workspaceId, request.query)
    reply.send(logs)
  })

  return app
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await buildServer()
  const PORT = Number(process.env.PORT ?? 4000)
  await server.listen({ port: PORT, host: '0.0.0.0' })
}
