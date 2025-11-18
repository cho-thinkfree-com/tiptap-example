import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { z } from 'zod'
import { DocumentStatus, DocumentVisibility } from '@prisma/client'
import { createPrismaClient, type DatabaseClient } from './lib/prismaClient'
import { PrismaAccountRepository } from './modules/accounts/accountRepository'
import { AccountService } from './modules/accounts/accountService'
import { AuthService } from './modules/auth/authService'
import { PrismaSessionRepository } from './modules/auth/sessionRepository'
import { PrismaPasswordResetRepository } from './modules/auth/passwordResetRepository'
import { AuditLogRepository } from './modules/audit/auditLogRepository'
import { AuditLogService } from './modules/audit/auditLogService'
import { WorkspaceAuditService } from './modules/audit/workspaceAuditService'
import { WorkspaceRepository } from './modules/workspaces/workspaceRepository'
import { MembershipRepository } from './modules/workspaces/membershipRepository'
import { MembershipAccessDeniedError, MembershipService } from './modules/workspaces/membershipService'
import { WorkspaceNotFoundError } from './modules/workspaces/workspaceService'
import { WorkspaceService } from './modules/workspaces/workspaceService'
import { WorkspaceAccessService } from './modules/workspaces/workspaceAccess'
import { InvitationRepository } from './modules/workspaces/invitationRepository'
import { WorkspaceInvitationService } from './modules/workspaces/invitationService'
import { JoinRequestRepository } from './modules/workspaces/joinRequestRepository'
import { WorkspaceJoinRequestService } from './modules/workspaces/joinRequestService'
import { DocumentRepository, type DocumentListFilters } from './modules/documents/documentRepository'
import { DocumentRevisionRepository } from './modules/documents/documentRevisionRepository'
import { FolderRepository } from './modules/documents/folderRepository'
import { FolderService } from './modules/documents/folderService'
import { DocumentService } from './modules/documents/documentService'
import { DocumentPermissionRepository } from './modules/documents/documentPermissionRepository'
import { DocumentAccessService } from './modules/documents/documentAccessService'
import { DocumentPermissionService } from './modules/documents/documentPermissionService'
import { ShareLinkService } from './modules/documents/shareLinkService'
import { DocumentShareLinkRepository } from './modules/documents/documentShareLinkRepository'
import { DocumentShareLinkSessionRepository } from './modules/documents/documentShareLinkSessionRepository'
import { ExternalCollaboratorRepository } from './modules/documents/externalCollaboratorRepository'
import { ExportJobRepository } from './modules/export/exportJobRepository'
import { ExportJobService } from './modules/export/exportJobService'

export interface ServerOptions {
  prisma?: DatabaseClient
  logger?: boolean
}

export const buildServer = ({ prisma, logger = true }: ServerOptions = {}) => {
  const db = prisma ?? createPrismaClient()
  const app: FastifyInstance = Fastify({ logger: logger ? ['error', 'warn'] : false })

  app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'docs/api/openapi'),
    prefix: '/api/openapi/',
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
  const workspaceService = new WorkspaceService(workspaceRepository)
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
  const workspaceAccessService = new WorkspaceAccessService(workspaceRepository, membershipRepository)

  const documentRepository = new DocumentRepository(db)
  const documentRevisionRepository = new DocumentRevisionRepository(db)
  const folderRepository = new FolderRepository(db)
  const folderService = new FolderService(folderRepository, workspaceAccessService, documentRepository)
  const documentService = new DocumentService(
    documentRepository,
    documentRevisionRepository,
    folderRepository,
    membershipRepository,
    workspaceAccessService,
  )
  const documentPermissionRepository = new DocumentPermissionRepository(db)
  const documentAccessService = new DocumentAccessService(documentRepository, documentPermissionRepository, membershipRepository)
  const documentPermissionService = new DocumentPermissionService(
    documentRepository,
    documentPermissionRepository,
    membershipRepository,
    documentAccessService,
    auditLogService,
  )
  const documentShareLinkRepository = new DocumentShareLinkRepository(db)
  const documentShareLinkSessionRepository = new DocumentShareLinkSessionRepository(db)
  const externalCollaboratorRepository = new ExternalCollaboratorRepository(db)
  const shareLinkService = new ShareLinkService(
    documentRepository,
    documentShareLinkRepository,
    documentShareLinkSessionRepository,
    externalCollaboratorRepository,
    membershipRepository,
    documentAccessService,
    auditLogService,
  )

  const exportJobRepository = new ExportJobRepository(db)
  const exportJobService = new ExportJobService(
    exportJobRepository,
    membershipRepository,
    workspaceAccessService,
    auditLogService,
  )

  const workspaceAuditService = new WorkspaceAuditService(
    workspaceRepository,
    membershipRepository,
    auditLogService,
  )

  app.addHook('onRequest', async (request) => {
    request.db = db
    request.startTime = Date.now()
  })

  app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime ?? Date.now())
    app.log.info(
      { method: request.method, path: request.routerPath ?? request.url, status: reply.statusCode, duration },
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
    const authorization = request.headers.authorization
    if (!authorization?.startsWith('Bearer ')) {
      throw createUnauthorized('Missing access token')
    }
    const token = authorization.slice('Bearer '.length).trim()
    if (!token) {
      throw createUnauthorized('Missing access token')
    }
    const session = await db.session.findFirst({
      where: {
        accessToken: token,
        revokedAt: null,
        accessExpiresAt: {
          gte: new Date(),
        },
      },
    })
    if (!session) {
      throw createUnauthorized('Invalid or expired session')
    }
    request.accountId = session.accountId
    request.sessionId = session.id
  }

  const requireAccountId = (request: FastifyRequest) => {
    const accountId = request.accountId
    if (!accountId) {
      throw app.httpErrors.unauthorized('Account missing')
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
    if (folderId !== undefined) filters.folderId = folderId
    if (status) filters.status = status
    if (visibility) filters.visibility = visibility
    if (search) filters.search = search
    if (includeDeleted !== undefined) filters.includeDeleted = includeDeleted
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
      throw app.httpErrors.notFound('Document not found')
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
    if (error instanceof z.ZodError) {
      reply.status(400).send({ message: 'Invalid query parameters', issues: error.issues })
      return
    }
    const statusCode = (error as { statusCode?: number; status?: number }).statusCode ?? (error as { status?: number }).status ?? 500
    reply.status(statusCode).send({ message: error?.message ?? 'Internal server error' })
  })

  const emailSchema = z.object({ email: z.string().trim().email() })
  const transferSchema = z.object({ newOwnerAccountId: z.string().uuid() })
  const changeRoleSchema = z.object({ role: z.enum(['owner', 'admin', 'member']) })
  const invitationAcceptSchema = z.object({ token: z.string() })
  const joinRequestSchema = z.object({ message: z.string().max(500).optional() })

  app.post('/api/auth/signup', async (request, reply) => {
    const account = await authService.signup(request.body as unknown as { email: string })
    reply.status(201).send({ id: account.id, email: account.email, status: account.status })
  })

  app.post('/api/auth/login', async (request, reply) => {
    const tokens = await authService.login(request.body as unknown)
    reply.send(tokens)
  })

  app.post('/api/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    if (!request.sessionId) {
      throw app.httpErrors.unauthorized('Session missing')
    }
    await authService.logout(request.sessionId)
    reply.send({ ok: true })
  })

  app.post('/api/auth/logout-all', { preHandler: authenticate }, async (request, reply) => {
    if (!request.accountId) {
      throw app.httpErrors.unauthorized('Account missing')
    }
    await authService.logoutAll(request.accountId)
    reply.send({ ok: true })
  })

  app.post('/api/auth/refresh', async (request, reply) => {
    const tokens = await authService.refresh(request.body as unknown)
    reply.send(tokens)
  })

  app.post('/api/auth/password-reset/request', async (request, reply) => {
    const result = await authService.requestPasswordReset(request.body as unknown)
    reply.send(result)
  })

  app.post('/api/auth/password-reset/confirm', async (request, reply) => {
    await authService.confirmPasswordReset(request.body as unknown)
    reply.send({ ok: true })
  })

  app.post('/api/auth/delete', async (request, reply) => {
    await authService.deleteAccount(request.body as unknown)
    reply.send({ ok: true })
  })

  app.post('/api/workspaces', { preHandler: authenticate }, async (request, reply) => {
    const ownerId = requireAccountId(request)
    const workspace = await workspaceService.create(ownerId, request.body as unknown)
    reply.status(201).send(workspace)
  })

  app.get('/api/workspaces', { preHandler: authenticate }, async (request, reply) => {
    const ownerId = requireAccountId(request)
    const workspaces = await workspaceService.listOwned(ownerId)
    reply.send({ items: workspaces })
  })

  app.get('/api/workspaces/:workspaceId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    await workspaceAccessService.assertOwner(accountId, workspaceId)
    const workspace = await workspaceService.getById(workspaceId)
    if (!workspace) {
      throw app.httpErrors.notFound()
    }
    reply.send(workspace)
  })

  app.patch('/api/workspaces/:workspaceId', { preHandler: authenticate }, async (request, reply) => {
    const ownerId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const updated = await workspaceService.update(ownerId, workspaceId, request.body as unknown)
    reply.send(updated)
  })

  app.delete('/api/workspaces/:workspaceId', { preHandler: authenticate }, async (request, reply) => {
    const ownerId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    await workspaceService.softDelete(ownerId, workspaceId)
    reply.status(204).send()
  })

  app.get('/api/workspaces/:workspaceId/members', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const members = await membershipService.listMembers(accountId, workspaceId)
    reply.send({ items: members })
  })

  app.post('/api/workspaces/:workspaceId/members', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const membership = await membershipService.addMember(accountId, workspaceId, request.body as unknown)
    reply.status(201).send(membership)
  })

  app.patch('/api/workspaces/:workspaceId/members/:accountId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const targetAccountId = (request.params as { accountId: string }).accountId
    const updated = await membershipService.updateMember(accountId, workspaceId, targetAccountId, request.body as unknown)
    reply.send(updated)
  })

  app.delete('/api/workspaces/:workspaceId/members/:accountId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const targetAccountId = (request.params as { accountId: string }).accountId
    await membershipService.removeMember(accountId, workspaceId, targetAccountId)
    reply.status(204).send()
  })

  app.post('/api/workspaces/:workspaceId/invitations', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const payload = emailSchema.parse(request.body)
    const result = await invitationService.sendInvitation(accountId, workspaceId, payload.email)
    reply.status(201).send(result)
  })

  app.post('/api/invitations/accept', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const token = (request.body as { token: string }).token
    const payload = invitationAcceptSchema.parse(request.body)
    await invitationService.acceptInvitation(payload.token, accountId)
    reply.send({ ok: true })
  })

  app.post('/api/workspaces/:workspaceId/join-requests', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const result = await joinRequestService.requestJoin(accountId, workspaceId, joinRequestSchema.parse(request.body).message)
    reply.send(result)
  })

  app.post('/api/workspaces/:workspaceId/join-requests/:requestId/approve', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const requestId = (request.params as { requestId: string }).requestId
    await joinRequestService.approve(accountId, workspaceId, requestId)
    reply.send({ ok: true })
  })

  app.post('/api/workspaces/:workspaceId/join-requests/:requestId/deny', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const requestId = (request.params as { requestId: string }).requestId
    await joinRequestService.deny(accountId, workspaceId, requestId)
    reply.send({ ok: true })
  })

  app.post('/api/workspaces/:workspaceId/transfer-ownership', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const newOwnerAccountId = transferSchema.parse(request.body).newOwnerAccountId
    await membershipService.transferOwnership(accountId, workspaceId, newOwnerAccountId)
    reply.send({ ok: true })
  })

  app.patch('/api/workspaces/:workspaceId/members/:accountId/role', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const targetAccountId = (request.params as { accountId: string }).accountId
    const { role } = changeRoleSchema.parse(request.body)
    await membershipService.changeRole(accountId, workspaceId, targetAccountId, role)
    reply.send({ ok: true })
  })

  app.post('/api/workspaces/:workspaceId/members/:accountId/leave', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const targetAccountId = (request.params as { accountId: string }).accountId
    if (targetAccountId !== accountId) {
      throw app.httpErrors.forbidden('Cannot leave on behalf of another member')
    }
    await membershipService.leaveWorkspace(accountId, workspaceId)
    reply.send({ ok: true })
  })

  const loadFolderWorkspaceId = async (folderId: string) => {
    const folder = await folderRepository.findById(folderId)
    if (!folder) {
      throw app.httpErrors.notFound('Folder not found')
    }
    return folder.workspaceId
  }

  app.get('/api/workspaces/:workspaceId/folders', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const includeDeleted = parseBoolean(typeof request.query.includeDeleted === 'string' ? request.query.includeDeleted : undefined)
    const folders = await folderService.listFolders(accountId, workspaceId, Boolean(includeDeleted))
    reply.send({ folders })
  })

  app.post('/api/workspaces/:workspaceId/folders', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const folder = await folderService.createFolder(accountId, workspaceId, request.body)
    reply.status(201).send(folder)
  })

  app.patch('/api/folders/:folderId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    const updated = await folderService.updateFolder(accountId, workspaceId, folderId, request.body)
    reply.send(updated)
  })

  app.post('/api/folders/:folderId/move', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    const moved = await folderService.moveFolder(accountId, workspaceId, folderId, request.body)
    reply.send(moved)
  })

  app.delete('/api/folders/:folderId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const folderId = (request.params as { folderId: string }).folderId
    const workspaceId = await loadFolderWorkspaceId(folderId)
    await folderService.deleteFolder(accountId, workspaceId, folderId)
    reply.status(204).send()
  })

  app.get('/api/workspaces/:workspaceId/documents', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const filters = parseDocumentFilters(request.query as Record<string, unknown>)
    const documents = await documentService.listWorkspaceDocuments(accountId, workspaceId, filters)
    reply.send(documents)
  })

  app.post('/api/workspaces/:workspaceId/documents', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const document = await documentService.createDocument(accountId, workspaceId, request.body)
    reply.status(201).send(document)
  })

  app.get('/api/documents/:documentId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    await documentAccessService.assertCanView(accountId, document.workspaceId, documentId)
    reply.send(document)
  })

  app.patch('/api/documents/:documentId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const updated = await documentService.updateDocument(accountId, document.workspaceId, documentId, request.body)
    reply.send(updated)
  })

  app.post('/api/documents/:documentId/revisions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const revision = await documentService.appendRevision(accountId, documentId, request.body)
    reply.status(201).send(revision)
  })

  app.get('/api/documents/:documentId/revisions/latest', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const latest = await documentService.getLatestRevision(accountId, documentId)
    reply.send(latest)
  })

  app.get('/api/documents/:documentId/permissions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const permissions = await documentPermissionService.listPermissions(accountId, document.workspaceId, documentId)
    reply.send(permissions)
  })

  app.post('/api/documents/:documentId/permissions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const permission = await documentPermissionService.grantPermission(accountId, document.workspaceId, documentId, request.body)
    reply.status(201).send(permission)
  })

  app.delete('/api/documents/:documentId/permissions/:permissionId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const permissionId = (request.params as { permissionId: string }).permissionId
    const document = await loadDocumentWorkspace(documentId)
    await documentPermissionService.revokePermission(accountId, document.workspaceId, documentId, permissionId)
    reply.status(204).send()
  })

  app.patch('/api/documents/:documentId/workspace-access', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const updated = await documentPermissionService.updateWorkspaceAccess(accountId, document.workspaceId, documentId, request.body)
    reply.send(updated)
  })

  app.get('/api/documents/:documentId/permissions/summary', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const summary = await documentPermissionService.getSummary(accountId, document.workspaceId, documentId)
    reply.send(summary)
  })

  app.get('/api/documents/:documentId/share-links', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const shareLinks = await shareLinkService.list(accountId, document.workspaceId, documentId)
    reply.send({ shareLinks })
  })

  app.post('/api/documents/:documentId/share-links', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const documentId = (request.params as { documentId: string }).documentId
    const document = await loadDocumentWorkspace(documentId)
    const result = await shareLinkService.create(accountId, document.workspaceId, documentId, request.body)
    reply.status(201).send(result)
  })

  app.delete('/api/share-links/:shareLinkId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const shareLinkId = (request.params as { shareLinkId: string }).shareLinkId
    const shareLink = await documentShareLinkRepository.findById(shareLinkId)
    if (!shareLink || shareLink.revokedAt) {
      throw app.httpErrors.notFound('Share link not found')
    }
    const document = await loadDocumentWorkspace(shareLink.documentId)
    await shareLinkService.revoke(accountId, document.workspaceId, shareLinkId)
    reply.status(204).send()
  })

  app.patch('/api/share-links/:shareLinkId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const shareLinkId = (request.params as { shareLinkId: string }).shareLinkId
    const shareLink = await documentShareLinkRepository.findById(shareLinkId)
    if (!shareLink || shareLink.revokedAt) {
      throw app.httpErrors.notFound('Share link not found')
    }
    const document = await loadDocumentWorkspace(shareLink.documentId)
    const updated = await shareLinkService.updateOptions(accountId, document.workspaceId, shareLinkId, request.body)
    reply.send(updated)
  })

  app.delete('/api/share-links/:shareLinkId/guest-sessions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const shareLinkId = (request.params as { shareLinkId: string }).shareLinkId
    const shareLink = await documentShareLinkRepository.findById(shareLinkId)
    if (!shareLink || shareLink.revokedAt) {
      throw app.httpErrors.notFound('Share link not found')
    }
    const document = await loadDocumentWorkspace(shareLink.documentId)
    await shareLinkService.revokeGuestSessions(accountId, document.workspaceId, shareLinkId)
    reply.status(204).send()
  })

  app.post('/api/share-links/:token/access', async (request, reply) => {
    const payload = await shareLinkService.resolveToken((request.params as { token: string }).token, request.body)
    reply.send(payload)
  })

  app.post('/api/share-links/:token/accept', async (request, reply) => {
    const token = (request.params as { token: string }).token
    const result = await shareLinkService.acceptGuest(token, request.body)
    reply.send(result)
  })

  app.post('/api/search', { preHandler: authenticate }, async (request, reply) => {
    const payload = searchRequestSchema.parse(request.body)
    const accountId = requireAccountId(request)
    await workspaceAccessService.assertMember(accountId, payload.workspaceId)
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

  app.get('/api/workspaces/:workspaceId/activity-feed', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const workspaceId = (request.params as { workspaceId: string }).workspaceId
    const payload = activityRequestSchema.parse({
      workspaceId,
      page: parseQueryNumber(request.query.page, 1),
      pageSize: parseQueryNumber(request.query.pageSize, 25),
      from: typeof request.query.from === 'string' ? request.query.from : undefined,
      to: typeof request.query.to === 'string' ? request.query.to : undefined,
      entityType: typeof request.query.entityType === 'string' ? request.query.entityType : undefined,
      action: typeof request.query.action === 'string' ? request.query.action : undefined,
    })
    await workspaceAccessService.assertMember(accountId, workspaceId)
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

  app.post('/api/export', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const payload = exportRequestSchema.parse(request.body)
    const job = await exportJobService.createJob(accountId, payload)
    reply.status(201).send(job)
  })

  app.get('/api/export/:jobId', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const jobId = (request.params as { jobId: string }).jobId
    const job = await exportJobService.getJob(jobId)
    if (!job) {
      throw app.httpErrors.notFound('Export job not found')
    }
    await workspaceAccessService.assertMember(accountId, job.workspaceId)
    reply.send(job)
  })

  app.post('/api/export/:jobId/cancel', { preHandler: authenticate }, async (request, reply) => {
    const accountId = requireAccountId(request)
    const jobId = (request.params as { jobId: string }).jobId
    await exportJobService.cancelJob(accountId, jobId)
    reply.send({ ok: true })
  })

  app.get('/api/workspaces/:workspaceId/audit', { preHandler: authenticate }, async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string }
    const accountId = request.accountId
    if (!accountId) {
      throw app.httpErrors.unauthorized('Account id missing')
    }
    const logs = await workspaceAuditService.list(accountId, workspaceId, request.query)
    reply.send(logs)
  })

  return app
}

if (import.meta.main) {
  const server = buildServer()
  const PORT = Number(process.env.PORT ?? 4000)
  await server.listen({ port: PORT, host: '0.0.0.0' })
}
