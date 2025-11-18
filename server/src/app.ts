import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { z } from 'zod'
import { createPrismaClient, type DatabaseClient } from './lib/prismaClient'
import { AuditLogRepository } from './modules/audit/auditLogRepository'
import { AuditLogService } from './modules/audit/auditLogService'
import { WorkspaceAuditService } from './modules/audit/workspaceAuditService'
import { WorkspaceRepository } from './modules/workspaces/workspaceRepository'
import { MembershipRepository } from './modules/workspaces/membershipRepository'
import { MembershipAccessDeniedError } from './modules/workspaces/membershipService'
import { WorkspaceNotFoundError } from './modules/workspaces/workspaceService'

export interface ServerOptions {
  prisma?: DatabaseClient
  logger?: boolean
}

export const buildServer = ({ prisma, logger = true }: ServerOptions = {}) => {
  const db = prisma ?? createPrismaClient()
  const app: FastifyInstance = Fastify({ logger: logger ? ['error', 'warn'] : false })

  const auditLogRepository = new AuditLogRepository(db)
  const auditLogService = new AuditLogService(auditLogRepository)
  const workspaceAuditService = new WorkspaceAuditService(
    new WorkspaceRepository(db),
    new MembershipRepository(db),
    auditLogService,
  )

  app.addHook('onClose', async () => {
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
