import 'fastify'
import type { DatabaseClient } from '../lib/prismaClient.js'

declare module 'fastify' {
  interface FastifyRequest {
    db: DatabaseClient
    accountId?: string
    sessionId?: string
    membershipId?: string
    workspaceId?: string
    startTime?: number
  }
}
