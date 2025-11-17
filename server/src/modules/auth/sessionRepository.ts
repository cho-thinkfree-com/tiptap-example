import type { DatabaseClient } from '../../lib/prismaClient'

export interface CreateSessionInput {
  accountId: string
  refreshTokenHash: string
  accessToken: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
}

export interface SessionEntity {
  id: string
  accountId: string
  refreshTokenHash: string
  accessToken: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
  createdAt: Date
  revokedAt?: Date | null
  revokedReason?: string | null
}

export interface SessionRepository {
  create(data: CreateSessionInput): Promise<SessionEntity>
  findByRefreshHash(hash: string): Promise<SessionEntity | null>
  findById(id: string): Promise<SessionEntity | null>
  revokeById(sessionId: string, reason?: string): Promise<void>
  revokeByAccount(accountId: string, reason?: string): Promise<void>
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(data: CreateSessionInput): Promise<SessionEntity> {
    const session = await this.prisma.session.create({
      data: {
        accountId: data.accountId,
        refreshTokenHash: data.refreshTokenHash,
        accessToken: data.accessToken,
        accessExpiresAt: data.accessExpiresAt,
        refreshExpiresAt: data.refreshExpiresAt,
      },
    })
    return toEntity(session)
  }

  async findByRefreshHash(hash: string): Promise<SessionEntity | null> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
    })
    return session ? toEntity(session) : null
  }

  async findById(id: string): Promise<SessionEntity | null> {
    const session = await this.prisma.session.findUnique({ where: { id } })
    return session ? toEntity(session) : null
  }

  async revokeById(sessionId: string, reason?: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedReason: reason },
    })
  }

  async revokeByAccount(accountId: string, reason?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    })
  }
}

const toEntity = (session: {
  id: string
  accountId: string
  refreshTokenHash: string
  accessToken: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
  createdAt: Date
  revokedAt: Date | null
  revokedReason: string | null
}): SessionEntity => ({
  id: session.id,
  accountId: session.accountId,
  refreshTokenHash: session.refreshTokenHash,
  accessToken: session.accessToken,
  accessExpiresAt: session.accessExpiresAt,
  refreshExpiresAt: session.refreshExpiresAt,
  createdAt: session.createdAt,
  revokedAt: session.revokedAt,
  revokedReason: session.revokedReason,
})
