import type { DocumentShareLinkSession as SessionModel } from '@prisma/client'
import type { DatabaseClient } from '../../lib/prismaClient'

export interface ShareLinkSessionEntity {
  id: string
  shareLinkId: string
  collaboratorId: string
  tokenHash: string
  expiresAt: Date
  revokedAt?: Date | null
  createdAt: Date
}

export interface ShareLinkSessionCreateInput {
  shareLinkId: string
  collaboratorId: string
  tokenHash: string
  expiresAt: Date
}

export class DocumentShareLinkSessionRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async create(input: ShareLinkSessionCreateInput): Promise<ShareLinkSessionEntity> {
    const session = await this.prisma.documentShareLinkSession.create({
      data: {
        shareLinkId: input.shareLinkId,
        collaboratorId: input.collaboratorId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    })
    return toEntity(session)
  }

  async revokeByShareLinkId(shareLinkId: string): Promise<void> {
    await this.prisma.documentShareLinkSession.updateMany({
      where: { shareLinkId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
}

const toEntity = (session: SessionModel): ShareLinkSessionEntity => ({
  id: session.id,
  shareLinkId: session.shareLinkId,
  collaboratorId: session.collaboratorId,
  tokenHash: session.tokenHash,
  expiresAt: session.expiresAt,
  revokedAt: session.revokedAt,
  createdAt: session.createdAt,
})
